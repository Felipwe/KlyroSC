import { isRecord, type DeepPartial } from './result'

export type LanguageSetting = 'auto' | 'en' | 'pt'
export type AccentId = 'yagami' | 'aurora' | 'ember' | 'ocean' | 'orchid' | 'mint'
export type GlassLevel = 'low' | 'medium' | 'high'
export type MotionLevel = 'full' | 'reduced'
export type StreamQuality = 'auto' | 'progressive' | 'hls'

export interface Settings {
  language: LanguageSetting
  appearance: {
    accent: AccentId
    glass: GlassLevel
    motion: MotionLevel
    fontScale: number
  }
  playback: {
    volume: number
    muted: boolean
    autoplayRelated: boolean
    resumeOnLaunch: boolean
    quality: StreamQuality
    fadeMs: number
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
  }
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  appearance: {
    accent: 'yagami',
    glass: 'medium',
    motion: 'full',
    fontScale: 100
  },
  playback: {
    volume: 0.8,
    muted: false,
    autoplayRelated: true,
    resumeOnLaunch: true,
    quality: 'auto',
    fadeMs: 220
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
    globalMediaKeys: false
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

export function sanitizeSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {}
  const d = DEFAULT_SETTINGS
  const appearance = isRecord(r.appearance) ? r.appearance : {}
  const playback = isRecord(r.playback) ? r.playback : {}
  const discord = isRecord(r.discord) ? r.discord : {}
  const updates = isRecord(r.updates) ? r.updates : {}
  const performance = isRecord(r.performance) ? r.performance : {}
  const startup = isRecord(r.startup) ? r.startup : {}
  const system = isRecord(r.system) ? r.system : {}

  const clientId = str(discord.clientId, d.discord.clientId, 32)

  return {
    language: oneOf(r.language, ['auto', 'en', 'pt'] as const, d.language),
    appearance: {
      accent: oneOf(
        appearance.accent,
        ['yagami', 'aurora', 'ember', 'ocean', 'orchid', 'mint'] as const,
        d.appearance.accent
      ),
      glass: oneOf(appearance.glass, ['low', 'medium', 'high'] as const, d.appearance.glass),
      motion: oneOf(appearance.motion, ['full', 'reduced'] as const, d.appearance.motion),
      fontScale: num(appearance.fontScale, 85, 120, d.appearance.fontScale)
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
      globalMediaKeys: bool(system.globalMediaKeys, d.system.globalMediaKeys)
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
