export interface Transcoding {
  url: string
  protocol: 'progressive' | 'hls'
  mimeType: string
  quality: string
  snipped: boolean
}

export interface Track {
  id: number
  title: string
  artist: string
  /** Recording artist from publisher metadata; preferred for lyrics matching. */
  lyricsArtist?: string
  artistId: number
  artistUrl: string
  artistAvatar: string | null
  url: string
  artwork: string | null
  artworkSmall: string | null
  duration: number
  genre: string | null
  playCount: number
  likeCount: number
  createdAt: string
  snippet: boolean
  repostCount?: number
  commentCount?: number
  description?: string | null
  /** who queued this track in the current jam (display only) */
  jamAddedBy?: string
  /** true when Smart Shuffle injected this track as a recommendation */
  smartPick?: boolean
}

export interface TrackComment {
  id: number
  body: string
  createdAt: string
  /** seconds into the track, or null for untimed comments */
  timestamp: number | null
  userId: number
  userName: string
  userAvatar: string | null
}

export interface Artist {
  id: number
  name: string
  handle: string
  url: string
  avatar: string | null
  banner: string | null
  verified: boolean
  followers: number
  trackCount: number
  city: string | null
  description: string | null
}

export interface PlaylistLite {
  ref: string
  title: string
  artwork: string | null
  artist: string
  artistId: number
  trackCount: number
  isAlbum: boolean
}

export interface RemotePlaylist extends PlaylistLite {
  url: string
  description: string | null
  duration: number
  likeCount: number
  tracks: Track[]
  trackIds: number[]
}

export interface HomeSection {
  id: string
  title: string
  playlists: PlaylistLite[]
}

export interface Page<T> {
  items: T[]
  nextHref: string | null
}

export type SearchKind = 'tracks' | 'artists' | 'playlists'

export type ResolvedItem =
  | { kind: 'track'; track: Track }
  | { kind: 'playlist'; ref: string }
  | { kind: 'artist'; id: number }
  | { kind: 'unknown' }

export const isStoredTrack = (value: unknown): value is Track => {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'number' &&
    typeof t.title === 'string' &&
    typeof t.artist === 'string' &&
    typeof t.url === 'string' &&
    typeof t.duration === 'number'
  )
}
