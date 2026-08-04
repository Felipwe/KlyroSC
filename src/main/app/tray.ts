import { Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import { app } from 'electron'
import { IPC } from '@shared/types/ipc'
import { type MediaAction } from '@shared/types/player'
import { type MainWindow } from './window'

interface TrayLabels {
  open: string
  playPause: string
  next: string
  previous: string
  quit: string
}

export class AppTray {
  private tray: Tray | null = null

  create(mainWindow: MainWindow, labels: TrayLabels, onQuit: () => void): void {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(app.getAppPath(), 'resources', 'icon.png')
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    this.tray = new Tray(icon)
    this.tray.setToolTip('KlyroSC')

    const sendMedia = (action: MediaAction): void => mainWindow.send(IPC.media, action)
    const menu = Menu.buildFromTemplate([
      { label: labels.open, click: () => mainWindow.show() },
      { type: 'separator' },
      { label: labels.playPause, click: () => sendMedia('play-pause') },
      { label: labels.next, click: () => sendMedia('next') },
      { label: labels.previous, click: () => sendMedia('previous') },
      { type: 'separator' },
      { label: labels.quit, click: onQuit }
    ])
    this.tray.setContextMenu(menu)
    this.tray.on('click', () => mainWindow.show())
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
