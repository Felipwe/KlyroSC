import { describe, expect, it } from 'vitest'
import { isUserStats, MAX_LISTENING_DELTA_MS, mergeStats } from '../src/types.js'

const track = { title: 'Loop Song', artist: 'Looper', artwork: null, plays: 3 }

describe('isUserStats', () => {
  it('accepts plain and delta reports', () => {
    expect(isUserStats({ listeningMs: 0, topTrack: null })).toBe(true)
    expect(isUserStats({ listeningMs: 1_000, listeningDeltaMs: 500, topTrack: track })).toBe(true)
  })

  it('rejects invalid deltas', () => {
    expect(isUserStats({ listeningMs: 1_000, listeningDeltaMs: -1, topTrack: null })).toBe(false)
    expect(isUserStats({ listeningMs: 1_000, listeningDeltaMs: Number.NaN, topTrack: null })).toBe(false)
    expect(isUserStats({ listeningMs: 1_000, listeningDeltaMs: '5', topTrack: null })).toBe(false)
  })
})

describe('mergeStats', () => {
  it('accumulates deltas into the account total', () => {
    const stored = mergeStats(
      { listeningMs: 34_200_000, topTrack: null },
      { listeningMs: 1_200_000, listeningDeltaMs: 60_000, topTrack: track }
    )
    expect(stored.listeningMs).toBe(34_260_000)
    expect(stored.topTrack).toEqual(track)
  })

  it('starts from zero for new accounts', () => {
    expect(mergeStats(null, { listeningMs: 5_000, listeningDeltaMs: 5_000, topTrack: null }).listeningMs).toBe(5_000)
  })

  it('legacy absolute reports never lower the total (device reset keeps history)', () => {
    expect(
      mergeStats({ listeningMs: 34_200_000, topTrack: track }, { listeningMs: 1_200_000, topTrack: null }).listeningMs
    ).toBe(34_200_000)
    expect(mergeStats({ listeningMs: 1_000, topTrack: null }, { listeningMs: 9_000, topTrack: null }).listeningMs).toBe(
      9_000
    )
  })

  it('caps a single delta report', () => {
    expect(
      mergeStats(null, { listeningMs: 0, listeningDeltaMs: MAX_LISTENING_DELTA_MS * 10, topTrack: null }).listeningMs
    ).toBe(MAX_LISTENING_DELTA_MS)
  })

  it('stores only the public fields', () => {
    expect(Object.keys(mergeStats(null, { listeningMs: 1, listeningDeltaMs: 1, topTrack: null }))).toEqual([
      'listeningMs',
      'topTrack'
    ])
  })
})
