import { describe, expect, it } from 'vitest'
import {
  avatarHue,
  expectedJamPosition,
  formatAccountNumber,
  initialsOf,
  isValidAccountNumber,
  normalizeAccountNumber,
  normalizeFriendName,
  parsePublicId
} from '../src/shared/utils/social'

describe('account number helpers', () => {
  it('normalizes pasted formats', () => {
    expect(normalizeAccountNumber('1234 5678 9012 3456')).toBe('1234567890123456')
    expect(normalizeAccountNumber('1234-5678-9012-3456')).toBe('1234567890123456')
    expect(normalizeAccountNumber('  12 34\t56 ')).toBe('123456')
  })

  it('validates 16 digits only', () => {
    expect(isValidAccountNumber('1234 5678 9012 3456')).toBe(true)
    expect(isValidAccountNumber('1234567890123456')).toBe(true)
    expect(isValidAccountNumber('123456789012345')).toBe(false)
    expect(isValidAccountNumber('12345678901234567')).toBe(false)
    expect(isValidAccountNumber('abcd efgh ijkl mnop')).toBe(false)
    expect(isValidAccountNumber('')).toBe(false)
  })

  it('formats into groups of four', () => {
    expect(formatAccountNumber('1234567890123456')).toBe('1234 5678 9012 3456')
    expect(formatAccountNumber('1234')).toBe('1234')
    expect(formatAccountNumber('12345')).toBe('1234 5')
  })
})

describe('friend id helpers', () => {
  it('normalizes whitespace in names', () => {
    expect(normalizeFriendName('  bold   zebra ')).toBe('bold zebra')
  })

  it('parses public ids with or without #', () => {
    expect(parsePublicId('#42')).toBe(42)
    expect(parsePublicId('42')).toBe(42)
    expect(parsePublicId(' # 7 ')).toBe(7)
    expect(parsePublicId('1')).toBe(1)
  })

  it('rejects invalid ids', () => {
    expect(parsePublicId('')).toBeNull()
    expect(parsePublicId('#')).toBeNull()
    expect(parsePublicId('0')).toBeNull()
    expect(parsePublicId('-3')).toBeNull()
    expect(parsePublicId('12.5')).toBeNull()
    expect(parsePublicId('abc')).toBeNull()
    expect(parsePublicId('#42abc')).toBeNull()
    expect(parsePublicId('9'.repeat(20))).toBeNull()
  })
})

describe('avatar identity', () => {
  it('is deterministic and within hue range', () => {
    expect(avatarHue('Bold Zebra')).toBe(avatarHue('Bold Zebra'))
    for (const name of ['Bold Zebra', 'Hip Goat', 'Suspect Owl', 'X', '']) {
      const hue = avatarHue(name)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('extracts initials', () => {
    expect(initialsOf('Bold Zebra')).toBe('BZ')
    expect(initialsOf('Suspect')).toBe('S')
    expect(initialsOf('  hip   goat ')).toBe('HG')
  })
})

describe('expectedJamPosition', () => {
  const track = { trackId: 1, title: 'T', artist: 'A', artwork: null, duration: 180 }

  it('extrapolates while playing', () => {
    const playback = { track, playing: true, position: 10, at: 1_000_000 }
    expect(expectedJamPosition(playback, 1_000_000)).toBe(10)
    expect(expectedJamPosition(playback, 1_005_000)).toBe(15)
  })

  it('freezes while paused', () => {
    const playback = { track, playing: false, position: 42, at: 1_000_000 }
    expect(expectedJamPosition(playback, 1_030_000)).toBe(42)
  })

  it('clamps to duration and zero', () => {
    const playback = { track, playing: true, position: 175, at: 1_000_000 }
    expect(expectedJamPosition(playback, 1_060_000)).toBe(180)
    expect(expectedJamPosition({ track, playing: true, position: -4, at: 1_000_000 }, 1_000_000)).toBe(0)
    expect(expectedJamPosition({ track: null, playing: true, position: 50, at: 0 }, 99)).toBe(0)
  })

  it('ignores clock skew into the past', () => {
    const playback = { track, playing: true, position: 10, at: 1_000_000 }
    expect(expectedJamPosition(playback, 999_000)).toBe(10)
  })
})
