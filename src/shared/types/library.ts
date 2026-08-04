import { type Track } from './track'

export interface LibraryTrack {
  track: Track
  addedAt: number
}

export interface HistoryEntry {
  track: Track
  playedAt: number
}

export interface LocalPlaylist {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  cover: string | null
  tracks: Track[]
}

export interface LibraryData {
  favorites: LibraryTrack[]
  playlists: LocalPlaylist[]
  history: HistoryEntry[]
}

export const EMPTY_LIBRARY: LibraryData = {
  favorites: [],
  playlists: [],
  history: []
}
