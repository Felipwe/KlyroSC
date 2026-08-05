import { app, dialog, nativeImage, shell } from 'electron'
import fs from 'node:fs'
import { IPC, type AppInfo, type OpenPathKind } from '@shared/types/ipc'
import { isRecord, type DeepPartial } from '@shared/types/result'
import { type Settings } from '@shared/types/settings'
import { sanitizeEqGains } from '@shared/utils/eq'
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

  handleResult(IPC.eqExport, async (payload) => {
    const p = payload as { name?: unknown; preamp?: unknown; gains?: unknown }
    const name = typeof p?.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : 'Custom'
    const window = ctx.mainWindow.get()
    if (!window) return null
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preset'
    const result = await dialog.showSaveDialog(window, {
      defaultPath: `klyrosc-eq-${slug}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    const doc = {
      format: 'klyrosc-eq',
      version: 1,
      name,
      preamp: typeof p.preamp === 'number' && Number.isFinite(p.preamp) ? p.preamp : 0,
      gains: sanitizeEqGains(p.gains)
    }
    fs.writeFileSync(result.filePath, JSON.stringify(doc, null, 2), 'utf8')
    return result.filePath
  })

  handleResult(IPC.eqImport, async () => {
    const window = ctx.mainWindow.get()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) return null
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!isRecord(raw) || !Array.isArray(raw.gains)) throw new Error('not a KlyroSC EQ preset')
    const name =
      typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Preset importado'
    const gains = sanitizeEqGains(raw.gains)
    const preamp = typeof raw.preamp === 'number' && Number.isFinite(raw.preamp) ? raw.preamp : 0
    const current = ctx.settings.get().eq
    const custom = [
      ...current.custom.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase()),
      { name, gains }
    ]
    // saves the preset and applies it live via the settings-changed broadcast
    ctx.settings.patch({ eq: { custom, gains, preamp } } as DeepPartial<Settings>)
    return { name }
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
