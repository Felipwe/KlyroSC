import { describe, expect, it } from 'vitest'
import { orderHomeSections } from '../src/shared/utils/home-sections'

const refs = (...ids: string[]): { id: string }[] => ids.map((id) => ({ id }))

describe('orderHomeSections', () => {
  const base = refs('pinned', 'trending', 'sc:a', 'sc:b')

  it('returns natural order when nothing is customized', () => {
    expect(orderHomeSections(base, [], []).map((s) => s.id)).toEqual([
      'pinned',
      'trending',
      'sc:a',
      'sc:b'
    ])
  })

  it('drops hidden sections', () => {
    expect(orderHomeSections(base, [], ['trending', 'sc:b']).map((s) => s.id)).toEqual([
      'pinned',
      'sc:a'
    ])
  })

  it('applies the saved order', () => {
    const order = ['sc:b', 'pinned', 'trending', 'sc:a']
    expect(orderHomeSections(base, order, []).map((s) => s.id)).toEqual([
      'sc:b',
      'pinned',
      'trending',
      'sc:a'
    ])
  })

  it('appends sections unknown to the saved order in natural order', () => {
    const order = ['trending', 'pinned']
    expect(orderHomeSections(base, order, []).map((s) => s.id)).toEqual([
      'trending',
      'pinned',
      'sc:a',
      'sc:b'
    ])
  })

  it('ignores ordered ids that no longer exist', () => {
    const order = ['sc:gone', 'trending', 'pinned']
    expect(orderHomeSections(base, order, []).map((s) => s.id)).toEqual([
      'trending',
      'pinned',
      'sc:a',
      'sc:b'
    ])
  })

  it('combines order and hidden filters', () => {
    const order = ['sc:a', 'trending', 'pinned', 'sc:b']
    expect(orderHomeSections(base, order, ['trending']).map((s) => s.id)).toEqual([
      'sc:a',
      'pinned',
      'sc:b'
    ])
  })
})
