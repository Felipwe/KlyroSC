import { useEffect, useState, type JSX } from 'react'
import { type Page, type TrackComment } from '@shared/types/track'
import { t, useLanguage, getLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useAuth } from '@renderer/stores/auth'
import { useNav } from '@renderer/stores/nav'
import { toast } from '@renderer/stores/toasts'
import { useAsyncResult } from '@renderer/hooks/async'
import { Empty, ErrorState, Loading } from '@renderer/components/Status'
import { TrackList } from '@renderer/components/TrackList'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { cx, formatCount, formatDate, formatTime } from '@renderer/utils/format'

export function TrackPage({ id }: { id: number }): JSX.Element {
  useLanguage()
  const track = useAsyncResult(() => api.sc.track(id), [id])
  const related = useAsyncResult(() => api.sc.related(id), [id])
  const [comments, setComments] = useState<Page<TrackComment> | null>(null)
  const [loadingComments, setLoadingComments] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [reposted, setReposted] = useState(false)
  const [repostBusy, setRepostBusy] = useState(false)

  const playing = usePlayer((state) => state.playing && state.current?.id === id)
  const isFavorite = useLibrary((state) => state.favoriteIds.has(id))
  const loggedUser = useAuth((state) => state.state.user)

  useEffect(() => {
    let cancelled = false
    setLoadingComments(true)
    setComments(null)
    setDraft('')
    setReposted(false)
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

  const openProfile = (userId: number): void => {
    if (userId > 0) useNav.getState().push({ name: 'artist', id: userId })
  }

  const submitComment = async (): Promise<void> => {
    const body = draft.trim()
    if (!body || sending) return
    if (!useAuth.getState().requireLogin()) return
    setSending(true)
    const player = usePlayer.getState()
    const timestampMs = player.current?.id === id ? Math.round(player.position * 1000) : null
    const result = await api.sc.addComment(id, body, timestampMs)
    setSending(false)
    if (!result.ok) {
      toast(t('trackPage.commentFailed'), 'error')
      return
    }
    setDraft('')
    toast(t('trackPage.commentPosted'), 'success')
    const fresh = await api.sc.comments(id)
    if (fresh.ok) setComments(fresh.data)
  }

  const toggleRepost = async (): Promise<void> => {
    if (repostBusy) return
    if (!useAuth.getState().requireLogin()) return
    setRepostBusy(true)
    const next = !reposted
    const result = await api.sc.setRepost(id, next)
    setRepostBusy(false)
    if (!result.ok) {
      toast(t('trackPage.repostFailed'), 'error')
      return
    }
    setReposted(next)
    toast(next ? t('trackPage.repostDone') : t('trackPage.repostRemoved'), 'success')
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
            <button
              className={cx('btn', reposted && 'primary')}
              disabled={repostBusy}
              onClick={() => void toggleRepost()}
            >
              <Icon name="repost" size={15} />
              {reposted ? t('trackPage.reposted') : t('trackPage.repost')}
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
        <div className="comment-composer">
          <Artwork
            src={loggedUser?.avatar ?? null}
            alt=""
            round
            fallbackIcon="user"
            iconSize={14}
            className="cc-avatar"
          />
          <input
            className="text-input"
            type="text"
            maxLength={500}
            value={draft}
            placeholder={t('trackPage.commentPlaceholder')}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitComment()
            }}
          />
          <button
            className="btn primary small"
            disabled={sending || draft.trim().length === 0}
            onClick={() => void submitComment()}
          >
            {sending ? <div className="spinner small" style={{ borderTopColor: '#fff' }} /> : t('trackPage.send')}
          </button>
        </div>
        {loadingComments ? (
          <Loading />
        ) : !comments || comments.items.length === 0 ? (
          <Empty icon="comment" title={t('trackPage.commentsEmpty')} />
        ) : (
          <div className="comment-list">
            {comments.items.map((comment) => (
              <div key={comment.id} className="comment-row">
                <Artwork
                  src={comment.userAvatar}
                  alt={comment.userName}
                  round
                  fallbackIcon="user"
                  iconSize={14}
                  onClick={() => openProfile(comment.userId)}
                />
                <div className="cm-main">
                  <div className="cm-head">
                    <span className="cm-name" onClick={() => openProfile(comment.userId)}>
                      {comment.userName}
                    </span>
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
