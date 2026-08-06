import { dialog, shell } from 'electron'
import { IPC } from '@shared/types/ipc'
import { isRecord } from '@shared/types/result'
import { type PlayerEvent, type PresencePayload } from '@shared/types/player'
import { type PluginConfigValue } from '@shared/types/plugin'
import { downloadTrack } from '../services/downloads'
import { fetchLyrics } from '../services/lyrics'
import { paths, ensureDir } from '../core/paths'
import { handle, handleResult, on } from './core'
import { type AppContext } from './index'

const parsePresence = (raw: unknown): PresencePayload | null => {
  if (!isRecord(raw)) return null
  if (typeof raw.title !== 'string' || typeof raw.artist !== 'string') return null
  return {
    title: raw.title,
    artist: raw.artist,
    artworkUrl: typeof raw.artworkUrl === 'string' ? raw.artworkUrl : null,
    trackUrl: typeof raw.trackUrl === 'string' ? raw.trackUrl : '',
    trackId: typeof raw.trackId === 'number' ? raw.trackId : undefined,
    durationSec: typeof raw.durationSec === 'number' ? raw.durationSec : 0,
    positionSec: typeof raw.positionSec === 'number' ? raw.positionSec : 0,
    playing: raw.playing === true
  }
}

export function registerFeatureIpc(ctx: AppContext): void {
  on(IPC.presenceUpdate, (payload) => {
    const parsed = parsePresence(payload)
    ctx.presence.update(parsed)
    ctx.trayPopup.setNowPlaying(parsed)
    ctx.stats.setPlaying(parsed?.playing === true)
    ctx.social.setNowPlaying(
      parsed && typeof parsed.trackId === 'number' && parsed.trackId > 0
        ? {
            trackId: parsed.trackId,
            title: parsed.title,
            artist: parsed.artist,
            artwork: parsed.artworkUrl,
            playing: parsed.playing
          }
        : null
    )
  })

  handle(IPC.authStatus, () => ctx.auth.state())
  handleResult(IPC.authLogin, async () => {
    const state = await ctx.auth.login(ctx.mainWindow.get())
    if (state.loggedIn && state.user) {
      try {
        const likes = await ctx.sc.userLikes(state.user.id, 200)
        if (likes.length > 0) ctx.library.mergeFavorites(likes)
      } catch {
        /* likes import is best-effort */
      }
    }
    return state
  })
  handle(IPC.authLogout, () => ctx.auth.logout())

  handleResult(IPC.lyricsGet, (payload) => {
    const p = payload as { artist?: unknown; title?: unknown; duration?: unknown }
    if (typeof p?.artist !== 'string' || typeof p?.title !== 'string')
      throw new Error('invalid lyrics query')
    return fetchLyrics(p.artist, p.title, typeof p.duration === 'number' ? p.duration : 0)
  })

  handle(IPC.pluginsList, () => ctx.plugins.list())
  handle(IPC.pluginsSetEnabled, (payload) => {
    const p = payload as { id?: unknown; enabled?: unknown }
    return typeof p?.id === 'string'
      ? ctx.plugins.setEnabled(p.id, p.enabled === true)
      : ctx.plugins.list()
  })
  handle(IPC.pluginsConfigure, (payload) => {
    const p = payload as { id?: unknown; config?: unknown }
    return typeof p?.id === 'string' && isRecord(p.config)
      ? ctx.plugins.configure(p.id, p.config as Record<string, PluginConfigValue>)
      : ctx.plugins.list()
  })
  handle(IPC.pluginsReload, () => {
    ctx.plugins.loadAll()
    return ctx.plugins.list()
  })
  handleResult(IPC.pluginsInstall, async () => {
    const window = ctx.mainWindow.get()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return null
    return ctx.plugins.installFromFolder(dir)
  })
  handleResult(IPC.pluginsUninstall, (id) => {
    if (typeof id !== 'string') throw new Error('invalid plugin id')
    return ctx.plugins.uninstall(id)
  })
  on(IPC.pluginsPlayerEvent, (event) => {
    const e = event as PlayerEvent
    if (!isRecord(e) || typeof e.type !== 'string') return
    ctx.plugins.onPlayerEvent(e)
  })

  handle(IPC.updatesStatus, () => ctx.updater.getStatus())
  handle(IPC.updatesCheck, () => ctx.updater.check())
  handle(IPC.updatesDownload, () => ctx.updater.download())
  on(IPC.updatesInstall, () => {
    ctx.mainWindow.isQuitting = true
    ctx.updater.install()
  })

  handleResult(IPC.downloadsTrack, (trackId, title) => {
    if (typeof trackId !== 'number') throw new Error('invalid track id')
    return downloadTrack(ctx.sc, trackId, typeof title === 'string' ? title : `track-${trackId}`)
  })
  on(IPC.downloadsOpenFolder, () => {
    void shell.openPath(ensureDir(paths.downloadsDir()))
  })
}
