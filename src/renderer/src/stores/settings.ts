import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types/settings'
import { type DeepPartial } from '@shared/types/result'
import { api } from '@renderer/services/ipc'
import { applyLanguage } from '@renderer/i18n'

interface SettingsState {
  settings: Settings
  loaded: boolean
  load(): Promise<void>
  update(patch: DeepPartial<Settings>): Promise<void>
  reset(): Promise<void>
}

function applyToDocument(settings: Settings): void {
  const root = document.documentElement
  root.dataset.accent = settings.appearance.accent
  root.dataset.glass = settings.appearance.glass
  root.dataset.motion = settings.appearance.motion
  root.style.fontSize = `${(settings.appearance.fontScale / 100) * 16}px`
  applyLanguage(settings.language)
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    if (get().loaded) return
    const settings = await api.settings.get()
    applyToDocument(settings)
    set({ settings, loaded: true })
    api.settings.onChange((next) => {
      applyToDocument(next)
      set({ settings: next })
    })
  },
  update: async (patch) => {
    const settings = await api.settings.set(patch)
    applyToDocument(settings)
    set({ settings })
  },
  reset: async () => {
    const settings = await api.settings.reset()
    applyToDocument(settings)
    set({ settings })
  }
}))
