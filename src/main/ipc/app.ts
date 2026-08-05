import { app, dialog, nativeImage, shell } from 'electron'
import fs from 'node:fs'
import { IPC, type AppInfo, type OpenPathKind } from '@shared/types/ipc'
import { isRecord, type DeepPartial } from '@shared/types/result'
import { type Settings } from '@shared/types/settings'
import { ensureDir, paths } from '../core/paths'
import { logger } from '../core/logger'
import { handle, handleResult, on } from './core'
import { type AppContext } from './index'

const rendererLog = logger.scope('renderer')

export function registerAppIpc(ctx: AppContext): void {
  handle<AppInfo>(IPC.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    arch: process.arch,
    country: (app.getLocaleCountryCode() || '').toUpperCase()
  }))

  on(IPC.appQuit, () => {
    ctx.mainWindow.isQuitting = true
    app.quit()
  })

  on(IPC.appRelaunch, () => {
    ctx.mainWindow.isQuitting = true
    app.relaunch()
    app.quit()
  })

  on(IPC.shellOpenExternal, (url) => {
    if (typeof url === 'string' && url.startsWith('https://')) void shell.openExternal(url)
  })

  on(IPC.appOpenPath, (kind) => {
    const k = kind as OpenPathKind
    const target =
      k === 'logs'
        ? paths.logs()
        : k === 'downloads'
          ? paths.downloadsDir()
          : k === 'plugins'
            ? paths.externalPluginsDir()
            : paths.userData()
    void shell.openPath(ensureDir(target))
  })

  on(IPC.windowMinimize, () => ctx.mainWindow.get()?.minimize())
  on(IPC.windowMaximizeToggle, () => {
    const window = ctx.mainWindow.get()
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  on(IPC.windowClose, () => ctx.mainWindow.get()?.close())
  handle<boolean>(IPC.windowIsMaximized, () => ctx.mainWindow.get()?.isMaximized() ?? false)
  handle<void>(IPC.windowSetMini, (onFlag) => ctx.mainWindow.setMiniMode(onFlag === true))

  on(IPC.logRenderer, (payload) => {
    const p = payload as { level?: string; message?: string }
    const message = typeof p?.message === 'string' ? p.message.slice(0, 2000) : ''
    if (!message) return
    if (p.level === 'error') rendererLog.error(message)
    else if (p.level === 'warn') rendererLog.warn(message)
    else rendererLog.info(message)
  })

  handleResult(IPC.libraryExport, async () => {
    const window = ctx.mainWindow.get()
    if (!window) return null
    const result = await dialog.showSaveDialog(window, {
      defaultPath: 'klyrosc-library.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    const payload = {
      format: 'klyrosc-backup',
      version: 2,
      library: JSON.parse(ctx.library.serialize()) as unknown,
      eq: ctx.settings.get().eq
    }
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
    return result.filePath
  })

  handleResult(IPC.libraryImport, async () => {
    const window = ctx.mainWindow.get()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) return null
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    // v2 backups wrap the library and carry the EQ config; older files are the bare library
    if (isRecord(raw) && isRecord(raw.library)) {
      if (isRecord(raw.eq)) ctx.settings.patch({ eq: raw.eq } as DeepPartial<Settings>)
      return ctx.library.replace(raw.library)
    }
    return ctx.library.replace(raw)
  })

  handleResult(IPC.librarySetCover, async (id) => {
    if (typeof id !== 'string') throw new Error('invalid playlist id')
    const window = ctx.mainWindow.get()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) return null
    const image = nativeImage.createFromPath(file)
    if (image.isEmpty()) throw new Error('unsupported image file')
    const resized = image.resize({ width: 512, quality: 'best' })
    const dataUrl = `data:image/jpeg;base64,${resized.toJPEG(84).toString('base64')}`
    return ctx.library.setPlaylistCover(id, dataUrl)
  })

  handle(IPC.libraryRemoveCover, (id) =>
    typeof id === 'string' ? ctx.library.setPlaylistCover(id, null) : ctx.library.get()
  )
}
