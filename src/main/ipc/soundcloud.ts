import { IPC } from '@shared/types/ipc'
import { type SearchKind } from '@shared/types/track'
import { handleResult } from './core'
import { type AppContext } from './index'

const KINDS: SearchKind[] = ['tracks', 'artists', 'playlists']

export function registerSoundCloudIpc(ctx: AppContext): void {
  handleResult(IPC.scHome, () => ctx.sc.home())

  handleResult(IPC.scCharts, (payload) => {
    const p = payload as { genre?: unknown }
    const genre = typeof p?.genre === 'string' && /^[a-z0-9&+-]+$/i.test(p.genre) ? p.genre : 'all-music'
    return ctx.sc.charts(genre)
  })

  handleResult(IPC.scSearch, (payload) => {
    const p = payload as { kind?: unknown; query?: unknown; nextHref?: unknown }
    const kind = KINDS.includes(p?.kind as SearchKind) ? (p.kind as SearchKind) : 'tracks'
    const query = typeof p?.query === 'string' ? p.query.slice(0, 200) : ''
    const nextHref = typeof p?.nextHref === 'string' ? p.nextHref : null
    if (!query && !nextHref) throw new Error('empty query')
    return ctx.sc.search(kind, query, nextHref)
  })

  handleResult(IPC.scTrack, (id) => {
    if (typeof id !== 'number') throw new Error('invalid track id')
    return ctx.sc.track(id)
  })

  handleResult(IPC.scTracks, (ids) => {
    const list = Array.isArray(ids) ? ids.filter((i): i is number => typeof i === 'number') : []
    return ctx.sc.tracks(list.slice(0, 300))
  })

  handleResult(IPC.scPlaylist, (ref) => {
    if (typeof ref !== 'string' || ref.length === 0) throw new Error('invalid playlist ref')
    return ctx.sc.playlist(ref)
  })

  handleResult(IPC.scUser, (id) => {
    if (typeof id !== 'number') throw new Error('invalid user id')
    return ctx.sc.user(id)
  })

  handleResult(IPC.scUserTracks, (payload) => {
    const p = payload as { id?: unknown; nextHref?: unknown }
    if (typeof p?.id !== 'number') throw new Error('invalid user id')
    return ctx.sc.userTracks(p.id, typeof p.nextHref === 'string' ? p.nextHref : null)
  })

  handleResult(IPC.scRelated, (id) => {
    if (typeof id !== 'number') throw new Error('invalid track id')
    return ctx.sc.related(id)
  })

  handleResult(IPC.scComments, (payload) => {
    const p = payload as { id?: unknown; nextHref?: unknown }
    if (typeof p?.id !== 'number') throw new Error('invalid track id')
    return ctx.sc.comments(p.id, typeof p.nextHref === 'string' ? p.nextHref : null)
  })

  handleResult(IPC.scResolve, (url) => {
    if (typeof url !== 'string') throw new Error('invalid url')
    return ctx.sc.resolve(url)
  })

  handleResult(IPC.scStream, (payload) => {
    const p = payload as { id?: unknown; fresh?: unknown }
    const trackId = typeof p === 'number' ? p : typeof p?.id === 'number' ? p.id : null
    if (trackId === null) throw new Error('invalid track id')
    return ctx.sc.stream(trackId, ctx.settings.get().playback.quality, p?.fresh === true)
  })
}
