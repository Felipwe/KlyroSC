import { useEffect, useState, type JSX } from 'react'
import { type Page, type Track } from '@shared/types/track'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useAsyncResult } from '@renderer/hooks/async'
import { TrackList } from '@renderer/components/TrackList'
import { Empty, ErrorState, Loading } from '@renderer/components/Status'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { formatCount } from '@renderer/utils/format'

export function ArtistPage({ id }: { id: number }): JSX.Element {
  useLanguage()
  const artist = useAsyncResult(() => api.sc.user(id), [id])
  const reposts = useAsyncResult(() => api.sc.userReposts(id), [id])
  const [tracksPage, setTracksPage] = useState<Page<Track> | null>(null)
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFullBio, setShowFullBio] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingTracks(true)
    setTracksPage(null)
    void api.sc.userTracks(id).then((result) => {
      if (cancelled) return
      setLoadingTracks(false)
      if (result.ok) setTracksPage(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (artist.loading) return <Loading />
  if (artist.error || !artist.data)
    return <ErrorState message={artist.error ?? undefined} onRetry={artist.reload} />

  const data = artist.data
  const tracks = tracksPage?.items ?? []

  const loadMore = async (): Promise<void> => {
    if (!tracksPage?.nextHref || loadingMore) return
    setLoadingMore(true)
    const result = await api.sc.userTracks(id, tracksPage.nextHref)
    setLoadingMore(false)
    if (result.ok)
      setTracksPage({ items: [...tracks, ...result.data.items], nextHref: result.data.nextHref })
  }

  const bio = data.description ?? ''
  const bioTruncated = bio.length > 340 && !showFullBio

  return (
    <div className="page">
      <div className="artist-hero">
        {data.banner && <div className="ah-banner" style={{ backgroundImage: `url(${data.banner})` }} />}
        <Artwork src={data.avatar} alt={data.name} round fallbackIcon="user" iconSize={44} />
        <div className="ah-info">
          <h1>
            {data.name}
            {data.verified && (
              <span className="badge accent" title={t('artist.verified')}>
                <Icon name="check" size={11} />
              </span>
            )}
          </h1>
          <div className="ah-meta">
            <span>{t('common.followers', { count: formatCount(data.followers) })}</span>
            <span>{t('common.tracks', { count: data.trackCount })}</span>
            {data.city && <span>{data.city}</span>}
          </div>
          <div className="ah-actions">
            {tracks.length > 0 && (
              <button className="btn primary" onClick={() => usePlayer.getState().playTracks(tracks)}>
                <Icon name="play" size={15} />
                {t('common.playAll')}
              </button>
            )}
            <button className="btn" onClick={() => api.app.openExternal(data.url)}>
              <Icon name="external" size={15} />
              SoundCloud
            </button>
          </div>
        </div>
      </div>

      {bio && (
        <section className="rail">
          <div className="rail-head">
            <h2 className="rail-title">{t('artist.about')}</h2>
          </div>
          <p className="artist-about">
            {bioTruncated ? `${bio.slice(0, 340)}…` : bio}
            {bio.length > 340 && (
              <button
                className="btn small"
                style={{ marginLeft: 10 }}
                onClick={() => setShowFullBio((value) => !value)}
              >
                {bioTruncated ? t('common.seeAll') : t('common.close')}
              </button>
            )}
          </p>
        </section>
      )}

      <section className="rail">
        <div className="rail-head">
          <h2 className="rail-title">{t('artist.all')}</h2>
        </div>
        {loadingTracks ? (
          <Loading />
        ) : tracks.length === 0 ? (
          <Empty icon="disc" title={t('artist.empty')} />
        ) : (
          <>
            <TrackList tracks={tracks} />
            {tracksPage?.nextHref && (
              <div style={{ display: 'grid', placeItems: 'center', padding: 22 }}>
                <button className="btn" onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? <div className="spinner small" /> : <Icon name="arrowDown" size={15} />}
                  {t('common.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {reposts.data && reposts.data.length > 0 && (
        <section className="rail">
          <div className="rail-head">
            <h2 className="rail-title">{t('artist.reposts')}</h2>
          </div>
          <TrackList tracks={reposts.data} />
        </section>
      )}
    </div>
  )
}
