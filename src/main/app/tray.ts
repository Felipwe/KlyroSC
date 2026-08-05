import { Tray, nativeImage } from 'electron'
import path from 'node:path'
import { app } from 'electron'
import { type MainWindow } from './window'

export class AppTray {
  private tray: Tray | null = null

  create(mainWindow: MainWindow, onRightClick: (bounds: Electron.Rectangle) => void): void {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(app.getAppPath(), 'resources', 'icon.png')
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    this.tray = new Tray(icon)
    this.tray.setToolTip('KlyroSC')
    this.tray.on('click', () => mainWindow.show())
    this.tray.on('right-click', (_event, bounds) => onRightClick(bounds))
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
