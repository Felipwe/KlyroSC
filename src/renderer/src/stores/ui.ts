import { create } from 'zustand'
import { type Track } from '@shared/types/track'
import { api } from '@renderer/services/ipc'

export interface MenuItem {
  id: string
  label: string
  icon?: string
  danger?: boolean
  action?: () => void
  submenuItems?: MenuItem[]
}

interface ContextMenuState {
  open: boolean
  x: number
  y: number
  items: MenuItem[]
}

interface ModalState {
  kind: 'confirm' | 'prompt'
  title: string
  body?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: (value: string) => void
}

interface UiState {
  queueOpen: boolean
  lyricsOpen: boolean
  miniMode: boolean
  menu: ContextMenuState
  modal: ModalState | null
  addToPlaylistTrack: Track[] | null
  toggleQueue(open?: boolean): void
  toggleLyrics(open?: boolean): void
  setMiniMode(on: boolean): void
  openMenu(x: number, y: number, items: MenuItem[]): void
  closeMenu(): void
  openModal(modal: ModalState): void
  closeModal(): void
  openAddToPlaylist(tracks: Track[]): void
  closeAddToPlaylist(): void
}

export const useUi = create<UiState>((set, get) => ({
  queueOpen: false,
  lyricsOpen: false,
  miniMode: false,
  menu: { open: false, x: 0, y: 0, items: [] },
  modal: null,
  addToPlaylistTrack: null,

  toggleQueue: (open) => set((state) => ({ queueOpen: open ?? !state.queueOpen, lyricsOpen: false })),
  toggleLyrics: (open) => set((state) => ({ lyricsOpen: open ?? !state.lyricsOpen, queueOpen: false })),

  setMiniMode: (on) => {
    if (get().miniMode === on) return
    set({ miniMode: on, queueOpen: false, lyricsOpen: false })
    void api.window.setMiniMode(on)
  },

  openMenu: (x, y, items) => set({ menu: { open: true, x, y, items } }),
  closeMenu: () => set((state) => (state.menu.open ? { menu: { ...state.menu, open: false } } : state)),

  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  openAddToPlaylist: (tracks) => set({ addToPlaylistTrack: tracks }),
  closeAddToPlaylist: () => set({ addToPlaylistTrack: null })
}))
