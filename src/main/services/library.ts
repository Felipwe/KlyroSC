import { randomUUID } from 'node:crypto'
import { EMPTY_LIBRARY, type HistoryEntry, type LibraryData, type LibraryTrack, type LocalPlaylist } from '@shared/types/library'
import { isStoredTrack, type Track } from '@shared/types/track'
import { isRecord } from '@shared/types/result'
import { HISTORY_LIMIT } from '@shared/constants'
import { JsonStore } from '../core/store'
import { paths } from '../core/paths'

function sanitizeLibrary(raw: unknown): LibraryData {
  if (!isRecord(raw)) return structuredClone(EMPTY_LIBRARY)
  const favorites: LibraryTrack[] = []
  if (Array.isArray(raw.favorites)) {
    for (const f of raw.favorites) {
      if (isRecord(f) && isStoredTrack(f.track) && typeof f.addedAt === 'number')
        favorites.push({ track: f.track, addedAt: f.addedAt })
    }
  }
  const playlists: LocalPlaylist[] = []
  if (Array.isArray(raw.playlists)) {
    for (const p of raw.playlists) {
      if (!isRecord(p) || typeof p.id !== 'string' || typeof p.name !== 'string') continue
      const tracks = Array.isArray(p.tracks) ? p.tracks.filter(isStoredTrack) : []
      const cover =
        typeof p.cover === 'string' && p.cover.startsWith('data:image/') && p.cover.length < 600_000
          ? p.cover
          : null
      playlists.push({
        id: p.id,
        name: p.name.slice(0, 120),
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
        cover,
        tracks
      })
    }
  }
  const history: HistoryEntry[] = []
  if (Array.isArray(raw.history)) {
    for (const h of raw.history) {
      if (isRecord(h) && isStoredTrack(h.track) && typeof h.playedAt === 'number')
        history.push({ track: h.track, playedAt: h.playedAt })
    }
  }
  return { favorites, playlists, history: history.slice(0, HISTORY_LIMIT) }
}

export class LibraryService {
  private store = new JsonStore<LibraryData>(paths.libraryFile(), sanitizeLibrary, 600)

  get(): LibraryData {
    return this.store.get()
  }

  private mutate(fn: (data: LibraryData) => void): LibraryData {
    const data = structuredClone(this.store.get())
    fn(data)
    this.store.set(data)
    return data
  }

  toggleFavorite(track: Track): LibraryData {
    return this.mutate((data) => {
      const index = data.favorites.findIndex((f) => f.track.id === track.id)
      if (index >= 0) data.favorites.splice(index, 1)
      else data.favorites.unshift({ track, addedAt: Date.now() })
    })
  }

  mergeFavorites(tracks: Track[]): LibraryData {
    return this.mutate((data) => {
      const existing = new Set(data.favorites.map((f) => f.track.id))
      const now = Date.now()
      for (const track of tracks) {
        if (!existing.has(track.id)) {
          existing.add(track.id)
          data.favorites.push({ track, addedAt: now })
        }
      }
    })
  }

  createPlaylist(name: string): LibraryData {
    return this.mutate((data) => {
      const now = Date.now()
      data.playlists.unshift({
        id: randomUUID(),
        name: name.trim().slice(0, 120) || 'Playlist',
        createdAt: now,
        updatedAt: now,
        cover: null,
        tracks: []
      })
    })
  }

  setPlaylistCover(id: string, cover: string | null): LibraryData {
    return this.mutate((data) => {
      const playlist = data.playlists.find((p) => p.id === id)
      if (playlist) {
        playlist.cover = cover
        playlist.updatedAt = Date.now()
      }
    })
  }

  renamePlaylist(id: string, name: string): LibraryData {
    return this.mutate((data) => {
      const playlist = data.playlists.find((p) => p.id === id)
      if (playlist) {
        playlist.name = name.trim().slice(0, 120) || playlist.name
        playlist.updatedAt = Date.now()
      }
    })
  }

  deletePlaylist(id: string): LibraryData {
    return this.mutate((data) => {
      data.playlists = data.playlists.filter((p) => p.id !== id)
    })
  }

  addToPlaylist(id: string, tracks: Track[]): LibraryData {
    return this.mutate((data) => {
      const playlist = data.playlists.find((p) => p.id === id)
      if (!playlist) return
      for (const track of tracks) {
        if (!playlist.tracks.some((t) => t.id === track.id)) playlist.tracks.push(track)
      }
      playlist.updatedAt = Date.now()
    })
  }

  removeFromPlaylist(id: string, index: number): LibraryData {
    return this.mutate((data) => {
      const playlist = data.playlists.find((p) => p.id === id)
      if (playlist && index >= 0 && index < playlist.tracks.length) {
        playlist.tracks.splice(index, 1)
        playlist.updatedAt = Date.now()
      }
    })
  }

  moveInPlaylist(id: string, from: number, to: number): LibraryData {
    return this.mutate((data) => {
      const playlist = data.playlists.find((p) => p.id === id)
      if (!playlist) return
      const len = playlist.tracks.length
      if (from < 0 || from >= len || to < 0 || to >= len || from === to) return
      const [moved] = playlist.tracks.splice(from, 1)
      if (moved) {
        playlist.tracks.splice(to, 0, moved)
        playlist.updatedAt = Date.now()
      }
    })
  }

  addHistory(track: Track): LibraryData {
    return this.mutate((data) => {
      const last = data.history[0]
      if (last && last.track.id === track.id && Date.now() - last.playedAt < 60_000) return
      data.history.unshift({ track, playedAt: Date.now() })
      if (data.history.length > HISTORY_LIMIT) data.history.length = HISTORY_LIMIT
    })
  }

  clearHistory(): LibraryData {
    return this.mutate((data) => {
      data.history = []
    })
  }

  serialize(): string {
    return JSON.stringify(this.store.get(), null, 2)
  }

  replace(raw: unknown): LibraryData {
    const data = sanitizeLibrary(raw)
    this.store.set(data)
    return data
  }

  flush(): void {
    this.store.flush()
  }
}
