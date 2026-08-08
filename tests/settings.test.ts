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
    expect(result.appearance.accent).toBe('art')
    expect(result.appearance.glass).toBe('medium')
    expect(result.playback.quality).toBe('auto')
  })

  it('maps legacy accents to the art default and keeps the valid ones', () => {
    expect(sanitizeSettings({ appearance: { accent: 'aurora' } }).appearance.accent).toBe('art')
    expect(sanitizeSettings({ appearance: { accent: 'mint' } }).appearance.accent).toBe('art')
    expect(sanitizeSettings({ appearance: { accent: 'yagami' } }).appearance.accent).toBe('yagami')
    expect(sanitizeSettings({ appearance: { accent: 'custom' } }).appearance.accent).toBe('custom')
  })

  it('sanitizes the custom theme and profiles', () => {
    const result = sanitizeSettings({
      appearance: {
        accent: 'custom',
        custom: {
          colorA: '#FF00aa',
          colorB: 'red',
          bgColor: '#123',
          background: 'https://evil.example/x.png',
          blur: 400,
          dim: -5,
          syncIcon: false
        },
        profiles: [
          { name: '  Meu Tema  ', theme: { colorA: '#112233' } },
          { name: 'meu tema', theme: {} },
          { name: '', theme: {} },
          'junk'
        ]
      }
    })
    expect(result.appearance.custom.colorA).toBe('#ff00aa')
    expect(result.appearance.custom.colorB).toBe('#e5484d')
    expect(result.appearance.custom.bgColor).toBe('#0a0b12')
    expect(result.appearance.custom.background).toBeNull()
    expect(result.appearance.custom.blur).toBe(48)
    expect(result.appearance.custom.dim).toBe(0)
    expect(result.appearance.custom.syncIcon).toBe(false)
    expect(result.appearance.profiles).toHaveLength(1)
    expect(result.appearance.profiles[0]?.name).toBe('Meu Tema')
    expect(result.appearance.profiles[0]?.theme.colorA).toBe('#112233')
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
      appearance: { accent: 'custom', glass: 'high', motion: 'reduced', fontScale: 105 },
      system: { closeToTray: false }
    })
    expect(result.language).toBe('pt')
    expect(result.appearance.accent).toBe('custom')
    expect(result.appearance.glass).toBe('high')
    expect(result.appearance.motion).toBe('reduced')
    expect(result.appearance.fontScale).toBe(105)
    expect(result.system.closeToTray).toBe(false)
  })

  it('sanitizes home customization lists', () => {
    const result = sanitizeSettings({
      home: {
        hiddenSections: ['quick', 'quick', 42, '  trending  ', ''],
        order: ['sc:a', 'pinned', 'sc:a']
      }
    })
    expect(result.home.hiddenSections).toEqual(['quick', 'trending'])
    expect(result.home.order).toEqual(['sc:a', 'pinned'])
    expect(sanitizeSettings({}).home).toEqual({ hiddenSections: [], order: [] })
    expect(sanitizeSettings({ home: { order: 'nope' } }).home.order).toEqual([])
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

  it('replaces home lists wholesale instead of merging them', () => {
    const base = mergeSettings(DEFAULT_SETTINGS, { home: { hiddenSections: ['quick', 'trending'] } })
    const next = mergeSettings(base, { home: { hiddenSections: ['pinned'] } })
    expect(next.home.hiddenSections).toEqual(['pinned'])
    expect(next.home.order).toEqual([])
  })
})
