export interface LyricsQuery {
  artist: string
  title: string
}

export interface CandidateMeta {
  title: string
  artist: string
  duration: number
  hasSynced: boolean
  hasPlain: boolean
}

const BRACKETS_RE = /[([{][^)\]}]*[)\]}]/g
const FEAT_RE = /\b(feat|ft|featuring)\.?\s+.*$/i
const TRACK_NO_RE = /^\s*\d{1,2}\s*[.)-]\s*/
const SYMBOLS_RE = /[“”«»"♪♫★☆✦✧*]+/g
const EDGES_RE = /^[\s\-–_~|]+|[\s\-–_~|]+$/g

export function cleanTitle(raw: string): string {
  let title = raw
    .replace(BRACKETS_RE, ' ')
    .split('|')[0] as string
  title = title
    .replace(FEAT_RE, ' ')
    .replace(TRACK_NO_RE, '')
    .replace(SYMBOLS_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(EDGES_RE, '')
    .trim()
  return title || raw.trim()
}

export function splitDashTitle(title: string): LyricsQuery | null {
  // require whitespace on at least one side so names such as Jay-Z stay intact
  const parts = title.split(/\s*[-–]\s+|\s+[-–]\s*/)
  if (parts.length < 2) return null
  const artist = (parts[0] ?? '').trim()
  const rest = parts.slice(1).join(' - ').trim()
  if (!artist || !rest) return null
  return { artist, title: rest }
}

export const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const tokensOf = (value: string): Set<string> =>
  new Set(normalizeText(value).split(' ').filter((token) => token.length > 1 && token !== 'the'))

const overlapScore = (wanted: string, candidate: string, contributorMatch = false): number => {
  const a = normalizeText(wanted)
  const b = normalizeText(candidate)
  if (!a || !b) return 0
  if (a === b) return 1
  const aTokens = tokensOf(a)
  const bTokens = tokensOf(b)
  if (aTokens.size === 0 || bTokens.size === 0) return 0
  if (
    aTokens.size >= 2 &&
    bTokens.size >= 2 &&
    Math.min(a.length, b.length) >= 4 &&
    (a.includes(b) || b.includes(a))
  )
    return 0.9
  let common = 0
  for (const token of aTokens) if (bTokens.has(token)) common++
  return common / (contributorMatch ? Math.min(aTokens.size, bTokens.size) : Math.max(aTokens.size, bTokens.size))
}

export function buildLyricsQueries(artist: string, title: string): LyricsQuery[] {
  const out: LyricsQuery[] = []
  const seen = new Set<string>()
  const push = (a: string, t: string): void => {
    const key = `${normalizeText(a)}::${normalizeText(t)}`
    if (!a || !t || seen.has(key)) return
    seen.add(key)
    out.push({ artist: a, title: t })
  }

  const cleanedTitle = cleanTitle(title)
  const cleanedArtist = cleanTitle(artist)
  push(cleanedArtist, cleanedTitle)

  const split = splitDashTitle(cleanedTitle)
  if (split) {
    push(split.artist, split.title)
    push(cleanedArtist, split.title)
  }
  return out.slice(0, 3)
}

export function pickBestIndex(
  candidates: CandidateMeta[],
  wantedArtist: string,
  wantedTitle: string,
  wantedDuration: number
): number {
  let best = -1
  let bestScore = 0
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    if (!candidate || (!candidate.hasSynced && !candidate.hasPlain)) continue

    const titleScore = overlapScore(cleanTitle(wantedTitle), cleanTitle(candidate.title))
    const artistScore = overlapScore(cleanTitle(wantedArtist), cleanTitle(candidate.artist), true)
    if (titleScore < 0.75 || artistScore < 0.5) continue

    let durationScore = 0
    if (wantedDuration > 0 && candidate.duration > 0) {
      const diff = Math.abs(candidate.duration - wantedDuration)
      const tolerance = candidate.hasSynced
        ? Math.max(8, wantedDuration * 0.04)
        : Math.max(20, wantedDuration * 0.12)
      if (diff > tolerance) continue
      durationScore = 1 - diff / tolerance
    }

    const score =
      (candidate.hasSynced ? 35 : 15) +
      titleScore * 30 +
      artistScore * 25 +
      durationScore * 25
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return bestScore >= 65 ? best : -1
}

export function isPlausibleSyncedTiming(
  lines: { time: number; text: string }[],
  wantedDuration: number
): boolean {
  if (lines.length === 0) return false
  let previous = -1
  for (const line of lines) {
    if (!Number.isFinite(line.time) || line.time < previous) return false
    previous = line.time
  }
  if (wantedDuration <= 0 || lines.length < 3) return true
  const first = lines[0]?.time ?? 0
  const last = lines[lines.length - 1]?.time ?? 0
  if (first > wantedDuration * 0.45) return false
  if (last > wantedDuration + 12) return false
  if (last < wantedDuration * 0.35) return false
  return true
}
