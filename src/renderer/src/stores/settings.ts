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

const CUSTOM_PROPS = [
  '--accent-a',
  '--accent-b',
  '--accent-gradient',
  '--accent-soft',
  '--accent-text',
  '--glow',
  '--bg',
  '--bg-raised',
  '--blur',
  '--custom-bg',
  '--cv-a',
  '--cv-b',
  '--art-bg'
]

// vars exclusive to the custom theme; the art theme owns the accent vars via dynamic-theme
const CUSTOM_ONLY_PROPS = ['--bg', '--bg-raised', '--blur', '--custom-bg', '--cv-a', '--cv-b']

const hexRgb = (hex: string): { r: number; g: number; b: number } => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16)
})

function applyToDocument(settings: Settings): void {
  const root = document.documentElement
  root.dataset.accent = settings.appearance.accent
  root.dataset.glass = settings.appearance.glass
  root.dataset.motion = settings.appearance.motion
  root.style.fontSize = `${(settings.appearance.fontScale / 100) * 16}px`

  if (settings.appearance.accent === 'custom') {
    const theme = settings.appearance.custom
    const a = hexRgb(theme.colorA)
    const bg = hexRgb(theme.bgColor)
    const veilHi = Math.min(0.96, theme.dim / 100 + 0.18)
    const veilLo = Math.max(0.08, theme.dim / 100 - 0.14)
    const set = (prop: string, value: string): void => root.style.setProperty(prop, value)
    set('--accent-a', theme.colorA)
    set('--accent-b', theme.colorB)
    set('--accent-gradient', `linear-gradient(135deg, ${theme.colorA}, ${theme.colorB})`)
    set('--accent-soft', `rgba(${a.r}, ${a.g}, ${a.b}, 0.16)`)
    set('--accent-text', `color-mix(in srgb, ${theme.colorA} 42%, #ffffff)`)
    set('--glow', `0 0 44px rgba(${a.r}, ${a.g}, ${a.b}, 0.2)`)
    set('--bg', theme.bgColor)
    set('--bg-raised', `color-mix(in srgb, ${theme.bgColor} 86%, #ffffff)`)
    set('--blur', `${theme.blur}px`)
    set('--custom-bg', theme.background ? `url("${theme.background}")` : 'none')
    set('--cv-a', `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${veilHi})`)
    set('--cv-b', `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${veilLo})`)
  } else if (settings.appearance.accent === 'art') {
    // keep the accent vars managed by dynamic-theme; drop only custom leftovers
    for (const prop of CUSTOM_ONLY_PROPS) root.style.removeProperty(prop)
  } else {
    for (const prop of CUSTOM_PROPS) root.style.removeProperty(prop)
  }

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
