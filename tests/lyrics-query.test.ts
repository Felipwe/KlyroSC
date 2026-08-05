import { describe, expect, it } from 'vitest'
import {
  buildLyricsQueries,
  cleanTitle,
  isPlausibleSyncedTiming,
  pickBestIndex,
  splitDashTitle,
  type CandidateMeta
} from '../src/shared/utils/lyrics-query'

describe('cleanTitle', () => {
  it('strips bracketed noise', () => {
    expect(cleanTitle('Song Name (Official Video) [HD]')).toBe('Song Name')
    expect(cleanTitle('Track {prod. by Someone}')).toBe('Track')
  })

  it('cuts pipe suffixes and feat tails', () => {
    expect(cleanTitle('My Song | Out Now on All Platforms')).toBe('My Song')
    expect(cleanTitle('My Song feat. Someone Else')).toBe('My Song')
    expect(cleanTitle('My Song ft. A & B')).toBe('My Song')
  })

  it('removes track numbers and symbols', () => {
    expect(cleanTitle('01. Intro')).toBe('Intro')
    expect(cleanTitle('★ Hit Song ★')).toBe('Hit Song')
  })

  it('falls back to raw when everything is stripped', () => {
    expect(cleanTitle('(Official Video)')).toBe('(Official Video)')
  })
})

describe('splitDashTitle', () => {
  it('splits artist - title patterns', () => {
    expect(splitDashTitle('Metallica - Nothing Else Matters')).toEqual({
      artist: 'Metallica',
      title: 'Nothing Else Matters'
    })
  })

  it('keeps extra dashes in the title part', () => {
    expect(splitDashTitle('A - B - C')).toEqual({ artist: 'A', title: 'B - C' })
  })

  it('returns null without a separator', () => {
    expect(splitDashTitle('Single Title')).toBeNull()
    expect(splitDashTitle('no-spaces-around')).toBeNull()
  })

  it('supports uploads with whitespace on only one side of the dash', () => {
    expect(splitDashTitle('Future + The Weeknd- Low Life')).toEqual({
      artist: 'Future + The Weeknd',
      title: 'Low Life'
    })
    expect(splitDashTitle('Jay-Z - Empire State of Mind')).toEqual({
      artist: 'Jay-Z',
      title: 'Empire State of Mind'
    })
  })
})

describe('buildLyricsQueries', () => {
  it('produces cleaned and split variants without duplicates', () => {
    const queries = buildLyricsQueries('UploaderChannel', 'Artist X - Great Song (Official Audio)')
    expect(queries[0]).toEqual({ artist: 'UploaderChannel', title: 'Artist X - Great Song' })
    expect(queries).toContainEqual({ artist: 'Artist X', title: 'Great Song' })
    expect(queries.length).toBeLessThanOrEqual(3)
    const keys = queries.map((q) => `${q.artist}::${q.title}`.toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('pickBestIndex', () => {
  const candidate = (over: Partial<CandidateMeta>): CandidateMeta => ({
    title: 'Great Song',
    artist: 'Artist X',
    duration: 200,
    hasSynced: false,
    hasPlain: false,
    ...over
  })

  it('prefers synced with matching duration', () => {
    const list = [
      candidate({ hasPlain: true }),
      candidate({ hasSynced: true, duration: 201 }),
      candidate({ hasSynced: true, duration: 350 })
    ]
    expect(pickBestIndex(list, 'Artist X', 'Great Song', 200)).toBe(1)
  })

  it('rejects weak plain-only mismatches', () => {
    const list = [candidate({ hasPlain: true, title: 'Another Thing', duration: 90 })]
    expect(pickBestIndex(list, 'Artist X', 'Great Song', 200)).toBe(-1)
  })

  it('accepts plain when duration and title align', () => {
    const list = [candidate({ hasPlain: true, duration: 199 })]
    expect(pickBestIndex(list, 'Artist X', 'Great Song (Official Video)', 200)).toBe(0)
  })

  it('ignores empty candidates', () => {
    expect(pickBestIndex([candidate({})], 'Artist X', 'Great Song', 200)).toBe(-1)
    expect(pickBestIndex([], 'Artist X', 'x', 0)).toBe(-1)
  })

  it('rejects synced lyrics from another artist even when title and duration match', () => {
    const list = [candidate({ artist: 'Completely Different', hasSynced: true, duration: 200 })]
    expect(pickBestIndex(list, 'Artist X', 'Great Song', 200)).toBe(-1)
  })

  it('rejects synced versions whose duration would drift noticeably', () => {
    const list = [candidate({ hasSynced: true, duration: 218 })]
    expect(pickBestIndex(list, 'Artist X', 'Great Song', 200)).toBe(-1)
  })

  it('accepts one credited artist from a collaboration', () => {
    const list = [candidate({ artist: 'Future', title: 'Low Life', duration: 314, hasSynced: true })]
    expect(pickBestIndex(list, 'Future & The Weeknd', 'Low Life', 313)).toBe(0)
  })

  it('does not accept a one-word fragment as a full title', () => {
    const list = [candidate({ title: 'Life', hasSynced: true, duration: 200 })]
    expect(pickBestIndex(list, 'Artist X', 'Low Life', 200)).toBe(-1)
  })
})

describe('isPlausibleSyncedTiming', () => {
  const lines = (times: number[]) => times.map((time) => ({ time, text: 'line' }))

  it('accepts timings covering a plausible portion of the track', () => {
    expect(isPlausibleSyncedTiming(lines([8, 40, 90, 170]), 200)).toBe(true)
  })

  it('rejects unsorted, far-too-short and overlong timelines', () => {
    expect(isPlausibleSyncedTiming(lines([8, 90, 40]), 200)).toBe(false)
    expect(isPlausibleSyncedTiming(lines([2, 20, 50]), 200)).toBe(false)
    expect(isPlausibleSyncedTiming(lines([2, 100, 215]), 200)).toBe(false)
  })
})
