import { isRecord } from '@shared/types/result'
import { type UserStats } from '@shared/types/social'
import { type HistoryEntry } from '@shared/types/library'
import { JsonStore } from '../core/store'
import { paths } from '../core/paths'

interface StoredStats {
  listeningMs: number
}

const parseStats = (raw: unknown): StoredStats => ({
  listeningMs:
    isRecord(raw) && typeof raw.listeningMs === 'number' && Number.isFinite(raw.listeningMs) && raw.listeningMs > 0
      ? raw.listeningMs
      : 0
})

const TICK_MS = 5_000

/** Accumulates total time spent actually listening (player in "playing" state). */
export class StatsService {
  private store = new JsonStore<StoredStats>(paths.statsFile(), parseStats, 5_000)
  private playing = false
  private lastTick = Date.now()
  private timer: NodeJS.Timeout

  constructor() {
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  setPlaying(playing: boolean): void {
    this.tick()
    this.playing = playing
  }

  private tick(): void {
    const now = Date.now()
    if (this.playing) {
      // cap the delta so sleep/suspend gaps never count as listening
      const delta = Math.min(now - this.lastTick, TICK_MS * 3)
      if (delta > 0) this.store.set({ listeningMs: this.store.get().listeningMs + delta })
    }
    this.lastTick = now
  }

  listeningMs(): number {
    return this.store.get().listeningMs
  }

  /** Most repeated track in the local history. */
  topTrack(history: HistoryEntry[]): UserStats['topTrack'] {
    const counts = new Map<number, { plays: number; entry: HistoryEntry }>()
    for (const entry of history) {
      const found = counts.get(entry.track.id)
      if (found) found.plays++
      else counts.set(entry.track.id, { plays: 1, entry })
    }
    let best: { plays: number; entry: HistoryEntry } | null = null
    for (const item of counts.values()) {
      if (!best || item.plays > best.plays) best = item
    }
    if (!best) return null
    return {
      title: best.entry.track.title,
      artist: best.entry.track.artist,
      artwork: best.entry.track.artworkSmall ?? best.entry.track.artwork,
      plays: best.plays
    }
  }

  destroy(): void {
    clearInterval(this.timer)
    this.tick()
    this.store.flush()
  }
}
