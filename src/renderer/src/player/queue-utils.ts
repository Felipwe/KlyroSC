import { type Track } from '@shared/types/track'
import { type RepeatMode } from '@shared/types/player'

export interface QueuePosition {
  queue: Track[]
  index: number
  repeat: RepeatMode
}

export type NextResult = { kind: 'index'; index: number } | { kind: 'restart' } | { kind: 'end' }

export function nextIndex(state: QueuePosition, auto: boolean): NextResult {
  const { queue, index, repeat } = state
  if (queue.length === 0) return { kind: 'end' }
  if (auto && repeat === 'one') return { kind: 'restart' }
  if (index + 1 < queue.length) return { kind: 'index', index: index + 1 }
  if (repeat === 'all') return { kind: 'index', index: 0 }
  return { kind: 'end' }
}

export function previousIndex(state: QueuePosition): number | null {
  if (state.queue.length === 0) return null
  if (state.index > 0) return state.index - 1
  return state.repeat === 'all' ? state.queue.length - 1 : null
}

export function shuffled(
  queue: Track[],
  currentIndex: number,
  random: () => number = Math.random
): { queue: Track[]; index: number } {
  if (queue.length === 0) return { queue: [], index: 0 }
  const current = queue[currentIndex]
  const rest = queue.filter((_, i) => i !== currentIndex)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = rest[i]
    const b = rest[j]
    if (a !== undefined && b !== undefined) {
      rest[i] = b
      rest[j] = a
    }
  }
  return current !== undefined ? { queue: [current, ...rest], index: 0 } : { queue: rest, index: 0 }
}

const normalizeKey = (value: string | null): string => (value ?? '').trim().toLowerCase()

export function smartShuffled(
  queue: Track[],
  currentIndex: number,
  random: () => number = Math.random
): { queue: Track[]; index: number } {
  if (queue.length === 0) return { queue: [], index: 0 }
  const current = queue[currentIndex]
  const pool = queue.filter((_, i) => i !== currentIndex)
  const ordered: Track[] = current !== undefined ? [current] : []
  const recentArtists: string[] = current !== undefined ? [normalizeKey(current.artist)] : []
  let previousGenre = current !== undefined ? normalizeKey(current.genre) : ''

  while (pool.length > 0) {
    let bestIndex = 0
    let bestScore = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i]
      if (candidate === undefined) continue
      const artist = normalizeKey(candidate.artist)
      const genre = normalizeKey(candidate.genre)
      let score = random()
      if (previousGenre && genre && genre === previousGenre) score += 0.35
      if (recentArtists[recentArtists.length - 1] === artist) score -= 0.85
      else if (recentArtists.includes(artist)) score -= 0.4
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }
    const picked = pool.splice(bestIndex, 1)[0]
    if (picked === undefined) break
    ordered.push(picked)
    const pickedGenre = normalizeKey(picked.genre)
    if (pickedGenre) previousGenre = pickedGenre
    recentArtists.push(normalizeKey(picked.artist))
    if (recentArtists.length > 3) recentArtists.shift()
  }
  return { queue: ordered, index: 0 }
}

export function unshuffled(original: Track[], currentId: number | null): { queue: Track[]; index: number } {
  if (original.length === 0) return { queue: [], index: 0 }
  const found = currentId === null ? -1 : original.findIndex((track) => track.id === currentId)
  return { queue: [...original], index: Math.max(0, found) }
}

/** How many Smart Shuffle recommendations a queue of this size can absorb. */
export function smartPickBudget(queueLength: number): number {
  if (queueLength < 2) return 0
  return Math.min(20, Math.max(3, Math.ceil(queueLength / 2)))
}

/**
 * Spotify-style Smart Shuffle: weaves recommended tracks into an already
 * shuffled queue. Every ~3 personal tracks one recommendation is inserted,
 * always after `index` (the playing track never moves). Recommendations are
 * deduped against the queue, flagged with `smartPick` and capped by budget.
 */
export function mixRecommendations(
  queue: Track[],
  index: number,
  recommendations: Track[],
  random: () => number = Math.random
): Track[] {
  if (queue.length === 0) return queue
  const known = new Set(queue.map((track) => track.id))
  const pool: Track[] = []
  for (const rec of recommendations) {
    if (known.has(rec.id)) continue
    known.add(rec.id)
    pool.push({ ...rec, smartPick: true })
  }
  if (pool.length === 0) return queue
  // shuffle the pool so repeated activations do not inject the same order
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = pool[i]
    const b = pool[j]
    if (a !== undefined && b !== undefined) {
      pool[i] = b
      pool[j] = a
    }
  }
  const budget = Math.min(pool.length, smartPickBudget(queue.length))
  const out = queue.slice(0, index + 1)
  const rest = queue.slice(index + 1)
  let used = 0
  for (let i = 0; i < rest.length; i++) {
    const item = rest[i]
    if (item !== undefined) out.push(item)
    if ((i + 1) % 3 === 0 && used < budget) {
      const pick = pool[used++]
      if (pick !== undefined) out.push(pick)
    }
  }
  // short queues: make sure at least one recommendation lands at the end
  while (used < budget) {
    const pick = pool[used++]
    if (pick === undefined) break
    out.push(pick)
  }
  return out
}

/** Strips Smart Shuffle recommendations, keeping the playing track even if it was one. */
export function withoutSmartPicks(queue: Track[], currentId: number | null): { queue: Track[]; index: number } {
  const kept = queue.filter((track) => track.smartPick !== true || track.id === currentId)
  const found = currentId === null ? -1 : kept.findIndex((track) => track.id === currentId)
  return { queue: kept, index: Math.max(0, found) }
}

export function dedupeAppend(queue: Track[], tracks: Track[]): Track[] {
  const seen = new Set(queue.map((track) => track.id))
  const additions = tracks.filter((track) => {
    if (seen.has(track.id)) return false
    seen.add(track.id)
    return true
  })
  return additions.length > 0 ? [...queue, ...additions] : queue
}
