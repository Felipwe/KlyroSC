import { isRecord } from '@shared/types/result'
import {
  type Artist,
  type HomeSection,
  type Page,
  type PlaylistLite,
  type RemotePlaylist,
  type ResolvedItem,
  type SearchKind,
  type Track,
  type TrackComment
} from '@shared/types/track'
import { type StreamSource } from '@shared/types/player'
import { type StreamQuality } from '@shared/types/settings'
import { ScClient } from './client'
import {
  collectionOf,
  mapArtist,
  mapComment,
  mapPlaylist,
  mapPlaylistLite,
  mapTrack,
  mapTranscodings,
  nextHrefOf
} from './mappers'
import { logger } from '../../core/logger'

const log = logger.scope('sc-api')

const SEARCH_PATHS: Record<SearchKind, string> = {
  tracks: '/search/tracks',
  artists: '/search/users',
  playlists: '/search/playlists_without_albums'
}

export class SoundCloudApi {
  private client = new ScClient()
  private streamCache = new Map<number, { source: StreamSource; at: number }>()
  private regionUnblock = true

  setRegionUnblock(enabled: boolean): void {
    this.regionUnblock = enabled
  }

  async home(): Promise<HomeSection[]> {
    const raw = await this.client.api('/mixed-selections', { limit: 12 })
    const sections: HomeSection[] = []
    for (const entry of collectionOf(raw)) {
      if (!isRecord(entry)) continue
      const title = typeof entry.title === 'string' ? entry.title : ''
      const inner = isRecord(entry.items) ? collectionOf(entry.items) : []
      const playlists = inner
        .map(mapPlaylistLite)
        .filter((p): p is PlaylistLite => p !== null && p.trackCount > 0)
      if (title && playlists.length > 0)
        sections.push({ id: String(entry.id ?? title), title, playlists })
    }
    return sections
  }

  async charts(genre: string): Promise<Track[]> {
    const raw = await this.client.api('/charts', {
      kind: 'trending',
      genre: `soundcloud:genres:${genre}`,
      limit: 20
    })
    const tracks: Track[] = []
    for (const entry of collectionOf(raw)) {
      if (!isRecord(entry)) continue
      if (typeof entry.promoted_urn === 'string') continue
      const track = mapTrack(entry.track)
      if (track) tracks.push(track)
    }
    return tracks
  }

  async search(
    kind: SearchKind,
    query: string,
    nextHref?: string | null
  ): Promise<Page<Track | Artist | PlaylistLite>> {
    const raw = nextHref
      ? await this.client.absolute(nextHref)
      : await this.client.api(SEARCH_PATHS[kind], { q: query, limit: 20 })
    const items: (Track | Artist | PlaylistLite)[] = []
    for (const entry of collectionOf(raw)) {
      if (isRecord(entry) && typeof entry.promoted_urn === 'string') continue
      const mapped =
        kind === 'tracks' ? mapTrack(entry) : kind === 'artists' ? mapArtist(entry) : mapPlaylistLite(entry)
      if (mapped) items.push(mapped)
    }
    return { items, nextHref: nextHrefOf(raw) }
  }

  async track(id: number): Promise<Track> {
    const raw = await this.client.api(`/tracks/${id}`)
    const track = mapTrack(raw)
    if (!track) throw new Error('track not found')
    return track
  }

