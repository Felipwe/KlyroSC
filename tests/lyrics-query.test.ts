import { describe, expect, it } from 'vitest'
import {
  buildLyricsQueries,
  cleanTitle,
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
    expect(pickBestIndex(list, 'Great Song', 200)).toBe(1)
  })

  it('rejects weak plain-only mismatches', () => {
    const list = [candidate({ hasPlain: true, title: 'Another Thing', duration: 90 })]
    expect(pickBestIndex(list, 'Great Song', 200)).toBe(-1)
  })

  it('accepts plain when duration and title align', () => {
    const list = [candidate({ hasPlain: true, duration: 199 })]
    expect(pickBestIndex(list, 'Great Song (Official Video)', 200)).toBe(0)
  })

  it('ignores empty candidates', () => {
    expect(pickBestIndex([candidate({})], 'Great Song', 200)).toBe(-1)
    expect(pickBestIndex([], 'x', 0)).toBe(-1)
  })
})
