import { IPC } from '@shared/types/ipc'
import { type DeepPartial, isRecord } from '@shared/types/result'
import { type Settings } from '@shared/types/settings'
import { isStoredTrack, type Track } from '@shared/types/track'
import { type PlaybackSnapshot, type RepeatMode } from '@shared/types/player'
import { QUEUE_PERSIST_LIMIT } from '@shared/constants'
import { JsonStore } from '../core/store'
import { paths } from '../core/paths'
import { logger } from '../core/logger'
import { handle, on } from './core'
import { type AppContext } from './index'

const log = logger.scope('library-sync')

const parseSnapshot = (raw: unknown): PlaybackSnapshot | null => {
  if (!isRecord(raw)) return null
  const queue = Array.isArray(raw.queue) ? raw.queue.filter(isStoredTrack) : []
  if (queue.length === 0) return null
  const originalQueue = Array.isArray(raw.originalQueue)
    ? raw.originalQueue.filter(isStoredTrack)
    : null
  const repeat: RepeatMode =
    raw.repeat === 'all' || raw.repeat === 'one' ? raw.repeat : 'off'
  const index = typeof raw.index === 'number' ? Math.floor(raw.index) : 0
  return {
    queue: queue.slice(0, QUEUE_PERSIST_LIMIT),
    originalQueue: originalQueue && originalQueue.length > 0 ? originalQueue.slice(0, QUEUE_PERSIST_LIMIT) : null,
    index: Math.min(Math.max(0, index), queue.length - 1),
    position: typeof raw.position === 'number' && raw.position >= 0 ? raw.position : 0,
    shuffle: raw.shuffle === true,
    repeat,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now()
  }
}

export function registerDataIpc(ctx: AppContext): void {
  handle<Settings>(IPC.settingsGet, () => ctx.settings.get())
  handle<Settings>(IPC.settingsSet, (patch) =>
    ctx.settings.patch(isRecord(patch) ? (patch as DeepPartial<Settings>) : {})
  )
  handle<Settings>(IPC.settingsReset, () => ctx.settings.reset())

  handle(IPC.libraryGet, () => ctx.library.get())
  handle(IPC.libraryToggleFavorite, (track) => {
    if (!isStoredTrack(track)) return ctx.library.get()
    const data = ctx.library.toggleFavorite(track)
    const userId = ctx.auth.userId()
    if (userId !== null) {
      const liked = data.favorites.some((f) => f.track.id === track.id)
      ctx.sc.setLike(userId, track.id, liked).catch((error: unknown) => {
        log.warn(`could not sync like for ${track.id}: ${String(error)}`)
      })
    }
    return data
  })
  handle(IPC.libraryCreatePlaylist, (name) =>
    typeof name === 'string' ? ctx.library.createPlaylist(name) : ctx.library.get()
  )
  handle(IPC.libraryRenamePlaylist, (payload) => {
    const p = payload as { id?: unknown; name?: unknown }
    return typeof p?.id === 'string' && typeof p?.name === 'string'
      ? ctx.library.renamePlaylist(p.id, p.name)
      : ctx.library.get()
  })
  handle(IPC.libraryDeletePlaylist, (id) =>
    typeof id === 'string' ? ctx.library.deletePlaylist(id) : ctx.library.get()
  )
  handle(IPC.libraryAddToPlaylist, (payload) => {
    const p = payload as { id?: unknown; tracks?: unknown }
    const tracks = Array.isArray(p?.tracks) ? p.tracks.filter(isStoredTrack) : []
    return typeof p?.id === 'string' && tracks.length > 0
      ? ctx.library.addToPlaylist(p.id, tracks as Track[])
      : ctx.library.get()
  })
  handle(IPC.libraryRemoveFromPlaylist, (payload) => {
    const p = payload as { id?: unknown; index?: unknown }
    return typeof p?.id === 'string' && typeof p?.index === 'number'
      ? ctx.library.removeFromPlaylist(p.id, p.index)
      : ctx.library.get()
  })
  handle(IPC.libraryMoveInPlaylist, (payload) => {
    const p = payload as { id?: unknown; from?: unknown; to?: unknown }
    return typeof p?.id === 'string' && typeof p?.from === 'number' && typeof p?.to === 'number'
      ? ctx.library.moveInPlaylist(p.id, p.from, p.to)
      : ctx.library.get()
  })
  handle(IPC.libraryMovePlaylist, (payload) => {
    const p = payload as { from?: unknown; to?: unknown }
    return typeof p?.from === 'number' && typeof p?.to === 'number'
      ? ctx.library.movePlaylist(Math.floor(p.from), Math.floor(p.to))
      : ctx.library.get()
  })
  handle(IPC.libraryAddHistory, (track) =>
    isStoredTrack(track) ? ctx.library.addHistory(track) : ctx.library.get()
  )
  handle(IPC.libraryClearHistory, () => ctx.library.clearHistory())

  const playbackStore = new JsonStore<PlaybackSnapshot | null>(
    paths.playbackFile(),
    parseSnapshot,
    1000
  )
  handle(IPC.playbackLoad, () => playbackStore.get())
  on(IPC.playbackSave, (snapshot) => {
    const parsed = parseSnapshot(snapshot)
    if (parsed) playbackStore.set(parsed)
  })
  ctx.flushers.push(() => playbackStore.flush())
}
