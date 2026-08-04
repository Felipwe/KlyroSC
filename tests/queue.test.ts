import { describe, expect, it } from 'vitest'
import { type Track } from '../src/shared/types/track'
import { dedupeAppend, nextIndex, previousIndex, shuffled, unshuffled } from '../src/renderer/src/player/queue-utils'

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
