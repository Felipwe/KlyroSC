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
import { pickAlternative, type AltCandidate, type AltOriginal } from '@shared/utils/alternative'
import { pickChartMatch, primaryArtist, type ChartCandidate } from '@shared/utils/charts-match'
import { cleanTitle } from '@shared/utils/lyrics-query'
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
  private countryChartsCache: { country: string; tracks: Track[]; at: number } | null = null
  private countryChartsPending: Promise<Track[]> | null = null
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

  /** Real per-country top songs (Apple Music most-played feed) matched to playable SC tracks. */
  async countryCharts(country: string): Promise<Track[]> {
    const cc = /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : ''
    if (!cc) return []
    const cached = this.countryChartsCache
    if (cached && cached.country === cc && Date.now() - cached.at < 45 * 60 * 1000)
      return cached.tracks
    if (this.countryChartsPending) return this.countryChartsPending
    this.countryChartsPending = this.buildCountryCharts(cc).finally(() => {
      this.countryChartsPending = null
    })
    return this.countryChartsPending
  }

  private async buildCountryCharts(cc: string): Promise<Track[]> {
    const res = await fetch(
      `https://rss.applemarketingtools.com/api/v2/${cc}/music/most-played/30/songs.json`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) throw new Error(`chart feed error ${res.status}`)
    const feed = (await res.json()) as { feed?: { results?: { artistName?: string; name?: string }[] } }
    const songs = (feed.feed?.results ?? [])
      .filter((s) => typeof s.artistName === 'string' && typeof s.name === 'string')
      .map((s) => ({ artist: s.artistName as string, title: s.name as string }))
    if (songs.length === 0) return []

    const resolveSong = async (song: { artist: string; title: string }): Promise<Track | null> => {
      try {
        const query = `${primaryArtist(song.artist)} ${cleanTitle(song.title)}`.trim().slice(0, 100)
        const raw = await this.client.api('/search/tracks', { q: query, limit: 10 })
        const entries = collectionOf(raw).filter(isRecord)
        const candidates: ChartCandidate[] = entries.map((entry) => {
          const user = isRecord(entry.user) ? entry.user : {}
          const transcodings = mapTranscodings(entry.media)
          return {
            id: typeof entry.id === 'number' ? entry.id : -1,
            title: typeof entry.title === 'string' ? entry.title : '',
            artist: typeof user.username === 'string' ? user.username : '',
            playbackCount: typeof entry.playback_count === 'number' ? entry.playback_count : 0,
            snipped: transcodings.length > 0 && transcodings.every((t) => t.snipped)
          }
        })
        const picked = pickChartMatch(song.artist, song.title, candidates)
        if (picked === null) return null
        return mapTrack(entries.find((entry) => entry.id === picked))
      } catch {
        return null
      }
    }

    const tracks: (Track | null)[] = []
    for (let i = 0; i < songs.length; i += 5) {
      const chunk = songs.slice(i, i + 5)
      tracks.push(...(await Promise.all(chunk.map(resolveSong))))
    }
    const seen = new Set<number>()
    const matched = tracks.filter((track): track is Track => {
      if (!track || seen.has(track.id)) return false
      seen.add(track.id)
      return true
    })
    log.info(`country charts ${cc}: matched ${matched.length}/${songs.length} songs on SoundCloud`)
    this.countryChartsCache = { country: cc, tracks: matched, at: Date.now() }
    return matched
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
    // api-v2 wants body/timestamp as query params (matches the web client's commentCreate)
    const raw = await this.client.api(
      `/tracks/${trackId}/comments`,
      { body, timestamp: timestampMs ?? 0 },
      { method: 'POST' }
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
    let source: StreamSource | null = null

    // On first load only: try the primary API for non-snipped tracks.
    // On retries (fresh=true) the primary CDN has already failed (geo-block or expiry) — skip it
    // and go straight to the widget bypass which uses a different CDN auth token.
    if (!fresh && !snippedOnly) {
      source = await this.resolveFrom(raw, quality)
    }

    // Widget API bypass: the embedded-player endpoint issues different CDN tokens that bypass
    // most geo-restrictions. Tried unconditionally on retries and whenever primary gave nothing.
    if ((!source || fresh) && this.regionUnblock) {
      try {
        const widgetRaw = await this.client.absolute(
          `https://api-widget.soundcloud.com/tracks/${trackId}`
        )
        const widgetSource = await this.resolveFrom(widgetRaw, quality, snippedOnly)
        if (widgetSource) {
          source = widgetSource
          log.info(`track ${trackId} resolved via widget api (${fresh ? 'retry' : 'geo-bypass'})`)
        }
      } catch (error) {
        log.warn(`widget bypass failed for ${trackId}: ${String(error)}`)
      }
    }

    // Widget gave nothing and this was a retry of a non-snipped track → try primary as last-resort
    // (could be a transient network hiccup rather than a geo-block).
    if (!source && fresh && !snippedOnly) {
      source = await this.resolveFrom(raw, quality)
    }

    // Track is snipped everywhere (Go+ / hard geo-block) → search for a clean full-length reupload.
    if (!source && this.regionUnblock) {
      source = await this.findFullAlternative(raw, quality)
      if (source) log.info(`track ${trackId} served via clean reupload`)
    }

    // Last resort: accept the official 30s preview and flag it for the UI
    if (!source && snippedOnly) {
      source = await this.resolveFrom(raw, quality)
      if (source) source = { ...source, preview: true }
    }

    if (!source) throw new Error('track is not playable in your region')

    this.streamCache.set(trackId, { source, at: Date.now() })
    if (this.streamCache.size > 40) {
      const first = this.streamCache.keys().next().value
      if (first !== undefined) this.streamCache.delete(first)
    }
    return source
  }

  private async findFullAlternative(
    raw: unknown,
    quality: StreamQuality
  ): Promise<StreamSource | null> {
    if (!isRecord(raw) || typeof raw.title !== 'string') return null
    const user = isRecord(raw.user) ? raw.user : {}
    const publisher = isRecord(raw.publisher_metadata) ? raw.publisher_metadata : {}
    // Prefer the publisher artist (real artist name) over the uploader's username
    const artist =
      (typeof publisher.artist === 'string' && publisher.artist.length > 0
        ? publisher.artist
        : typeof user.username === 'string'
          ? user.username
          : '')
    const original: AltOriginal = {
      id: typeof raw.id === 'number' ? raw.id : -1,
      title: raw.title,
      artist,
      fullDurationMs: typeof raw.full_duration === 'number' ? raw.full_duration : 0
    }
    if (original.fullDurationMs <= 0) return null

    const cleanedTitle = cleanTitle(raw.title).trim().slice(0, 80)
    // Multiple search queries in order of specificity: artist+title first, then title-only fallback
    const queries = [
      `${artist} ${cleanedTitle}`.trim().slice(0, 100),
      cleanedTitle
    ].filter((q, i, arr) => q.length >= 3 && arr.indexOf(q) === i)

    const seenIds = new Set<number>()
    for (const q of queries) {
      let results: unknown
      try {
        results = await this.client.api('/search/tracks', { q, limit: 50 })
      } catch {
        continue
      }
      const entries = collectionOf(results).filter(isRecord)
      const candidates: AltCandidate[] = entries
        .filter((entry) => {
          const id = typeof entry.id === 'number' ? entry.id : -1
          if (seenIds.has(id)) return false
          seenIds.add(id)
          return true
        })
        .map((entry) => {
          const u = isRecord(entry.user) ? entry.user : {}
          const transcodings = mapTranscodings(entry.media)
          return {
            id: typeof entry.id === 'number' ? entry.id : -1,
            title: typeof entry.title === 'string' ? entry.title : '',
            artist: typeof u.username === 'string' ? u.username : '',
            fullDurationMs: typeof entry.full_duration === 'number' ? entry.full_duration : 0,
            snipped: transcodings.length > 0 && transcodings.every((t) => t.snipped),
            policy: typeof entry.policy === 'string' ? entry.policy : '',
            playbackCount: typeof entry.playback_count === 'number' ? entry.playback_count : 0
          }
        })

      const pickedId = pickAlternative(original, candidates)
      if (pickedId !== null) {
        const pickedRaw = entries.find((entry) => entry.id === pickedId)
        const source = await this.resolveFrom(pickedRaw, quality, true)
        if (source) return { ...source, substituted: true }
      }
    }
    return null
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
