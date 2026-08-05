import { t } from './index'

/** SoundCloud's home API always returns English section titles; map the known ones. */
const KEY_BY_TITLE: Record<string, string> = {
  trendingbygenre: 'trendingByGenre',
  artiststowatchoutfor: 'artistsToWatch',
  curatedbysoundcloud: 'curatedBySoundcloud',
  moreofwhatyoulike: 'moreOfWhatYouLike',
  relatedtracks: 'relatedTracks',
  chartstop50: 'chartsTop',
  chartsnewhot: 'chartsNewHot',
  mixesforyou: 'mixesForYou',
  playlistsforyou: 'playlistsForYou',
  recentlyplayed: 'recentlyPlayed',
  freshpressed: 'freshPressed',
  dailydrops: 'dailyDrops'
}

export function localizeScTitle(raw: string): string {
  const key = KEY_BY_TITLE[raw.toLowerCase().replace(/[^a-z0-9]+/g, '')]
  return key ? t(`home.scSections.${key}`) : raw
}
