import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { type PlaylistLite, type Track, type Artist } from '@shared/types/track'
import { t } from '@renderer/i18n'
import { formatCount } from '@renderer/utils/format'
import { usePlayer } from '@renderer/player/store'
import { useNav } from '@renderer/stores/nav'
import { openTrackMenuAt } from '@renderer/hooks/track-menu'
import { Artwork } from './Artwork'
import { Icon } from './Icon'

export function Rail({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [arrows, setArrows] = useState({ left: false, right: false })

  const updateArrows = useCallback((): void => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const next = { left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 }
    setArrows((prev) => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(updateArrows)
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateArrows, children])

  const scrollByPage = (direction: 1 | -1): void => {
    const el = scrollerRef.current
    el?.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="rail">
      <div className="rail-head">
        <h2 className="rail-title">{title}</h2>
        {(arrows.left || arrows.right) && (
          <div className="rail-arrows">
            <button
              className="icon-btn"
              disabled={!arrows.left}
              aria-label={t('common.scrollBack')}
              title={t('common.scrollBack')}
              onClick={() => scrollByPage(-1)}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <button
              className="icon-btn"
              disabled={!arrows.right}
              aria-label={t('common.scrollForward')}
              title={t('common.scrollForward')}
              onClick={() => scrollByPage(1)}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="rail-scroller" ref={scrollerRef} onScroll={updateArrows}>
        {children}
      </div>
    </section>
  )
}

export function TrackCard({ track }: { track: Track }): JSX.Element {
  const play = (): void => usePlayer.getState().playNow(track)
  return (
    <div
      className="media-card card"
      onClick={play}
      onContextMenu={(event) => openTrackMenuAt(event, track)}
    >
      <Artwork src={track.artwork} alt={track.title} />
      <div className="mc-title" title={track.title}>
        {track.title}
      </div>
      <div className="mc-sub">{track.artist}</div>
      <button
        className="mc-play"
        aria-label={t('common.play')}
        onClick={(event) => {
          event.stopPropagation()
          play()
        }}
      >
        <Icon name="play" size={18} />
      </button>
    </div>
  )
}

export function PlaylistCard({ playlist }: { playlist: PlaylistLite }): JSX.Element {
  const open = (): void => useNav.getState().push({ name: 'playlist', ref: playlist.ref, local: false })
  return (
    <div className="media-card card" onClick={open}>
      <Artwork src={playlist.artwork} alt={playlist.title} fallbackIcon="queue" />
      <div className="mc-title" title={playlist.title}>
        {playlist.title}
      </div>
      <div className="mc-sub">
        {playlist.artist ? `${playlist.artist} · ` : ''}
        {playlist.trackCount === 1 ? t('common.track') : t('common.tracks', { count: playlist.trackCount })}
      </div>
    </div>
  )
}

export function ArtistCard({ artist }: { artist: Artist }): JSX.Element {
  return (
    <div
      className="media-card card"
      onClick={() => useNav.getState().push({ name: 'artist', id: artist.id })}
    >
      <Artwork src={artist.avatar} alt={artist.name} round fallbackIcon="user" />
      <div className="mc-title" title={artist.name} style={{ textAlign: 'center' }}>
        {artist.name}
      </div>
      <div className="mc-sub" style={{ textAlign: 'center' }}>
        {t('common.followers', { count: formatCount(artist.followers) })}
      </div>
    </div>
  )
}
