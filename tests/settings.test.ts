import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from '../src/shared/types/settings'

describe('sanitizeSettings', () => {
  it('returns defaults for invalid input', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings(42)).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps numeric ranges', () => {
    const result = sanitizeSettings({
      playback: { volume: 4, fadeMs: -100 },
      appearance: { fontScale: 500 }
    })
    expect(result.playback.volume).toBe(1)
    expect(result.playback.fadeMs).toBe(0)
    expect(result.appearance.fontScale).toBe(120)
  })

  it('rejects unknown enum values', () => {
    const result = sanitizeSettings({
      language: 'de',
      appearance: { accent: 'neon', glass: 'ultra' },
      playback: { quality: 'flac' }
    })
    expect(result.language).toBe('auto')
    expect(result.appearance.accent).toBe('yagami')
    expect(result.appearance.glass).toBe('medium')
    expect(result.playback.quality).toBe('auto')
  })

  it('validates the discord client id format', () => {
    expect(sanitizeSettings({ discord: { clientId: 'abc' } }).discord.clientId).toBe('')
    expect(sanitizeSettings({ discord: { clientId: '123' } }).discord.clientId).toBe('')
    const valid = '1234567890123456789'
    expect(sanitizeSettings({ discord: { clientId: valid } }).discord.clientId).toBe(valid)
  })

  it('preserves valid values', () => {
    const result = sanitizeSettings({
      language: 'pt',
      appearance: { accent: 'ember', glass: 'high', motion: 'reduced', fontScale: 105 },
      system: { closeToTray: false }
    })
    expect(result.language).toBe('pt')
    expect(result.appearance).toEqual({ accent: 'ember', glass: 'high', motion: 'reduced', fontScale: 105 })
    expect(result.system.closeToTray).toBe(false)
  })
})

describe('mergeSettings', () => {
  it('deep merges patches without touching other branches', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { playback: { volume: 0.4 } })
    expect(merged.playback.volume).toBe(0.4)
    expect(merged.playback.autoplayRelated).toBe(DEFAULT_SETTINGS.playback.autoplayRelated)
    expect(merged.appearance).toEqual(DEFAULT_SETTINGS.appearance)
  })

  it('sanitizes merged output', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { playback: { volume: 99 } })
    expect(merged.playback.volume).toBe(1)
  })
})
