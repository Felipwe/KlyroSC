import { useEffect, useState, type JSX } from 'react'
import { type Page, type TrackComment } from '@shared/types/track'
import { t, useLanguage, getLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useNav } from '@renderer/stores/nav'
import { useAsyncResult } from '@renderer/hooks/async'
import { Empty, ErrorState, Loading } from '@renderer/components/Status'
import { TrackList } from '@renderer/components/TrackList'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { formatCount, formatDate, formatTime } from '@renderer/utils/format'

export function TrackPage({ id }: { id: number }): JSX.Element {
  useLanguage()
  const track = useAsyncResult(() => api.sc.track(id), [id])
  const related = useAsyncResult(() => api.sc.related(id), [id])
  const [comments, setComments] = useState<Page<TrackComment> | null>(null)
  const [loadingComments, setLoadingComments] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const playing = usePlayer((state) => state.playing && state.current?.id === id)
  const isFavorite = useLibrary((state) => state.favoriteIds.has(id))

  useEffect(() => {
    let cancelled = false
    setLoadingComments(true)
    setComments(null)
    void api.sc.comments(id).then((result) => {
      if (cancelled) return
      setLoadingComments(false)
      if (result.ok) setComments(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (track.loading) return <Loading />
  if (track.error || !track.data)
    return <ErrorState message={track.error ?? undefined} onRetry={track.reload} />

  const data = track.data
  const locale = getLanguage() === 'pt' ? 'pt-BR' : 'en-US'
  const posted = data.createdAt ? formatDate(Date.parse(data.createdAt), locale) : ''

  const loadMore = async (): Promise<void> => {
    if (!comments?.nextHref || loadingMore) return
    setLoadingMore(true)
    const result = await api.sc.comments(id, comments.nextHref)
    setLoadingMore(false)
    if (result.ok)
      setComments({ items: [...comments.items, ...result.data.items], nextHref: result.data.nextHref })
  }

  return (
    <div className="page">
      <div className="track-hero">
        <Artwork src={data.artwork} alt={data.title} iconSize={44} />
        <div className="th-info">
          <h1>{data.title}</h1>
          <div
            className="th-artist"
            onClick={() => data.artistId > 0 && useNav.getState().push({ name: 'artist', id: data.artistId })}
          >
            <Artwork src={data.artistAvatar} alt="" round iconSize={12} fallbackIcon="user" />
            <span>{data.artist}</span>
          </div>
          <div className="th-meta">
            {data.genre && <span className="badge accent">{data.genre}</span>}
            {posted && <span>{posted}</span>}
          </div>
          <div className="th-stats">
            <span className="stat-chip" title={t('trackPage.plays')}>
              <Icon name="playCircle" size={14} />
              {formatCount(data.playCount)}
            </span>
            <span className="stat-chip" title={t('trackPage.likes')}>
              <Icon name="heart" size={14} />
              {formatCount(data.likeCount)}
            </span>
            <span className="stat-chip" title={t('trackPage.reposts')}>
              <Icon name="repost" size={14} />
              {formatCount(data.repostCount ?? 0)}
            </span>
            <span className="stat-chip" title={t('trackPage.comments')}>
              <Icon name="comment" size={14} />
              {formatCount(data.commentCount ?? 0)}
            </span>
          </div>
          <div className="ah-actions">
            <button className="btn primary" onClick={() => usePlayer.getState().playNow(data)}>
              <Icon name={playing ? 'pause' : 'play'} size={15} />
              {playing ? t('player.pause') : t('player.play')}
            </button>
            <button
              className="btn"
              onClick={() => void useLibrary.getState().toggleFavorite(data)}
            >
              <Icon name={isFavorite ? 'heartFill' : 'heart'} size={15} />
              {isFavorite ? t('player.unfavorite') : t('player.favorite')}
            </button>
            <button className="btn" onClick={() => usePlayer.getState().addToQueue([data])}>
              <Icon name="queue" size={15} />
              {t('menu.addToQueue')}
            </button>
            {data.url && (
              <button className="btn" onClick={() => api.app.openExternal(data.url)}>
                <Icon name="external" size={15} />
                SoundCloud
              </button>
            )}
          </div>
        </div>
      </div>

      {data.description && (
        <section className="rail">
          <div className="rail-head">
            <h2 className="rail-title">{t('artist.about')}</h2>
          </div>
          <p className="artist-about">{data.description.slice(0, 1200)}</p>
        </section>
      )}

      <section className="rail">
        <div className="rail-head">
          <h2 className="rail-title">
            {t('trackPage.comments')}
            {(data.commentCount ?? 0) > 0 && (
              <span className="badge" style={{ marginLeft: 10 }}>
                {formatCount(data.commentCount ?? 0)}
              </span>
            )}
          </h2>
        </div>
        {loadingComments ? (
          <Loading />
        ) : !comments || comments.items.length === 0 ? (
          <Empty icon="comment" title={t('trackPage.commentsEmpty')} />
        ) : (
          <div className="comment-list">
            {comments.items.map((comment) => (
              <div key={comment.id} className="comment-row">
                <Artwork src={comment.userAvatar} alt="" round fallbackIcon="user" iconSize={14} />
                <div className="cm-main">
                  <div className="cm-head">
                    <span className="cm-name">{comment.userName}</span>
                    {comment.timestamp !== null && (
                      <button
                        className="badge accent cm-time"
                        title={t('trackPage.jumpTo')}
                        onClick={() => {
                          const player = usePlayer.getState()
                          if (player.current?.id === id && comment.timestamp !== null)
                            player.seek(comment.timestamp)
                        }}
                      >
                        {formatTime(comment.timestamp)}
                      </button>
                    )}
                    {comment.createdAt && (
                      <span className="cm-date">{formatDate(Date.parse(comment.createdAt), locale)}</span>
                    )}
                  </div>
                  <div className="cm-body">{comment.body}</div>
                </div>
              </div>
            ))}
            {comments.nextHref && (
              <div style={{ display: 'grid', placeItems: 'center', padding: 14 }}>
                <button className="btn small" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? <div className="spinner small" /> : t('trackPage.loadMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {related.data && related.data.length > 0 && (
        <section className="rail">
          <div className="rail-head">
            <h2 className="rail-title">{t('trackPage.related')}</h2>
          </div>
          <TrackList tracks={related.data} />
        </section>
      )}
    </div>
  )
}
