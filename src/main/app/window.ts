import { BrowserWindow, shell, type Rectangle } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/types/ipc'
import { WindowStateKeeper } from './window-state'

export interface WindowOptions {
  backgroundThrottling: boolean
  startMinimized: boolean
}

const MINI_SIZE = { width: 440, height: 148 }

export class MainWindow {
  private window: BrowserWindow | null = null
  private stateKeeper = new WindowStateKeeper()
  private normalBounds: Rectangle | null = null
  private mini = false
  isQuitting = false
  closeToTray = true

  create(options: WindowOptions): BrowserWindow {
    const state = this.stateKeeper.get()
    const window = new BrowserWindow({
      width: state.width,
      height: state.height,
      x: state.x ?? undefined,
      y: state.y ?? undefined,
      minWidth: 980,
      minHeight: 640,
      show: false,
      frame: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      backgroundColor: '#0a0b12',
      icon: process.platform === 'win32' ? path.join(__dirname, '../../build/icon.ico') : undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        spellcheck: false,
        backgroundThrottling: options.backgroundThrottling
      }
    })
    this.window = window
    this.stateKeeper.track(window)

    window.once('ready-to-show', () => {
      if (options.startMinimized || process.argv.includes('--hidden')) return
      window.show()
      if (state.maximized) window.maximize()
    })

    window.on('maximize', () => window.webContents.send(IPC.windowMaximized, true))
    window.on('unmaximize', () => window.webContents.send(IPC.windowMaximized, false))

    window.on('close', (event) => {
      if (!this.isQuitting && this.closeToTray) {
        event.preventDefault()
        window.hide()
      }
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('http://localhost')) event.preventDefault()
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      void window.loadURL(process.env.ELECTRON_RENDERER_URL)
      if (process.env.KLYRO_DEVTOOLS === '1') window.webContents.openDevTools({ mode: 'detach' })
    } else {
      void window.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
    return window
  }

  get(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null
  }

  show(): void {
    const window = this.get()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  send(channel: string, ...args: unknown[]): void {
    this.get()?.webContents.send(channel, ...args)
  }

  setMiniMode(on: boolean): void {
    const window = this.get()
    if (!window || this.mini === on) return
    this.mini = on
    if (on) {
      this.normalBounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds()
      if (window.isMaximized()) window.unmaximize()
      window.setMinimumSize(MINI_SIZE.width, MINI_SIZE.height)
      window.setSize(MINI_SIZE.width, MINI_SIZE.height)
      window.setResizable(false)
      window.setAlwaysOnTop(true, 'floating')
    } else {
      window.setAlwaysOnTop(false)
      window.setResizable(true)
      window.setMinimumSize(980, 640)
      if (this.normalBounds) window.setBounds(this.normalBounds)
      else window.setSize(1360, 800)
    }
  }
}
