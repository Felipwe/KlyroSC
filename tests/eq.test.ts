import { describe, expect, it } from 'vitest'
import {
  EQ_BAND_COUNT,
  EQ_FREQUENCIES,
  EQ_GAIN_LIMIT,
  EQ_PRESETS,
  gainsEqual,
  matchEqPreset,
  sanitizeEqGains
} from '../src/shared/utils/eq'
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from '../src/shared/types/settings'

describe('eq bands', () => {
  it('exposes 10 ISO-style bands', () => {
    expect(EQ_FREQUENCIES).toHaveLength(EQ_BAND_COUNT)
    for (let i = 1; i < EQ_FREQUENCIES.length; i++) {
      expect(EQ_FREQUENCIES[i]).toBeGreaterThan(EQ_FREQUENCIES[i - 1] ?? 0)
    }
  })

  it('every built-in preset has valid gains', () => {
    const ids = new Set<string>()
    for (const preset of EQ_PRESETS) {
      expect(ids.has(preset.id)).toBe(false)
      ids.add(preset.id)
      expect(preset.gains).toHaveLength(EQ_BAND_COUNT)
      for (const gain of preset.gains) {
        expect(Math.abs(gain)).toBeLessThanOrEqual(EQ_GAIN_LIMIT)
      }
    }
    expect(EQ_PRESETS[0]?.id).toBe('flat')
  })
})

describe('sanitizeEqGains', () => {
  it('coerces garbage to a flat 10-band array', () => {
    expect(sanitizeEqGains(undefined)).toEqual(new Array(10).fill(0))
    expect(sanitizeEqGains('x')).toEqual(new Array(10).fill(0))
    expect(sanitizeEqGains([1, 'a', null, NaN])).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('clamps to the gain limit and trims extra bands', () => {
    const result = sanitizeEqGains([99, -99, 3.25, 0, 0, 0, 0, 0, 0, 0, 5, 5])
    expect(result).toHaveLength(EQ_BAND_COUNT)
    expect(result[0]).toBe(EQ_GAIN_LIMIT)
    expect(result[1]).toBe(-EQ_GAIN_LIMIT)
    expect(result[2]).toBeCloseTo(3.3)
  })
})

describe('matchEqPreset', () => {
  it('matches built-in presets and custom presets by gains', () => {
    const rock = EQ_PRESETS.find((preset) => preset.id === 'rock')
    expect(matchEqPreset([...(rock?.gains ?? [])], [])).toBe('rock')
    const custom = [{ name: 'Meu Som', gains: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0] }]
    expect(matchEqPreset([1, 2, 3, 0, 0, 0, 0, 0, 0, 0], custom)).toBe('custom:Meu Som')
    expect(matchEqPreset([9, 9, 9, 9, 9, 9, 9, 9, 9, 9], custom)).toBeNull()
  })

  it('prefers custom presets over built-ins on ties', () => {
    const custom = [{ name: 'Flat 2', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]
    expect(matchEqPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], custom)).toBe('custom:Flat 2')
  })

  it('gainsEqual tolerates float noise', () => {
    expect(gainsEqual([1.0001, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(true)
    expect(gainsEqual([1, 0, 0], [1, 0])).toBe(false)
  })
})

describe('settings.eq sanitization', () => {
  it('fills defaults for a missing eq section', () => {
    const result = sanitizeSettings({})
    expect(result.eq).toEqual(DEFAULT_SETTINGS.eq)
  })

  it('sanitizes custom presets: trims names, dedupes, drops invalid entries', () => {
    const result = sanitizeSettings({
      eq: {
        enabled: true,
        preamp: 50,
        gains: [1, 2],
        custom: [
          { name: '  Meu Rock  ', gains: [99, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
          { name: 'meu rock', gains: [] },
          { name: '', gains: [] },
          { gains: [1] },
          'junk'
        ]
      }
    })
    expect(result.eq.enabled).toBe(true)
    expect(result.eq.preamp).toBe(EQ_GAIN_LIMIT)
    expect(result.eq.gains).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(result.eq.custom).toEqual([{ name: 'Meu Rock', gains: [EQ_GAIN_LIMIT, 0, 0, 0, 0, 0, 0, 0, 0, 0] }])
  })

  it('replaces gains and custom arrays wholesale on merge', () => {
    const base = sanitizeSettings({
      eq: { custom: [{ name: 'A', gains: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }] }
    })
    const merged = mergeSettings(base, { eq: { custom: [], gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 5] } })
    expect(merged.eq.custom).toEqual([])
    expect(merged.eq.gains[9]).toBe(5)
    expect(merged.eq.gains).toHaveLength(EQ_BAND_COUNT)
  })
})
