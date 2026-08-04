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

export function unshuffled(original: Track[], currentId: number | null): { queue: Track[]; index: number } {
  if (original.length === 0) return { queue: [], index: 0 }
  const found = currentId === null ? -1 : original.findIndex((track) => track.id === currentId)
  return { queue: [...original], index: Math.max(0, found) }
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
