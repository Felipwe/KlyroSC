import { create } from 'zustand'
import { EMPTY_LIBRARY, type LibraryData } from '@shared/types/library'
import { type Track } from '@shared/types/track'
import { api } from '@renderer/services/ipc'
import { toast } from './toasts'
import { t } from '@renderer/i18n'

interface LibraryState {
  data: LibraryData
  loaded: boolean
  favoriteIds: Set<number>
  load(): Promise<void>
  toggleFavorite(track: Track): Promise<void>
  createPlaylist(name: string): Promise<void>
  renamePlaylist(id: string, name: string): Promise<void>
  deletePlaylist(id: string): Promise<void>
  setPlaylistCover(id: string): Promise<void>
  removePlaylistCover(id: string): Promise<void>
  addToPlaylist(id: string, tracks: Track[]): Promise<void>
  removeFromPlaylist(id: string, index: number): Promise<void>
  moveInPlaylist(id: string, from: number, to: number): Promise<void>
  movePlaylist(from: number, to: number): Promise<void>
  addHistory(track: Track): void
  clearHistory(): Promise<void>
}

const favoriteIdsOf = (data: LibraryData): Set<number> =>
  new Set(data.favorites.map((favorite) => favorite.track.id))

export const useLibrary = create<LibraryState>((set, get) => ({
  data: EMPTY_LIBRARY,
  loaded: false,
  favoriteIds: new Set<number>(),

  load: async () => {
    const data = await api.library.get()
    set({ data, loaded: true, favoriteIds: favoriteIdsOf(data) })
  },

  toggleFavorite: async (track) => {
    const wasFavorite = get().favoriteIds.has(track.id)
    const data = await api.library.toggleFavorite(track)
    set({ data, favoriteIds: favoriteIdsOf(data) })
    toast(wasFavorite ? t('toast.favoriteRemoved') : t('toast.favoriteAdded'), 'success')
  },

  createPlaylist: async (name) => {
    const data = await api.library.createPlaylist(name)
    set({ data, favoriteIds: favoriteIdsOf(data) })
    toast(t('toast.playlistCreated', { name }), 'success')
  },

  renamePlaylist: async (id, name) => {
    const data = await api.library.renamePlaylist(id, name)
    set({ data })
  },

  deletePlaylist: async (id) => {
    const data = await api.library.deletePlaylist(id)
    set({ data })
    toast(t('toast.playlistDeleted'))
  },

  setPlaylistCover: async (id) => {
    const result = await api.library.setPlaylistCover(id)
    if (!result.ok) {
      toast(t('playlists.coverFailed', { error: result.error }), 'error')
      return
    }
    if (result.data) set({ data: result.data })
  },

  removePlaylistCover: async (id) => {
    const data = await api.library.removePlaylistCover(id)
    set({ data })
  },

  addToPlaylist: async (id, tracks) => {
    const data = await api.library.addToPlaylist(id, tracks)
    set({ data })
    const playlist = data.playlists.find((p) => p.id === id)
    if (playlist) toast(t('toast.addedToPlaylist', { name: playlist.name }), 'success')
  },

  removeFromPlaylist: async (id, index) => {
    const data = await api.library.removeFromPlaylist(id, index)
    set({ data })
  },

  moveInPlaylist: async (id, from, to) => {
    const data = await api.library.moveInPlaylist(id, from, to)
    set({ data })
  },

  movePlaylist: async (from, to) => {
    // optimistic reorder so the drop feels instant
    const current = get().data
    const playlists = [...current.playlists]
    const [moved] = playlists.splice(from, 1)
    if (moved) {
      playlists.splice(to, 0, moved)
      set({ data: { ...current, playlists } })
    }
    const data = await api.library.movePlaylist(from, to)
    set({ data })
  },

  addHistory: (track) => {
    void api.library.addHistory(track).then((data) => set({ data }))
  },

  clearHistory: async () => {
    const data = await api.library.clearHistory()
    set({ data })
    toast(t('toast.historyCleared'))
  }
}))
