export interface ChartCandidate {
  id: number
  title: string
  artist: string
  playbackCount: number
  snipped: boolean
}

const norm = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Strips featuring/remaster noise so "Song (feat. X)" matches "Song". */
const coreTitle = (value: string): string =>
  norm(
    value
      .replace(/[([][^)\]]*(feat|with|remaster|vers[aã]o|version|ao vivo|live)[^)\]]*[)\]]/gi, ' ')
      .replace(/\bfeat\.?\s.+$/i, ' ')
  )

/** First credited artist of a feed entry ("Anitta & KBrum" → "anitta"). */
export const primaryArtist = (value: string): string => {
  const first = value.split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\bcom\b|\bx\b|\/)\s*/i)[0] ?? value
  return norm(first)
}

const contains = (haystack: string, needle: string): boolean =>
  needle.length >= 3 && haystack.includes(needle)

/**
 * Picks the SoundCloud candidate that best matches a chart entry.
 * Requires evidence of both the song title and the artist; returns null when unsure.
 */
export function pickChartMatch(
  feedArtist: string,
  feedTitle: string,
  candidates: ChartCandidate[]
): number | null {
  const title = coreTitle(feedTitle)
  const artist = primaryArtist(feedArtist)
  if (!title || !artist) return null

  let bestId: number | null = null
  let bestScore = 0
  for (const candidate of candidates) {
    const candTitle = norm(candidate.title)
    const candArtist = norm(candidate.artist)
    const titleMatch = contains(candTitle, title) || contains(coreTitle(candidate.title), title)
    const artistMatch =
      contains(candArtist, artist) || contains(artist, candArtist) || contains(candTitle, artist)
    if (!titleMatch || !artistMatch) continue
    let score = 5
    if (!candidate.snipped) score += 1
    score += Math.min(0.9, candidate.playbackCount / 20_000_000)
    if (score > bestScore) {
      bestScore = score
      bestId = candidate.id
    }
  }
  return bestId
}
