import { describe, expect, it } from 'vitest'
import { type Track } from '../src/shared/types/track'
import { personalizeTrending, tasteOf } from '../src/renderer/src/utils/trending'

const track = (id: number, artistId: number, genre: string | null): Track => ({
  id,
  title: `Track ${id}`,
  artist: `Artist ${artistId}`,
  artistId,
  artistUrl: '',
  artistAvatar: null,
  url: `https://soundcloud.com/t/${id}`,
  artwork: null,
  artworkSmall: null,
  duration: 100,
  genre,
  playCount: 0,
  likeCount: 0,
  createdAt: '',
  snippet: false
})

describe('personalizeTrending', () => {
  it('keeps chart order when the user has no taste yet', () => {
    const chart = [track(1, 10, 'Pop'), track(2, 11, 'Rock'), track(3, 12, null)]
    expect(personalizeTrending(chart, tasteOf([]))).toEqual(chart)
  })

  it('boosts tracks from artists the user listens to', () => {
    const chart = [track(1, 10, null), track(2, 11, null), track(3, 12, null)]
    const taste = tasteOf([track(90, 12, null)])
    const ranked = personalizeTrending(chart, taste)
    expect(ranked[0]?.id).toBe(3)
    expect(ranked.map((t) => t.id).sort()).toEqual([1, 2, 3])
  })

  it('boosts favorite genres, ignoring case and punctuation', () => {
    const chart = [track(1, 10, 'Rock'), track(2, 11, 'Hip-hop & Rap'), track(3, 12, 'Pop')]
    const taste = tasteOf([track(90, 99, 'hip hop rap'), track(91, 98, 'HipHop Rap')])
    const ranked = personalizeTrending(chart, taste)
    expect(ranked[0]?.id).toBe(2)
  })

  it('keeps the chart leader on top over a weak genre match lower down', () => {
    const chart = [track(1, 10, 'Pop'), ...Array.from({ length: 19 }, (_, i) => track(2 + i, 30 + i, i === 18 ? 'Funk' : null))]
    const taste = tasteOf([track(90, 99, 'Funk'), track(91, 98, 'Pop')])
    const ranked = personalizeTrending(chart, taste)
    expect(ranked[0]?.id).toBe(1)
  })
})
