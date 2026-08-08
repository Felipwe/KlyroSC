import { useMemo, type JSX } from 'react'
import { type Track } from '@shared/types/track'
import { type LocalPlaylist } from '@shared/types/library'
import { orderHomeSections } from '@shared/utils/home-sections'
import { getLanguage, t, useLanguage } from '@renderer/i18n'
import { localizeScTitle } from '@renderer/i18n/sc-titles'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useAuth } from '@renderer/stores/auth'
import { useNav } from '@renderer/stores/nav'
import { useSettings } from '@renderer/stores/settings'
import { useAsyncResult } from '@renderer/hooks/async'
import { personalizeTrending, tasteOf } from '@renderer/utils/trending'
import { Loading, ErrorState } from '@renderer/components/Status'
import { Rail, TrackCard, PlaylistCard } from '@renderer/components/cards'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return t('home.greetingLateNight')
  if (hour < 12) return t('home.greetingMorning')
  if (hour < 18) return t('home.greetingAfternoon')
  return t('home.greetingEvening')
}

function regionLabel(code: string): string {
  try {
    const names = new Intl.DisplayNames([getLanguage() === 'pt' ? 'pt-BR' : 'en'], { type: 'region' })
    return names.of(code) ?? code
  } catch {
    return code
  }
}

type QuickTile =
  | { kind: 'playlist'; id: string; title: string; sub: string; artwork: string | null }
  | { kind: 'track'; track: Track }

interface TrendingRail {
  tracks: Track[]
  country: string
  regional: boolean
}

/** Real per-country charts when available; otherwise the global SC chart re-ranked by taste. */
async function loadTrending(): Promise<{ ok: true; data: TrendingRail } | { ok: false; error: string }> {
  const info = await api.app.info().catch(() => null)
  const country = info?.country ?? ''
  if (country) {
    const regional = await api.sc.countryCharts(country)
    if (regional.ok && regional.data.length >= 8)
      return { ok: true, data: { tracks: regional.data, country, regional: true } }
  }
  const global = await api.sc.charts('all-music')
  if (!global.ok) return global
  const library = useLibrary.getState().data
  const taste = tasteOf([
    ...library.history.map((entry) => entry.track),
    ...library.favorites.map((favorite) => favorite.track)
  ])
  return { ok: true, data: { tracks: personalizeTrending(global.data, taste), country, regional: false } }
}

/** Card for a user playlist pinned to the home page. */
function PinnedPlaylistCard({ playlist }: { playlist: LocalPlaylist }): JSX.Element {
  const open = (): void => useNav.getState().push({ name: 'playlist', ref: playlist.id, local: true })
  return (
    <div className="media-card card" onClick={open}>
      <Artwork
        src={playlist.cover ?? playlist.tracks[0]?.artwork ?? null}
        alt={playlist.name}
        fallbackIcon="queue"
      />
      <div className="mc-title" title={playlist.name}>
        {playlist.name}
      </div>
      <div className="mc-sub">
        {playlist.tracks.length === 1
          ? t('common.track')
          : t('common.tracks', { count: playlist.tracks.length })}
      </div>
      {playlist.tracks.length > 0 && (
        <button
          className="mc-play"
          aria-label={t('common.play')}
          onClick={(event) => {
            event.stopPropagation()
            usePlayer.getState().playTracks(playlist.tracks)
          }}
        >
          <Icon name="play" size={18} />
        </button>
      )}
    </div>
  )
}

