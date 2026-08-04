import { isRecord } from '@shared/types/result'
import {
  type Artist,
  type PlaylistLite,
  type RemotePlaylist,
  type Track
} from '@shared/types/track'
import { type Transcoding } from '@shared/types/track'

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

export const artworkUrl = (url: string | null, size: 't500x500' | 't120x120'): string | null =>
  url ? url.replace(/-(large|t\d+x\d+)(\.\w+)$/, `-${size}$2`) : null

export function mapTranscodings(raw: unknown): Transcoding[] {
  if (!isRecord(raw) || !Array.isArray(raw.transcodings)) return []
  const out: Transcoding[] = []
  for (const t of raw.transcodings) {
    if (!isRecord(t) || typeof t.url !== 'string') continue
    const format = isRecord(t.format) ? t.format : {}
    const protocol = format.protocol === 'progressive' ? 'progressive' : 'hls'
    out.push({
      url: t.url,
      protocol,
      mimeType: str(format.mime_type) ?? 'audio/mpeg',
      quality: str(t.quality) ?? 'sq'
    })
  }
  return out
}

export function mapTrack(raw: unknown): Track | null {
  if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.title !== 'string') return null
  const user = isRecord(raw.user) ? raw.user : {}
  const art = str(raw.artwork_url) ?? str(user.avatar_url)
  const duration = int(raw.full_duration) || int(raw.duration)
  return {
    id: raw.id,
    title: raw.title,
    artist: str(user.username) ?? 'Unknown artist',
    artistId: int(user.id),
    artistUrl: str(user.permalink_url) ?? '',
    artistAvatar: artworkUrl(str(user.avatar_url), 't120x120'),
    url: str(raw.permalink_url) ?? '',
    artwork: artworkUrl(art, 't500x500'),
    artworkSmall: artworkUrl(art, 't120x120'),
    duration: Math.round(duration / 1000),
    genre: str(raw.genre),
    playCount: int(raw.playback_count),
    likeCount: int(raw.likes_count),
    createdAt: str(raw.created_at) ?? '',
    snippet:
      raw.policy === 'SNIP' ||
      (int(raw.duration) > 0 && int(raw.full_duration) > int(raw.duration) * 1.5)
  }
}

export function mapArtist(raw: unknown): Artist | null {
  if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.username !== 'string') return null
  const visuals = isRecord(raw.visuals) && Array.isArray(raw.visuals.visuals) ? raw.visuals.visuals : []
  const firstVisual = visuals.find((v): v is Record<string, unknown> => isRecord(v))
  return {
    id: raw.id,
    name: raw.username,
    handle: str(raw.permalink) ?? '',
    url: str(raw.permalink_url) ?? '',
    avatar: artworkUrl(str(raw.avatar_url), 't500x500'),
    banner: firstVisual ? str(firstVisual.visual_url) : null,
    verified: raw.verified === true,
    followers: int(raw.followers_count),
    trackCount: int(raw.track_count),
    city: str(raw.city),
    description: str(raw.description)
  }
}

export function playlistRef(raw: Record<string, unknown>): string {
  if (typeof raw.id === 'number') return String(raw.id)
  return str(raw.urn) ?? str(raw.id as string) ?? ''
}

export function mapPlaylistLite(raw: unknown): PlaylistLite | null {
  if (!isRecord(raw) || typeof raw.title !== 'string') return null
  const ref = playlistRef(raw)
  if (!ref) return null
  const user = isRecord(raw.user) ? raw.user : {}
  const art = str(raw.artwork_url) ?? str(raw.calculated_artwork_url)
  const trackCount = int(raw.track_count) || (Array.isArray(raw.tracks) ? raw.tracks.length : 0)
  return {
    ref,
    title: raw.title,
    artwork: artworkUrl(art, 't500x500'),
    artist: str(user.username) ?? (raw.kind === 'system-playlist' ? 'SoundCloud' : ''),
    artistId: int(user.id),
    trackCount,
    isAlbum: raw.is_album === true
  }
}

export function mapPlaylist(raw: unknown): RemotePlaylist | null {
  const lite = mapPlaylistLite(raw)
  if (!lite || !isRecord(raw)) return null
  const tracksRaw = Array.isArray(raw.tracks) ? raw.tracks : []
  const tracks: Track[] = []
  const trackIds: number[] = []
  for (const t of tracksRaw) {
    if (!isRecord(t) || typeof t.id !== 'number') continue
    trackIds.push(t.id)
    const mapped = mapTrack(t)
    if (mapped) tracks.push(mapped)
  }
  return {
    ...lite,
    url: str(raw.permalink_url) ?? '',
    description: str(raw.description),
    duration: Math.round(int(raw.duration) / 1000),
    likeCount: int(raw.likes_count),
    tracks,
    trackIds,
    trackCount: lite.trackCount || trackIds.length
  }
}

export function collectionOf(raw: unknown): unknown[] {
  if (!isRecord(raw)) return []
  return Array.isArray(raw.collection) ? raw.collection : []
}

export function nextHrefOf(raw: unknown): string | null {
  if (!isRecord(raw)) return null
  return typeof raw.next_href === 'string' ? raw.next_href : null
}
