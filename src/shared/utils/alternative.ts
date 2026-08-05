import { cleanTitle, normalizeText } from './lyrics-query'

export interface AltOriginal {
  id: number
  title: string
  artist: string
  fullDurationMs: number
}

export interface AltCandidate {
  id: number
  title: string
  artist: string
  fullDurationMs: number
  snipped: boolean
  policy: string
  playbackCount: number
}

// words that mark a remix / edit / different rendition — never a clean master
const EDIT_RE =
  /\b(slowed|reverb|sped|speed\s*up|nightcore|8d|acoustic|remix|bass\s*boost|mashup|instrumental|karaoke|cover|loop|tiktok|edit|rework|flip|vip|bootleg|snippet|unreleased|demo|leak|version|remaster|part\s*\d|pt\.?\s*\d|\bv\d\b|live|freestyle|1950s|jazz)\b/i

const stripArtist = (value: string): string => normalizeText(cleanTitle(value))

/**
 * Picks a clean, full-length reupload of the same song when one clearly exists.
 * Returns the candidate id, or null when nothing is confident enough — in which
 * case the caller should keep the official preview rather than play the wrong thing.
 */
export function pickAlternative(original: AltOriginal, candidates: AltCandidate[]): number | null {
  const coreTitle = stripArtist(original.title)
  const coreArtist = stripArtist(original.artist)
  if (coreTitle.length < 3 || original.fullDurationMs <= 0) return null

  let best: { id: number; score: number } | null = null
  for (const candidate of candidates) {
    if (candidate.id === original.id) continue
    if (candidate.snipped || candidate.policy === 'SNIP') continue
    if (candidate.fullDurationMs <= 0) continue

    const durDiff = Math.abs(candidate.fullDurationMs - original.fullDurationMs) / original.fullDurationMs
    if (durDiff > 0.06) continue

    const normTitle = normalizeText(candidate.title)
    if (!normTitle.includes(coreTitle)) continue
    if (EDIT_RE.test(candidate.title)) continue

    // the artist must show up somewhere so we don't grab a same-named different song
    const artistHit =
      coreArtist.length > 0 &&
      (normTitle.includes(coreArtist) || stripArtist(candidate.artist).includes(coreArtist))
    if (!artistHit) continue

    const score = durDiff
    if (!best || score < best.score) best = { id: candidate.id, score }
  }
  return best?.id ?? null
}
