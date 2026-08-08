import { describe, expect, it } from 'vitest'
import { type Track } from '../src/shared/types/track'
import {
  dedupeAppend,
  mixRecommendations,
  nextIndex,
  previousIndex,
  shuffled,
  smartPickBudget,
  smartShuffled,
  unshuffled,
  withoutSmartPicks
} from '../src/renderer/src/player/queue-utils'

const track = (id: number): Track => ({
  id,
  title: `Track ${id}`,
  artist: 'Artist',
  artistId: 1,
  artistUrl: '',
  artistAvatar: null,
  url: `https://soundcloud.com/t/${id}`,
  artwork: null,
  artworkSmall: null,
  duration: 100,
  genre: null,
  playCount: 0,
  likeCount: 0,
  createdAt: '',
  snippet: false
})

const queue = [track(1), track(2), track(3)]

describe('nextIndex', () => {
  it('advances within the queue', () => {
    expect(nextIndex({ queue, index: 0, repeat: 'off' }, false)).toEqual({ kind: 'index', index: 1 })
  })

  it('ends at the last track with repeat off', () => {
    expect(nextIndex({ queue, index: 2, repeat: 'off' }, true)).toEqual({ kind: 'end' })
  })

  it('wraps with repeat all', () => {
    expect(nextIndex({ queue, index: 2, repeat: 'all' }, true)).toEqual({ kind: 'index', index: 0 })
  })

  it('restarts with repeat one only on auto advance', () => {
    expect(nextIndex({ queue, index: 1, repeat: 'one' }, true)).toEqual({ kind: 'restart' })
    expect(nextIndex({ queue, index: 1, repeat: 'one' }, false)).toEqual({ kind: 'index', index: 2 })
  })

  it('handles empty queues', () => {
    expect(nextIndex({ queue: [], index: 0, repeat: 'all' }, true)).toEqual({ kind: 'end' })
  })
})

describe('previousIndex', () => {
  it('goes back', () => {
    expect(previousIndex({ queue, index: 2, repeat: 'off' })).toBe(1)
  })

  it('stops at start with repeat off', () => {
    expect(previousIndex({ queue, index: 0, repeat: 'off' })).toBeNull()
  })

  it('wraps at start with repeat all', () => {
    expect(previousIndex({ queue, index: 0, repeat: 'all' })).toBe(2)
  })
})

describe('shuffled', () => {
  it('keeps the current track first and preserves membership', () => {
    const result = shuffled(queue, 1, () => 0.5)
    expect(result.index).toBe(0)
    expect(result.queue[0]?.id).toBe(2)
    expect(result.queue.map((t) => t.id).sort()).toEqual([1, 2, 3])
  })

  it('handles empty input', () => {
    expect(shuffled([], 0)).toEqual({ queue: [], index: 0 })
  })
})

describe('unshuffled', () => {
  it('restores original order and finds the current track', () => {
    const result = unshuffled(queue, 3)
    expect(result.queue.map((t) => t.id)).toEqual([1, 2, 3])
    expect(result.index).toBe(2)
  })

  it('defaults to first item when track is gone', () => {
    expect(unshuffled(queue, 99).index).toBe(0)
  })
})

