import { type SyncedLine } from '../types/player'

const LINE_RE = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/

export function parseLrc(raw: string): SyncedLine[] {
  const lines: SyncedLine[] = []
  for (const line of raw.split(/\r?\n/)) {
    const match = LINE_RE.exec(line.trim())
    if (!match) continue
    const min = Number(match[1])
    const sec = Number(match[2])
    const fracRaw = match[3] ?? '0'
    const frac = Number(fracRaw) / 10 ** fracRaw.length
    const text = (match[4] ?? '').trim()
    lines.push({ time: min * 60 + sec + frac, text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function activeLineIndex(lines: SyncedLine[], position: number): number {
  let active = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line && line.time <= position + 0.2) active = i
    else break
  }
  return active
}
