import { BrowserWindow, app, ipcMain, screen } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/types/ipc'
import { type PresencePayload } from '@shared/types/player'
import { logger } from '../core/logger'

const log = logger.scope('tray-popup')

const WIDTH = 276
const HEIGHT = 300
/** matches the exit animation in tray.html */
const CLOSE_ANIMATION_MS = 190

export interface TrayPopupLabels {
  nothing: string
  nothingHint: string
  open: string
  quit: string
}

export interface TrayPopupState {
  version: string
  accent: string
  accentColors: { a: string; b: string } | null
  labels: TrayPopupLabels
  now: { title: string; artist: string; artwork: string | null; playing: boolean } | null
}

export type TrayPopupAction = 'open' | 'quit' | 'play-pause' | 'next' | 'previous'

const ACTIONS: readonly TrayPopupAction[] = ['open', 'quit', 'play-pause', 'next', 'previous']

export class TrayPopup {
  private window: BrowserWindow | null = null
  private now: TrayPopupState['now'] = null
  private closing = false
  /** live colors extracted from the playing cover while the art theme is active */
  private artAccent: { a: string; b: string } | null = null

  constructor(
    private getState: () => Omit<TrayPopupState, 'now'>,
    private onAction: (action: TrayPopupAction) => void
  ) {
    ipcMain.on(IPC.trayAction, (event, action) => {
      if (event.sender !== this.window?.webContents) return
      if (typeof action === 'string' && (ACTIONS as readonly string[]).includes(action)) {
        if (action === 'open' || action === 'quit') this.hide()
        this.onAction(action as TrayPopupAction)
      }
    })
  }

  setNowPlaying(payload: PresencePayload | null): void {
    this.now = payload
      ? {
          title: payload.title,
          artist: payload.artist,
          artwork: payload.artworkUrl,
          playing: payload.playing
        }
      : null
    this.push()
  }

  setArtAccent(colors: { a: string; b: string } | null): void {
    this.artAccent = colors
    this.push()
  }

  refresh(): void {
    this.push()
  }

  toggle(bounds: Electron.Rectangle): void {
    if (this.window && !this.window.isDestroyed() && this.window.isVisible() && !this.closing) this.hide()
    else this.show(bounds)
  }

  hide(): void {
    const window = this.window
    if (!window || window.isDestroyed()) {
      this.window = null
      return
    }
    if (this.closing) return
    this.closing = true
    // let the page play its exit animation before the window goes away
    window.webContents.send(IPC.trayClosing)
    setTimeout(() => {
      if (this.window === window) {
        this.destroyNow()
      } else if (!window.isDestroyed()) {
        window.destroy()
      }
    }, CLOSE_ANIMATION_MS)
  }

  destroy(): void {
    this.destroyNow()
  }

  /** synchronous teardown — the popup must never keep the app alive on quit */
  private destroyNow(): void {
    if (this.window && !this.window.isDestroyed()) this.window.destroy()
    this.window = null
    this.closing = false
  }

  private show(bounds: Electron.Rectangle): void {
    this.destroyNow()
    const window = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/tray.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: false
      }
    })
    this.window = window

    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
    const area = display.workArea
    const x = Math.round(
      Math.min(Math.max(bounds.x + bounds.width / 2 - WIDTH / 2, area.x + 8), area.x + area.width - WIDTH - 8)
    )
    const y = Math.round(
      bounds.y > area.y + area.height / 2 ? bounds.y - HEIGHT - 10 : bounds.y + bounds.height + 10
    )
    window.setPosition(x, y)

    window.on('blur', () => this.hide())
    window.webContents.on('did-finish-load', () => {
      if (this.window !== window || window.isDestroyed()) return
      window.webContents.send(IPC.trayState, this.buildState())
      window.show()
    })

    const file = app.isPackaged
      ? path.join(process.resourcesPath, 'tray.html')
      : path.join(app.getAppPath(), 'resources', 'tray.html')
    window.loadFile(file).catch((error) => log.warn(`failed to load tray popup: ${String(error)}`))
  }

  /** settings-provided state plus the live bits (now playing, art accent) */
  private buildState(): TrayPopupState {
    const state: TrayPopupState = { ...this.getState(), now: this.now }
    if (state.accent === 'art' && this.artAccent) state.accentColors = this.artAccent
    return state
  }

  private push(): void {
    if (this.window && !this.window.isDestroyed() && this.window.isVisible())
      this.window.webContents.send(IPC.trayState, this.buildState())
  }
}