describe('dedupeAppend', () => {
  it('appends only unseen tracks', () => {
    const result = dedupeAppend(queue, [track(2), track(4), track(4), track(5)])
    expect(result.map((t) => t.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns the same array when nothing to add', () => {
    expect(dedupeAppend(queue, [track(1)])).toBe(queue)
  })
})

describe('smartShuffled', () => {
  const withMeta = (id: number, artist: string, genre: string | null): Track => ({
    ...track(id),
    artist,
    genre
  })

  it('keeps the current track first and preserves membership', () => {
    const list = [
      withMeta(1, 'A', 'rock'),
      withMeta(2, 'B', 'pop'),
      withMeta(3, 'C', 'rock'),
      withMeta(4, 'D', 'pop')
    ]
    const result = smartShuffled(list, 2, () => 0.5)
    expect(result.index).toBe(0)
    expect(result.queue[0]?.id).toBe(3)
    expect(result.queue.map((t) => t.id).sort()).toEqual([1, 2, 3, 4])
  })

  it('avoids playing the same artist back-to-back when alternatives exist', () => {
    const list = [
      withMeta(1, 'A', null),
      withMeta(2, 'A', null),
      withMeta(3, 'A', null),
      withMeta(4, 'B', null),
      withMeta(5, 'B', null),
      withMeta(6, 'C', null)
    ]
    let seed = 0
    const random = (): number => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const result = smartShuffled(list, 0, random)
    let adjacentRepeats = 0
    for (let i = 1; i < result.queue.length; i++) {
      if (result.queue[i]?.artist === result.queue[i - 1]?.artist) adjacentRepeats++
    }
    expect(adjacentRepeats).toBeLessThanOrEqual(1)
  })

  it('handles empty and single-item queues', () => {
    expect(smartShuffled([], 0)).toEqual({ queue: [], index: 0 })
    const single = [withMeta(1, 'A', null)]
    expect(smartShuffled(single, 0).queue.map((t) => t.id)).toEqual([1])
  })
})

describe('smartPickBudget', () => {
  it('scales with queue size within bounds', () => {
    expect(smartPickBudget(0)).toBe(0)
    expect(smartPickBudget(1)).toBe(0)
    expect(smartPickBudget(4)).toBe(3)
    expect(smartPickBudget(10)).toBe(5)
    expect(smartPickBudget(200)).toBe(20)
  })
})

describe('mixRecommendations', () => {
  const fixed = (): number => 0.99 // keeps pool order stable for assertions

  it('weaves one recommendation after every three tracks past the playing one', () => {
    const list = [track(1), track(2), track(3), track(4), track(5), track(6), track(7)]
    const recs = [track(100), track(101)]
    const mixed = mixRecommendations(list, 0, recs, fixed)
    expect(mixed.map((t) => t.id)).toEqual([1, 2, 3, 4, 100, 5, 6, 7, 101])
  })

  it('never inserts before or at the playing index', () => {
    const list = [track(1), track(2), track(3), track(4), track(5), track(6)]
    const mixed = mixRecommendations(list, 2, [track(100)], fixed)
    expect(mixed.slice(0, 3).map((t) => t.id)).toEqual([1, 2, 3])
    expect(mixed.filter((t) => t.smartPick).length).toBe(1)
  })

  it('marks injected tracks as smart picks without touching originals', () => {
    const list = [track(1), track(2), track(3), track(4)]
    const mixed = mixRecommendations(list, 0, [track(100)], fixed)
    const pick = mixed.find((t) => t.id === 100)
    expect(pick?.smartPick).toBe(true)
    expect(mixed.filter((t) => !t.smartPick).map((t) => t.id)).toEqual([1, 2, 3, 4])
  })

  it('dedupes recommendations already in the queue and repeated ones', () => {
    const list = [track(1), track(2), track(3), track(4)]
    const mixed = mixRecommendations(list, 0, [track(2), track(100), track(100)], fixed)
    expect(mixed.filter((t) => t.id === 2).length).toBe(1)
    expect(mixed.filter((t) => t.id === 100).length).toBe(1)
  })

  it('caps insertions at the queue budget', () => {
    const list = [track(1), track(2), track(3), track(4)]
    const recs = Array.from({ length: 30 }, (_, i) => track(100 + i))
    const mixed = mixRecommendations(list, 0, recs, fixed)
    expect(mixed.filter((t) => t.smartPick).length).toBe(smartPickBudget(list.length))
  })

  it('guarantees at least one pick lands on short queues', () => {
    const list = [track(1), track(2)]
    const mixed = mixRecommendations(list, 0, [track(100), track(101), track(102), track(103)], fixed)
    expect(mixed.filter((t) => t.smartPick).length).toBe(smartPickBudget(2))
    expect(mixed.length).toBeGreaterThan(list.length)
  })

  it('returns the queue untouched when there is nothing to add', () => {
    const list = [track(1), track(2), track(3)]
    expect(mixRecommendations(list, 0, [track(1)], fixed)).toBe(list)
    expect(mixRecommendations([], 0, [track(9)], fixed)).toEqual([])
  })
})

describe('withoutSmartPicks', () => {
  it('removes recommendations but keeps a playing recommendation', () => {
    const list = [track(1), { ...track(100), smartPick: true }, track(2), { ...track(101), smartPick: true }]
    const cleaned = withoutSmartPicks(list, 100)
    expect(cleaned.queue.map((t) => t.id)).toEqual([1, 100, 2])
    expect(cleaned.index).toBe(1)
  })

  it('drops all picks when none is playing', () => {
    const list = [track(1), { ...track(100), smartPick: true }, track(2)]
    const cleaned = withoutSmartPicks(list, 2)
    expect(cleaned.queue.map((t) => t.id)).toEqual([1, 2])
    expect(cleaned.index).toBe(1)
  })
})
