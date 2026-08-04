import { describe, expect, it } from 'vitest'
import { activeLineIndex, parseLrc } from '../src/shared/utils/lrc'
import { formatCount, formatTime } from '../src/renderer/src/utils/format'

describe('parseLrc', () => {
  it('parses timestamps and text', () => {
    const lines = parseLrc('[00:12.50]Hello\n[01:05.00]World\n[00:01]First')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toEqual({ time: 1, text: 'First' })
    expect(lines[1]?.time).toBeCloseTo(12.5)
    expect(lines[2]?.time).toBeCloseTo(65)
  })

  it('ignores metadata and junk lines', () => {
    const lines = parseLrc('[ar:Artist]\n[ti:Title]\nplain text\n[00:10.00]Real line')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.text).toBe('Real line')
  })

  it('supports 3-digit fractions', () => {
    const lines = parseLrc('[00:10.125]x')
    expect(lines[0]?.time).toBeCloseTo(10.125)
  })
})

describe('activeLineIndex', () => {
  const lines = parseLrc('[00:05]a\n[00:10]b\n[00:20]c')
  it('finds the active line', () => {
    expect(activeLineIndex(lines, 0)).toBe(-1)
    expect(activeLineIndex(lines, 5)).toBe(0)
    expect(activeLineIndex(lines, 12)).toBe(1)
    expect(activeLineIndex(lines, 60)).toBe(2)
  })
})

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(3661)).toBe('1:01:01')
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(-5)).toBe('0:00')
  })
})

describe('formatCount', () => {
  it('abbreviates large numbers', () => {
    expect(formatCount(950)).toBe('950')
    expect(formatCount(1500)).toBe('1.5K')
    expect(formatCount(2_000_000)).toBe('2M')
    expect(formatCount(1_200_000_000)).toBe('1.2B')
  })
})