export function HomePage(): JSX.Element {
  useLanguage()
  const current = usePlayer((state) => state.current)
  const playing = usePlayer((state) => state.playing)
  const libraryData = useLibrary((state) => state.data)
  const authUser = useAuth((state) => state.state.user)
  const homePrefs = useSettings((state) => state.settings.home)

  const firstName = (authUser?.name.trim().split(/\s+/)[0] ?? t('home.anonymous')).slice(0, 18)

  const trending = useAsyncResult(loadTrending, [])
  const home = useAsyncResult(() => api.sc.home(), [])

  const tiles = useMemo<QuickTile[]>(() => {
    const out: QuickTile[] = []
    for (const playlist of libraryData.playlists.slice(0, 2)) {
      out.push({
        kind: 'playlist',
        id: playlist.id,
        title: playlist.name,
        sub:
          playlist.tracks.length === 1
            ? t('common.track')
            : t('common.tracks', { count: playlist.tracks.length }),
        artwork: playlist.cover ?? playlist.tracks[0]?.artwork ?? null
      })
    }
    const seen = new Set<number>()
    const pool = [
      ...libraryData.history.map((entry) => entry.track),
      ...libraryData.favorites.map((favorite) => favorite.track)
    ]
    for (const track of pool) {
      if (out.length >= 6) break
      if (seen.has(track.id) || track.id === current?.id) continue
      seen.add(track.id)
      out.push({ kind: 'track', track })
    }
    return out
  }, [libraryData, current?.id])

  const showResume = current !== null && !playing
  const pinnedPlaylists = libraryData.playlists.filter((playlist) => playlist.pinned)
  const showQuick = tiles.length > 0 && !homePrefs.hiddenSections.includes('quick')

  const sections = orderHomeSections(
    [
      ...(pinnedPlaylists.length > 0 ? [{ id: 'pinned' }] : []),
      { id: 'trending' },
      ...(home.data?.map((section) => ({ id: `sc:${section.id}` })) ?? [])
    ],
    homePrefs.order,
    homePrefs.hiddenSections
  )

  const renderSection = (id: string): JSX.Element | null => {
    if (id === 'pinned') {
      return (
        <Rail key="pinned" title={t('home.pinned')}>
          {pinnedPlaylists.map((playlist) => (
            <PinnedPlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </Rail>
      )
    }
    if (id === 'trending') {
      if (trending.loading) return <Loading key="trending" />
      if (trending.error)
        return <ErrorState key="trending" message={trending.error} onRetry={trending.reload} />
      if (!trending.data || trending.data.tracks.length === 0) return null
      return (
        <Rail
          key="trending"
          title={
            trending.data.regional && trending.data.country
              ? t('home.trendingIn', { region: regionLabel(trending.data.country) })
              : t('home.trending')
          }
        >
          {trending.data.tracks.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </Rail>
      )
    }
    const section = home.data?.find((entry) => `sc:${entry.id}` === id)
    if (!section) return null
    return (
      <Rail key={section.id} title={localizeScTitle(section.title)}>
        {section.playlists.map((playlist) => (
          <PlaylistCard key={playlist.ref} playlist={playlist} />
        ))}
      </Rail>
    )
  }

  return (
    <div className="page">
      <div className="home-hero">
        <div className="hh-main">
          <div className="hh-greet">
            {authUser && (
              <button
                className="hh-avatar"
                title={authUser.name}
                aria-label={authUser.name}
                onClick={() => useNav.getState().push({ name: 'settings', section: 'account' })}
              >
                <Artwork src={authUser.avatar} alt="" round fallbackIcon="user" iconSize={20} />
              </button>
            )}
            <div className="hh-greet-text">
              <h1>
                {greeting()}, {firstName}
              </h1>
              <p>{t('home.tagline')}</p>
            </div>
          </div>
          {showResume && current && (
            <button className="resume-card" onClick={() => usePlayer.getState().toggle()}>
              <Artwork src={current.artwork} alt="" round />
              <span className="rc-info">
                <span className="rc-title" style={{ display: 'block' }}>
                  {current.title}
                </span>
                <span className="rc-sub">{t('home.continueListening')}</span>
              </span>
              <span className="rc-play">
                <Icon name="play" size={15} />
              </span>
            </button>
          )}
        </div>
        {showQuick && (
          <div className="hh-quick">
            <span className="hh-quick-label">{t('home.quick')}</span>
            <div className="hh-quick-grid">
              {tiles.map((tile) =>
                tile.kind === 'playlist' ? (
                  <button
                    key={`pl-${tile.id}`}
                    className="quick-tile"
                    onClick={() => useNav.getState().push({ name: 'playlist', ref: tile.id, local: true })}
                  >
                    <Artwork src={tile.artwork} alt="" fallbackIcon="queue" iconSize={14} />
                    <span className="qt-text">
                      <span className="qt-title">{tile.title}</span>
                      <span className="qt-sub">{tile.sub}</span>
                    </span>
                  </button>
                ) : (
                  <button
                    key={`tr-${tile.track.id}`}
                    className="quick-tile"
                    onClick={() => usePlayer.getState().playNow(tile.track)}
                  >
                    <Artwork src={tile.track.artworkSmall ?? tile.track.artwork} alt="" iconSize={14} />
                    <span className="qt-text">
                      <span className="qt-title">{tile.track.title}</span>
                      <span className="qt-sub">{tile.track.artist}</span>
                    </span>
                    <span className="qt-play">
                      <Icon name="play" size={13} />
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {sections.map((section) => renderSection(section.id))}
    </div>
  )
}
