import { describe, expect, it } from 'vitest'
import { pickChartMatch, primaryArtist, type ChartCandidate } from '../src/shared/utils/charts-match'

const cand = (over: Partial<ChartCandidate>): ChartCandidate => ({
  id: 1,
  title: '',
  artist: '',
  playbackCount: 0,
  snipped: false,
  ...over
})

describe('primaryArtist', () => {
  it('takes the first credited artist', () => {
    expect(primaryArtist('Anitta & KBrum')).toBe('anitta')
    expect(primaryArtist('MC Ryan SP, MC IG')).toBe('mc ryan sp')
    expect(primaryArtist('Jão feat. Luísa Sonza')).toBe('jao')
    expect(primaryArtist('Matuê')).toBe('matue')
  })
})

describe('pickChartMatch', () => {
  it('matches title + artist including accents and feat noise', () => {
    const candidates = [
      cand({ id: 10, title: 'Sal Grosso', artist: 'Anitta', playbackCount: 1_000_000 }),
      cand({ id: 11, title: 'Sal Grosso (Slowed)', artist: 'edits4you', playbackCount: 9_000_000 })
    ]
    expect(pickChartMatch('Anitta & KBrum', 'Sal Grosso', candidates)).toBe(10)
  })

  it('accepts the artist embedded in the upload title', () => {
    const candidates = [
      cand({ id: 20, title: 'Matuê - Crush', artist: 'trapbr uploads', playbackCount: 500_000 })
    ]
    expect(pickChartMatch('Matuê', 'Crush', candidates)).toBe(20)
  })

  it('returns null when the artist never appears', () => {
    const candidates = [cand({ id: 30, title: 'Sal Grosso', artist: 'random cover band' })]
    expect(pickChartMatch('Anitta', 'Sal Grosso', candidates)).toBeNull()
  })

  it('returns null when the title does not match', () => {
    const candidates = [cand({ id: 40, title: 'Outra Musica', artist: 'Anitta' })]
    expect(pickChartMatch('Anitta', 'Sal Grosso', candidates)).toBeNull()
  })

  it('prefers full tracks and higher play counts', () => {
    const candidates = [
      cand({ id: 50, title: 'petal', artist: 'Ariana Grande', snipped: true, playbackCount: 50_000_000 }),
      cand({ id: 51, title: 'petal', artist: 'Ariana Grande', snipped: false, playbackCount: 2_000_000 })
    ]
    expect(pickChartMatch('Ariana Grande', 'petal', candidates)).toBe(51)
  })

  it('strips feat brackets from the feed title', () => {
    const candidates = [cand({ id: 60, title: 'Kiss Me', artist: 'Ariana Grande' })]
    expect(pickChartMatch('Ariana Grande', 'Kiss Me (feat. Someone)', candidates)).toBe(60)
  })
})
