import { type Track } from './track'

export type RepeatMode = 'off' | 'all' | 'one'

export type MediaAction = 'play-pause' | 'next' | 'previous' | 'stop'

export interface StreamSource {
  url: string
  protocol: 'progressive' | 'hls'
  /** true when the only stream available is the official 30s Go+ preview */
  preview?: boolean
  /** true when we swapped in a clean full-length reupload of the same song */
  substituted?: boolean
}

export interface PresencePayload {
  title: string
  artist: string
  artworkUrl: string | null
  trackUrl: string
  durationSec: number
  positionSec: number
  playing: boolean
}

export interface PlaybackSnapshot {
  queue: Track[]
  originalQueue: Track[] | null
  index: number
  position: number
  shuffle: boolean
  repeat: RepeatMode
  savedAt: number
}

export interface SyncedLine {
  time: number
  text: string
}

export interface Lyrics {
  synced: SyncedLine[] | null
  plain: string | null
}

export type PlayerEvent =
  | { type: 'track'; track: Track | null }
  | { type: 'state'; playing: boolean }
  | { type: 'progress'; position: number; duration: number }
