import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { IPC } from '@shared/types/ipc'
import { logger } from './core/logger'
import { type MainWindow } from './app/window'

const log = logger.scope('smoke')

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export async function runSmokeCapture(mainWindow: MainWindow): Promise<void> {
  const dir = app.isPackaged
    ? path.join(app.getPath('userData'), 'smoke')
    : path.join(app.getAppPath(), 'out', 'smoke')

  const capture = async (name: string): Promise<void> => {
    const window = mainWindow.get()
    if (!window) return
    const image = await window.webContents.capturePage()
    fs.writeFileSync(path.join(dir, `${name}.png`), image.toPNG())
    log.info(`captured ${name}.png`)
  }

  try {
    fs.mkdirSync(dir, { recursive: true })
    await wait(800)
    await capture('splash')
    await wait(8200)
    await capture('home')
    mainWindow.send(IPC.nav, { name: 'search' })
    await wait(1200)
    await capture('search')
    mainWindow.send(IPC.nav, { name: 'favorites' })
    await wait(1200)
    await capture('favorites')
    mainWindow.send(IPC.nav, { name: 'settings' })
    await wait(1200)
    await capture('settings')
    mainWindow.send(IPC.nav, { name: 'settings', params: { section: 'equalizer' } })
    await wait(1200)
    await capture('settings-eq')
    mainWindow.send(IPC.nav, { name: 'settings', params: { section: 'plugins' } })
    await wait(1200)
    await capture('settings-plugins')
  } catch (error) {
    log.error('smoke capture failed', error)
  } finally {
    mainWindow.isQuitting = true
    app.exit(0)
  }
}
