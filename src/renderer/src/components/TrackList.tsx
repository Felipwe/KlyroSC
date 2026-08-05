import { memo, type JSX } from 'react'
import { type Track } from '@shared/types/track'
import { cx, formatCount, formatTime } from '@renderer/utils/format'
import { t } from '@renderer/i18n'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useNav } from '@renderer/stores/nav'
import { useUi, type MenuItem } from '@renderer/stores/ui'
import { buildTrackMenu, openTrackMenuAt } from '@renderer/hooks/track-menu'
import { Artwork } from './Artwork'
import { Icon } from './Icon'

interface TrackRowProps {
  track: Track
  index: number
  onPlay(): void
  extraMenu?: MenuItem[]
}

export const TrackRow = memo(function TrackRow({ track, index, onPlay, extraMenu }: TrackRowProps): JSX.Element {
  const isCurrent = usePlayer((state) => state.current?.id === track.id)
  const playing = usePlayer((state) => state.playing && state.current?.id === track.id)
  const isFavorite = useLibrary((state) => state.favoriteIds.has(track.id))

  return (
    <div
      className={cx('track-row', isCurrent && 'active')}
      onDoubleClick={onPlay}
      onContextMenu={(event) => openTrackMenuAt(event, track, extraMenu)}
    >
      <div className="tr-index">
        {isCurrent ? (
          <div className={cx('eq', !playing && 'paused')} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            <span className="tr-num">{index + 1}</span>
            <button
              className="tr-play-hover"
              onClick={onPlay}
              aria-label={t('common.play')}
              tabIndex={-1}
            >
              <Icon name="play" size={16} />
            </button>
          </>
        )}
      </div>
      <Artwork src={track.artworkSmall ?? track.artwork} alt="" />
      <div className="tr-main">
        <div className="tr-title" title={track.title}>
          {track.title}
        </div>
        <div
          className="tr-artist"
          onClick={() => track.artistId > 0 && useNav.getState().push({ name: 'artist', id: track.artistId })}
        >
          {track.artist}
        </div>
      </div>
      <div className="tr-actions">
        <button
          className={cx('icon-btn', isFavorite && 'active')}
          onClick={() => void useLibrary.getState().toggleFavorite(track)}
          aria-label={isFavorite ? t('player.unfavorite') : t('player.favorite')}
        >
          <Icon name={isFavorite ? 'heartFill' : 'heart'} size={16} />
        </button>
        <button
          className="icon-btn"
          aria-label={t('menu.addToQueue')}
          onClick={() => usePlayer.getState().addToQueue([track])}
        >
          <Icon name="queue" size={16} />
        </button>
        <button
          className="icon-btn"
          aria-label="Menu"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            useUi.getState().openMenu(rect.left, rect.bottom + 4, buildTrackMenu(track, extraMenu))
          }}
        >
          <Icon name="more" size={16} />
        </button>
      </div>
      <div className="tr-meta">
        {track.playCount > 0 && <span>{formatCount(track.playCount)} ▶</span>}
        <span style={{ minWidth: 40, textAlign: 'right' }}>{formatTime(track.duration)}</span>
      </div>
    </div>
  )
})

interface TrackListProps {
  tracks: Track[]
  onPlayIndex?(index: number): void
  extraMenuFor?(track: Track, index: number): MenuItem[]
}

export function TrackList({ tracks, onPlayIndex, extraMenuFor }: TrackListProps): JSX.Element {
  const playAll = (index: number): void => {
    if (onPlayIndex) onPlayIndex(index)
    else usePlayer.getState().playTracks(tracks, index)
  }
  return (
    <div className="track-list">
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          track={track}
          index={index}
          onPlay={() => playAll(index)}
          extraMenu={extraMenuFor?.(track, index)}
        />
      ))}
    </div>
  )
}
