import { useEffect, useMemo, useState, type JSX } from 'react'
import { type Track } from '@shared/types/track'
import { getLanguage, t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useAuth } from '@renderer/stores/auth'
import { useNav } from '@renderer/stores/nav'
import { useAsyncResult } from '@renderer/hooks/async'
import { personalizeTrending, tasteOf } from '@renderer/utils/trending'
import { Loading, ErrorState } from '@renderer/components/Status'
import { Rail, TrackCard, PlaylistCard } from '@renderer/components/cards'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'

function greeting(): string {
  const hour = new Date().getHours()
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

export function HomePage(): JSX.Element {
  useLanguage()
  const current = usePlayer((state) => state.current)
  const playing = usePlayer((state) => state.playing)
  const libraryData = useLibrary((state) => state.data)
  const authUser = useAuth((state) => state.state.user)

  const firstName = (authUser?.name.trim().split(/\s+/)[0] ?? t('home.anonymous')).slice(0, 18)

  const trending = useAsyncResult(() => api.sc.charts('all-music'), [])
  const home = useAsyncResult(() => api.sc.home(), [])
  const [country, setCountry] = useState('')

  useEffect(() => {
    void api.app.info().then((info) => setCountry(info.country))
  }, [])

  const ranked = useMemo(() => {
    if (!trending.data) return []
    const taste = tasteOf([
      ...libraryData.history.map((entry) => entry.track),
      ...libraryData.favorites.map((favorite) => favorite.track)
    ])
    return personalizeTrending(trending.data, taste)
  }, [trending.data, libraryData])

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

  return (
    <div className="page">
      <div className="home-hero">
        <div className="hh-main">
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p>{t('home.tagline')}</p>
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
        {tiles.length > 0 && (
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

      {trending.loading ? (
        <Loading />
      ) : trending.error ? (
        <ErrorState message={trending.error} onRetry={trending.reload} />
      ) : (
        ranked.length > 0 && (
          <Rail title={country ? t('home.trendingIn', { region: regionLabel(country) }) : t('home.trending')}>
            {ranked.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </Rail>
        )
      )}

      {home.data?.map((section) => (
        <Rail key={section.id} title={section.title}>
          {section.playlists.map((playlist) => (
            <PlaylistCard key={playlist.ref} playlist={playlist} />
          ))}
        </Rail>
      ))}
    </div>
  )
}
