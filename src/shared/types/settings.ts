import { isRecord, type DeepPartial } from './result'
import { EQ_GAIN_LIMIT, sanitizeEqGains, type EqCustomPreset } from '../utils/eq'

export type LanguageSetting = 'auto' | 'en' | 'pt'
export type AccentId = 'art' | 'yagami' | 'custom'
export type GlassLevel = 'low' | 'medium' | 'high'
export type MotionLevel = 'full' | 'reduced'
export type StreamQuality = 'auto' | 'progressive' | 'hls'

export interface CustomTheme {
  colorA: string
  colorB: string
  bgColor: string
  background: string | null
  blur: number
  dim: number
  syncIcon: boolean
}

export interface ThemeProfile {
  name: string
  theme: CustomTheme
}

export interface Settings {
  language: LanguageSetting
  appearance: {
    accent: AccentId
    glass: GlassLevel
    motion: MotionLevel
    fontScale: number
    custom: CustomTheme
    profiles: ThemeProfile[]
  }
  playback: {
    volume: number
    muted: boolean
    autoplayRelated: boolean
    resumeOnLaunch: boolean
    quality: StreamQuality
    fadeMs: number
  }
  eq: {
    enabled: boolean
    preamp: number
    gains: number[]
    custom: EqCustomPreset[]
  }
  discord: {
    enabled: boolean
    showButtons: boolean
    clientId: string
  }
  updates: {
    autoCheck: boolean
    autoDownload: boolean
  }
  performance: {
    hardwareAcceleration: boolean
    backgroundThrottling: boolean
  }
  startup: {
    launchAtLogin: boolean
    startMinimized: boolean
    restoreSession: boolean
  }
  system: {
    closeToTray: boolean
    globalMediaKeys: boolean
    lastSeenVersion: string
    artThemeMigrated: boolean
  }
}

export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  colorA: '#b31423',
  colorB: '#e5484d',
  bgColor: '#0a0b12',
  background: null,
  blur: 24,
  dim: 62,
  syncIcon: true
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  appearance: {
    accent: 'art',
    glass: 'medium',
    motion: 'full',
    fontScale: 100,
    custom: { ...DEFAULT_CUSTOM_THEME },
    profiles: []
  },
  playback: {
    volume: 0.8,
    muted: false,
    autoplayRelated: true,
    resumeOnLaunch: true,
    quality: 'auto',
    fadeMs: 220
  },
  eq: {
    enabled: false,
    preamp: 0,
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    custom: []
  },
  discord: {
    enabled: true,
    showButtons: true,
    clientId: ''
  },
  updates: {
    autoCheck: true,
    autoDownload: true
  },
  performance: {
    hardwareAcceleration: true,
    backgroundThrottling: true
  },
  startup: {
    launchAtLogin: false,
    startMinimized: false,
    restoreSession: true
  },
  system: {
    closeToTray: true,
    globalMediaKeys: false,
    lastSeenVersion: '',
    artThemeMigrated: false
  }
}

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const num = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback

const str = (value: unknown, fallback: string, maxLen = 200): string =>
  typeof value === 'string' ? value.slice(0, maxLen) : fallback

const HEX_RE = /^#[0-9a-f]{6}$/i

const hexColor = (value: unknown, fallback: string): string =>
  typeof value === 'string' && HEX_RE.test(value) ? value.toLowerCase() : fallback

export function sanitizeCustomTheme(raw: unknown): CustomTheme {
  const r = isRecord(raw) ? raw : {}
  const d = DEFAULT_CUSTOM_THEME
  return {
    colorA: hexColor(r.colorA, d.colorA),
    colorB: hexColor(r.colorB, d.colorB),
    bgColor: hexColor(r.bgColor, d.bgColor),
    background:
      typeof r.background === 'string' &&
      r.background.startsWith('data:image/') &&
      r.background.length < 2_400_000
        ? r.background
        : null,
    blur: num(r.blur, 0, 48, d.blur),
    dim: num(r.dim, 0, 95, d.dim),
    syncIcon: bool(r.syncIcon, d.syncIcon)
  }
}

function sanitizeProfiles(raw: unknown): ThemeProfile[] {
  if (!Array.isArray(raw)) return []
  const profiles: ThemeProfile[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.name !== 'string') continue
    const name = entry.name.trim().slice(0, 40)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    profiles.push({ name, theme: sanitizeCustomTheme(entry.theme) })
    if (profiles.length >= 40) break
  }
  return profiles
}

