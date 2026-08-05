import { type Track } from '@shared/types/track'

export interface TasteProfile {
  artists: Set<number>
  genres: Map<string, number>
}

const normGenre = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

export function tasteOf(tracks: Track[]): TasteProfile {
  const artists = new Set<number>()
  const genres = new Map<string, number>()
  for (const track of tracks) {
    artists.add(track.artistId)
    if (track.genre) {
      const genre = normGenre(track.genre)
      if (genre) genres.set(genre, (genres.get(genre) ?? 0) + 1)
    }
  }
  return { artists, genres }
}

/** Re-ranks the global chart towards the user's taste while keeping chart order as the base. */
export function personalizeTrending(chart: Track[], taste: TasteProfile): Track[] {
  if (chart.length < 2 || (taste.artists.size === 0 && taste.genres.size === 0)) return chart
  const maxGenre = Math.max(1, ...taste.genres.values())
  return chart
    .map((track, index) => {
      let score = (chart.length - index) / chart.length
      if (taste.artists.has(track.artistId)) score += 0.9
      const genre = track.genre ? normGenre(track.genre) : ''
      if (genre) {
        const count = taste.genres.get(genre) ?? 0
        if (count > 0) score += 0.6 * (count / maxGenre)
      }
      return { track, score, index }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.track)
}