  async tracks(ids: number[]): Promise<Track[]> {
    if (ids.length === 0) return []
    const out: Track[] = []
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50)
      const raw = await this.client.api('/tracks', { ids: chunk.join(',') })
      if (Array.isArray(raw)) {
        for (const entry of raw) {
          const track = mapTrack(entry)
          if (track) out.push(track)
        }
      }
    }
    const byId = new Map(out.map((t) => [t.id, t]))
    return ids.map((id) => byId.get(id)).filter((t): t is Track => !!t)
  }

  async playlist(ref: string): Promise<RemotePlaylist> {
    const endpoint = ref.includes('system-playlists')
      ? `/system-playlists/${encodeURIComponent(ref)}`
      : `/playlists/${encodeURIComponent(ref)}`
    const raw = await this.client.api(endpoint)
    const playlist = mapPlaylist(raw)
    if (!playlist) throw new Error('playlist not found')
    const missing = playlist.trackIds.filter((id) => !playlist.tracks.some((t) => t.id === id))
    if (missing.length > 0 && missing.length <= 100) {
      try {
        const hydrated = await this.tracks(missing)
        const byId = new Map(
          [...playlist.tracks, ...hydrated].map((track) => [track.id, track])
        )
        playlist.tracks = playlist.trackIds
          .map((id) => byId.get(id))
          .filter((t): t is Track => !!t)
      } catch (error) {
        log.warn(`could not hydrate ${missing.length} playlist tracks: ${String(error)}`)
      }
    }
    return playlist
  }

  async user(id: number): Promise<Artist> {
    const raw = await this.client.api(`/users/${id}`)
    const artist = mapArtist(raw)
    if (!artist) throw new Error('artist not found')
    return artist
  }

  async userTracks(id: number, nextHref?: string | null): Promise<Page<Track>> {
    const raw = nextHref
      ? await this.client.absolute(nextHref)
      : await this.client.api(`/users/${id}/tracks`, { limit: 20 })
    const items: Track[] = []
    for (const entry of collectionOf(raw)) {
      const track = mapTrack(entry)
      if (track) items.push(track)
    }
    return { items, nextHref: nextHrefOf(raw) }
  }

  async related(id: number): Promise<Track[]> {
    const raw = await this.client.api(`/tracks/${id}/related`, { limit: 20 })
    return collectionOf(raw)
      .map(mapTrack)
      .filter((t): t is Track => !!t)
  }

  async comments(trackId: number, nextHref?: string | null): Promise<Page<TrackComment>> {
    const raw = nextHref
      ? await this.client.absolute(nextHref)
      : await this.client.api(`/tracks/${trackId}/comments`, {
          limit: 30,
          threaded: 0,
          filter_replies: 0
        })
    const items = collectionOf(raw)
      .map(mapComment)
      .filter((c): c is TrackComment => !!c)
    return { items, nextHref: nextHrefOf(raw) }
  }

  async addComment(trackId: number, body: string, timestampMs: number | null): Promise<TrackComment | null> {
    const comment: Record<string, unknown> = { body }
    if (timestampMs !== null) comment.timestamp = timestampMs
    const raw = await this.client.api(
      `/tracks/${trackId}/comments`,
      {},
      { method: 'POST', body: { comment } }
    )
    return mapComment(raw)
  }

  async setRepost(trackId: number, on: boolean): Promise<void> {
    await this.client.api(`/me/track_reposts/${trackId}`, {}, { method: on ? 'PUT' : 'DELETE' })
  }

  async userReposts(id: number): Promise<Track[]> {
    const raw = await this.client.api(`/stream/users/${id}`, { limit: 30 })
    const tracks: Track[] = []
    const seen = new Set<number>()
    for (const entry of collectionOf(raw)) {
      if (!isRecord(entry) || typeof entry.type !== 'string' || !entry.type.includes('repost')) continue
      const track = mapTrack(entry.track)
      if (track && !seen.has(track.id)) {
        seen.add(track.id)
        tracks.push(track)
      }
    }
    return tracks
  }

  async setLike(userId: number, trackId: number, liked: boolean): Promise<void> {
    await this.client.api(
      `/users/${userId}/track_likes/${trackId}`,
      {},
      { method: liked ? 'PUT' : 'DELETE' }
    )
  }

  async me(): Promise<unknown> {
    return this.client.api('/me')
  }

  async userLikes(userId: number, limit: number): Promise<Track[]> {
    const tracks: Track[] = []
    let raw = await this.client.api(`/users/${userId}/track_likes`, { limit: Math.min(limit, 100) })
    for (;;) {
      for (const entry of collectionOf(raw)) {
        if (!isRecord(entry)) continue
        const track = mapTrack(entry.track)
        if (track) tracks.push(track)
      }
      const next = nextHrefOf(raw)
      if (!next || tracks.length >= limit) break
      raw = await this.client.absolute(next)
    }
    return tracks.slice(0, limit)
  }

  async resolve(url: string): Promise<ResolvedItem> {
    if (!/^https:\/\/(www\.|on\.|m\.)?soundcloud\.com\//.test(url)) return { kind: 'unknown' }
    const raw = await this.client.api('/resolve', { url })
    if (!isRecord(raw)) return { kind: 'unknown' }
    if (raw.kind === 'track') {
      const track = mapTrack(raw)
      return track ? { kind: 'track', track } : { kind: 'unknown' }
    }
    if (raw.kind === 'playlist' || raw.kind === 'system-playlist') {
      const lite = mapPlaylistLite(raw)
      return lite ? { kind: 'playlist', ref: lite.ref } : { kind: 'unknown' }
    }
    if (raw.kind === 'user' && typeof raw.id === 'number') return { kind: 'artist', id: raw.id }
    return { kind: 'unknown' }
  }

  async stream(trackId: number, quality: StreamQuality, fresh = false): Promise<StreamSource> {
    if (fresh) this.streamCache.delete(trackId)
    const cached = this.streamCache.get(trackId)
    // SoundCloud CDN urls expire fast; a short TTL only covers rapid prev/next
    if (cached && Date.now() - cached.at < 2 * 60 * 1000) return cached.source

    const raw = await this.client.api(`/tracks/${trackId}`)
    const snippedOnly = this.isSnippedOnly(raw)
    let source = snippedOnly ? null : await this.resolveFrom(raw, quality)

    // region-degraded tracks come back as 30s previews; the widget api serves the full stream
    if (!source && this.regionUnblock) {
      try {
        const widgetRaw = await this.client.absolute(
          `https://api-widget.soundcloud.com/tracks/${trackId}`
        )
        source = await this.resolveFrom(widgetRaw, quality, snippedOnly)
        if (source) log.info(`track ${trackId} unlocked full stream via widget api`)
      } catch (error) {
        log.warn(`widget fallback failed for ${trackId}: ${String(error)}`)
      }
    }

    // last resort: accept the preview (Go+ tracks are snipped everywhere)
    if (!source && snippedOnly) source = await this.resolveFrom(raw, quality)

    if (!source) throw new Error('track is not playable in your region')

    this.streamCache.set(trackId, { source, at: Date.now() })
    if (this.streamCache.size > 40) {
      const first = this.streamCache.keys().next().value
      if (first !== undefined) this.streamCache.delete(first)
    }
    return source
  }

  private isSnippedOnly(raw: unknown): boolean {
    if (!isRecord(raw)) return false
    const transcodings = mapTranscodings(raw.media)
    return transcodings.length > 0 && transcodings.every((t) => t.snipped)
  }

  private async resolveFrom(
    raw: unknown,
    quality: StreamQuality,
    fullOnly = false
  ): Promise<StreamSource | null> {
    if (!isRecord(raw)) return null
    let transcodings = mapTranscodings(raw.media)
    if (fullOnly) transcodings = transcodings.filter((t) => !t.snipped)
    if (transcodings.length === 0) return null
    const auth = typeof raw.track_authorization === 'string' ? raw.track_authorization : ''

    const ordered = [...transcodings].sort((a, b) => {
      const prefer = (p: 'progressive' | 'hls'): number => {
        if (quality === 'hls') return p === 'hls' ? 0 : 1
        return p === 'progressive' ? 0 : 1
      }
      return prefer(a.protocol) - prefer(b.protocol)
    })

    for (const transcoding of ordered) {
      try {
        const url = new URL(transcoding.url)
        if (auth) url.searchParams.set('track_authorization', auth)
        const res = await this.client.absolute(url.toString())
        if (isRecord(res) && typeof res.url === 'string')
          return { url: res.url, protocol: transcoding.protocol }
      } catch {
        continue
      }
    }
    return null
  }
}
