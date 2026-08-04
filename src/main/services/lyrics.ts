import { LRCLIB_API } from '@shared/constants'
import { type Lyrics } from '@shared/types/player'
import { isRecord } from '@shared/types/result'
import { parseLrc } from '@shared/utils/lrc'
import {
  buildLyricsQueries,
  pickBestIndex,
  splitDashTitle,
  cleanTitle,
  type CandidateMeta
} from '@shared/utils/lyrics-query'

const SEARCH_API = LRCLIB_API.replace(/\/get$/, '/search')
const HEADERS = { 'User-Agent': 'KlyroSC (https://github.com/Felipwe/KlyroSC)' }

const cache = new Map<string, Lyrics>()

const toLyrics = (raw: unknown): Lyrics | null => {
  if (!isRecord(raw)) return null
  const synced = typeof raw.syncedLyrics === 'string' ? parseLrc(raw.syncedLyrics) : []
  const plain =
    typeof raw.plainLyrics === 'string' && raw.plainLyrics.trim() ? raw.plainLyrics : null
  if (synced.length === 0 && !plain) return null
  return { synced: synced.length > 0 ? synced : null, plain }
}

async function lrclibGet(artist: string, title: string, duration: number): Promise<Lyrics | null> {
  const url = new URL(LRCLIB_API)
  url.searchParams.set('artist_name', artist)
  url.searchParams.set('track_name', title)
  if (duration > 0) url.searchParams.set('duration', String(duration))
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`lyrics service error ${res.status}`)
  return toLyrics(await res.json())
}

async function lrclibSearch(params: Record<string, string>): Promise<unknown[]> {
  const url = new URL(SEARCH_API)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return []
  const raw: unknown = await res.json()
  return Array.isArray(raw) ? raw : []
}

function pickFromSearch(records: unknown[], title: string, duration: number): Lyrics | null {
  const metas: CandidateMeta[] = records.map((record) => {
    const r = isRecord(record) ? record : {}
    return {
      title: typeof r.trackName === 'string' ? r.trackName : '',
      artist: typeof r.artistName === 'string' ? r.artistName : '',
      duration: typeof r.duration === 'number' ? r.duration : 0,
      hasSynced: typeof r.syncedLyrics === 'string' && r.syncedLyrics.length > 0,
      hasPlain: typeof r.plainLyrics === 'string' && r.plainLyrics.trim().length > 0
    }
  })
  const index = pickBestIndex(metas, title, duration)
  return index >= 0 ? toLyrics(records[index]) : null
}

export async function fetchLyrics(artist: string, title: string, duration: number): Promise<Lyrics> {
  const key = `${artist}::${title}::${duration}`.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const store = (lyrics: Lyrics): Lyrics => {
    cache.set(key, lyrics)
    if (cache.size > 80) {
      const first = cache.keys().next().value
      if (first !== undefined) cache.delete(first)
    }
    return lyrics
  }

  let plainFallback: Lyrics | null = null
  const keep = (lyrics: Lyrics | null): Lyrics | null => {
    if (lyrics?.synced) return lyrics
    if (lyrics && !plainFallback) plainFallback = lyrics
    return null
  }

  try {
    for (const query of buildLyricsQueries(artist, title)) {
      const hit = keep(await lrclibGet(query.artist, query.title, duration))
      if (hit) return store(hit)
    }

    const primary = buildLyricsQueries(artist, title)[0]
    if (primary) {
      const bySignature = keep(
        pickFromSearch(
          await lrclibSearch({ track_name: primary.title, artist_name: primary.artist }),
          title,
          duration
        )
      )
      if (bySignature) return store(bySignature)

      const split = splitDashTitle(cleanTitle(title))
      const freeQuery = split ? `${split.artist} ${split.title}` : `${primary.artist} ${primary.title}`
      const byQuery = keep(pickFromSearch(await lrclibSearch({ q: freeQuery }), title, duration))
      if (byQuery) return store(byQuery)

      const byTitleOnly = keep(
        pickFromSearch(await lrclibSearch({ q: split ? split.title : primary.title }), title, duration)
      )
      if (byTitleOnly) return store(byTitleOnly)
    }
  } catch (error) {
    if (!plainFallback) throw error
  }

  return store(plainFallback ?? { synced: null, plain: null })
}
