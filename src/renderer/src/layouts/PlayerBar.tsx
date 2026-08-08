import { useEffect, useRef, type JSX } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { usePlayer } from '@renderer/player/store'
import { useLibrary } from '@renderer/stores/library'
import { useNav } from '@renderer/stores/nav'
import { useUi } from '@renderer/stores/ui'
import { cx, formatTime } from '@renderer/utils/format'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { Slider } from '@renderer/components/controls'
import { JamMenuButton } from '@renderer/components/JamMenu'
import { openTrackMenuAt } from '@renderer/hooks/track-menu'

export function PlayerBar(): JSX.Element {
  useLanguage()
  const player = usePlayer()
  const isFavorite = useLibrary((state) =>
    player.current ? state.favoriteIds.has(player.current.id) : false
  )
  const ui = useUi()
  // single click toggles shuffle after a short window; a second click within it fires Smart Shuffle
  const shuffleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (shuffleClickTimer.current) clearTimeout(shuffleClickTimer.current)
    },
    []
  )

  const onShuffleClick = (): void => {
    if (shuffleClickTimer.current) {
      clearTimeout(shuffleClickTimer.current)
      shuffleClickTimer.current = null
      usePlayer.getState().toggleSmartShuffle()
      return
    }
    shuffleClickTimer.current = setTimeout(() => {
      shuffleClickTimer.current = null
      usePlayer.getState().toggleShuffle()
    }, 260)
  }

  const repeatLabel =
    player.repeat === 'one'
      ? t('player.repeatOne')
      : player.repeat === 'all'
        ? t('player.repeatAll')
        : t('player.repeat')

  return (
    <footer className="player-bar glass">
      <div className="pb-now">
        {player.current ? (
          <>
            <button
              className="pb-art-link"
              aria-label={player.current.title}
              onClick={() =>
                player.current && useNav.getState().push({ name: 'track', id: player.current.id })
              }
            >
              <Artwork src={player.current.artwork} alt="" />
            </button>
            <div className="pb-info">
              <div
                className="pb-title"
                title={player.current.title}
                onClick={() =>
                  player.current && useNav.getState().push({ name: 'track', id: player.current.id })
                }
                onContextMenu={(event) => player.current && openTrackMenuAt(event, player.current)}
              >
                {player.current.title}
                {player.previewActive && (
                  <span className="badge warn pb-preview" title={t('player.snippet')}>
                    {t('player.preview')}
                  </span>
                )}
              </div>
              <div
                className="pb-artist"
                onClick={() =>
                  player.current &&
                  player.current.artistId > 0 &&
                  useNav.getState().push({ name: 'artist', id: player.current.artistId })
                }
              >
                {player.current.artist}
              </div>
            </div>
            <button
              className={cx('icon-btn', isFavorite && 'active')}
              aria-label={isFavorite ? t('player.unfavorite') : t('player.favorite')}
              onClick={() => player.current && void useLibrary.getState().toggleFavorite(player.current)}
            >
              <Icon name={isFavorite ? 'heartFill' : 'heart'} size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="artwork" style={{ width: 56 }}>
              <div className="artwork-fallback">
                <Icon name="disc" size={20} />
              </div>
            </div>
            <div className="pb-info">
              <div className="pb-title">{t('player.nothingPlaying')}</div>
              <div className="pb-artist" style={{ cursor: 'default', textDecoration: 'none' }}>
                {t('player.nothingPlayingHint')}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pb-center">
        <div className="pb-controls">
          <button
            className={cx('icon-btn pb-shuffle', player.shuffle && 'active', player.smartShuffle && 'smart')}
            onClick={onShuffleClick}
            aria-label={player.smartShuffle ? t('player.smartShuffle') : t('player.shuffle')}
            title={player.smartShuffle ? t('player.smartShuffleActive') : t('player.shuffleHint')}
          >
            <Icon name="shuffle" size={16} />
            {player.smartShuffle && (
              <span className="pb-smart-spark" aria-hidden="true">
                <Icon name="sparkle" size={9} />
              </span>
            )}
          </button>
          <button
            className="icon-btn"
            onClick={player.previous}
            aria-label={t('player.previous')}
            title={t('player.previous')}
          >
            <Icon name="previous" size={19} />
          </button>
          <button
            className="pb-play"
            onClick={player.toggle}
            aria-label={player.playing ? t('player.pause') : t('player.play')}
          >
            {player.buffering ? (
              <div className="spinner small" style={{ borderTopColor: '#fff' }} />
            ) : (
              <Icon name={player.playing ? 'pause' : 'play'} size={20} />
            )}
          </button>
          <button
            className="icon-btn"
            onClick={() => player.next()}
            aria-label={t('player.next')}
            title={t('player.next')}
          >
            <Icon name="next" size={19} />
          </button>
          <button
            className={cx('icon-btn', player.repeat !== 'off' && 'active')}
            onClick={player.cycleRepeat}
            aria-label={repeatLabel}
            title={repeatLabel}
            style={{ position: 'relative' }}
          >
            <Icon name="repeat" size={16} />
            {player.repeat === 'one' && <span className="repeat-badge">1</span>}
          </button>
        </div>
        <div className="pb-timeline">
          <span className="pb-time">{formatTime(player.position)}</span>
          <Slider
            value={player.position}
            max={player.duration}
            step={1}
            onChange={player.seek}
            ariaLabel={t('player.play')}
          />
          <span className="pb-time right">{formatTime(player.duration)}</span>
        </div>
      </div>

      <div className="pb-side">
        <JamMenuButton />
        <button
          className={cx('icon-btn', ui.lyricsOpen && 'active')}
          onClick={() => ui.toggleLyrics()}
          aria-label={t('player.lyrics')}
          title={t('player.lyrics')}
        >
          <Icon name="mic" size={16} />
        </button>
        <button
          className={cx('icon-btn', ui.queueOpen && 'active')}
          onClick={() => ui.toggleQueue()}
          aria-label={t('player.queue')}
          title={t('player.queue')}
        >
          <Icon name="queue" size={16} />
        </button>
        <div className="pb-volume">
          <button
            className="icon-btn"
            onClick={player.toggleMute}
            aria-label={player.muted ? t('player.unmute') : t('player.mute')}
          >
            <Icon name={player.muted || player.volume === 0 ? 'volumeMute' : 'volume'} size={16} />
          </button>
          <Slider
            value={player.muted ? 0 : player.volume}
            max={1}
            onChange={player.setVolume}
            ariaLabel={t('player.mute')}
          />
        </div>
        <button
          className="icon-btn"
          onClick={() => ui.setMiniMode(true)}
          aria-label={t('player.mini')}
          title={t('player.mini')}
        >
          <Icon name="mini" size={16} />
        </button>
      </div>
    </footer>
  )
}