function sanitizeEqCustom(raw: unknown): EqCustomPreset[] {
  if (!Array.isArray(raw)) return []
  const presets: EqCustomPreset[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.name !== 'string') continue
    const name = entry.name.trim().slice(0, 40)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    presets.push({ name, gains: sanitizeEqGains(entry.gains) })
    if (presets.length >= 200) break
  }
  return presets
}

export function sanitizeSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {}
  const d = DEFAULT_SETTINGS
  const appearance = isRecord(r.appearance) ? r.appearance : {}
  const playback = isRecord(r.playback) ? r.playback : {}
  const eq = isRecord(r.eq) ? r.eq : {}
  const discord = isRecord(r.discord) ? r.discord : {}
  const updates = isRecord(r.updates) ? r.updates : {}
  const performance = isRecord(r.performance) ? r.performance : {}
  const startup = isRecord(r.startup) ? r.startup : {}
  const system = isRecord(r.system) ? r.system : {}

  const clientId = str(discord.clientId, d.discord.clientId, 32)

  return {
    language: oneOf(r.language, ['auto', 'en', 'pt'] as const, d.language),
    appearance: {
      accent: oneOf(appearance.accent, ['art', 'yagami', 'custom'] as const, d.appearance.accent),
      glass: oneOf(appearance.glass, ['low', 'medium', 'high'] as const, d.appearance.glass),
      motion: oneOf(appearance.motion, ['full', 'reduced'] as const, d.appearance.motion),
      fontScale: num(appearance.fontScale, 85, 120, d.appearance.fontScale),
      custom: sanitizeCustomTheme(appearance.custom),
      profiles: sanitizeProfiles(appearance.profiles)
    },
    playback: {
      volume: num(playback.volume, 0, 1, d.playback.volume),
      muted: bool(playback.muted, d.playback.muted),
      autoplayRelated: bool(playback.autoplayRelated, d.playback.autoplayRelated),
      resumeOnLaunch: bool(playback.resumeOnLaunch, d.playback.resumeOnLaunch),
      quality: oneOf(
        playback.quality,
        ['auto', 'progressive', 'hls'] as const,
        d.playback.quality
      ),
      fadeMs: num(playback.fadeMs, 0, 1000, d.playback.fadeMs)
    },
    eq: {
      enabled: bool(eq.enabled, d.eq.enabled),
      preamp: num(eq.preamp, -EQ_GAIN_LIMIT, EQ_GAIN_LIMIT, d.eq.preamp),
      gains: sanitizeEqGains(eq.gains),
      custom: sanitizeEqCustom(eq.custom)
    },
    discord: {
      enabled: bool(discord.enabled, d.discord.enabled),
      showButtons: bool(discord.showButtons, d.discord.showButtons),
      clientId: /^\d{15,21}$/.test(clientId) ? clientId : ''
    },
    updates: {
      autoCheck: bool(updates.autoCheck, d.updates.autoCheck),
      autoDownload: bool(updates.autoDownload, d.updates.autoDownload)
    },
    performance: {
      hardwareAcceleration: bool(performance.hardwareAcceleration, d.performance.hardwareAcceleration),
      backgroundThrottling: bool(performance.backgroundThrottling, d.performance.backgroundThrottling)
    },
    startup: {
      launchAtLogin: bool(startup.launchAtLogin, d.startup.launchAtLogin),
      startMinimized: bool(startup.startMinimized, d.startup.startMinimized),
      restoreSession: bool(startup.restoreSession, d.startup.restoreSession)
    },
    system: {
      closeToTray: bool(system.closeToTray, d.system.closeToTray),
      globalMediaKeys: bool(system.globalMediaKeys, d.system.globalMediaKeys),
      lastSeenVersion: str(system.lastSeenVersion, d.system.lastSeenVersion, 20),
      artThemeMigrated: bool(system.artThemeMigrated, d.system.artThemeMigrated)
    }
  }
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = out[key]
    if (isRecord(current) && isRecord(value)) out[key] = deepMerge(current, value)
    else out[key] = value
  }
  return out
}

export function mergeSettings(base: Settings, patch: DeepPartial<Settings>): Settings {
  return sanitizeSettings(deepMerge(base as unknown as Record<string, unknown>, patch as Record<string, unknown>))
}
