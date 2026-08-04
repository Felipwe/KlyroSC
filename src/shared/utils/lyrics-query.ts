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
  const parts = title.split(/\s+[-–]\s+/)
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
  wantedTitle: string,
  wantedDuration: number
): number {
  const nWanted = normalizeText(cleanTitle(wantedTitle))
  let best = -1
  let bestScore = 0
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    if (!candidate || (!candidate.hasSynced && !candidate.hasPlain)) continue
    let score = candidate.hasSynced ? 100 : 30
    if (wantedDuration > 0 && candidate.duration > 0) {
      const diff = Math.abs(candidate.duration - wantedDuration)
      if (diff <= 2) score += 45
      else if (diff <= 5) score += 30
      else if (diff <= 10) score += 12
      else if (diff > 20) score -= 35
    }
    const nCandidate = normalizeText(candidate.title)
    if (nWanted && nCandidate && (nCandidate.includes(nWanted) || nWanted.includes(nCandidate)))
      score += 25
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return bestScore >= 55 ? best : -1
}
