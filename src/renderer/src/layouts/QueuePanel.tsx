import { type JSX } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { usePlayer } from '@renderer/player/store'
import { useUi } from '@renderer/stores/ui'
import { useExitAnimation } from '@renderer/hooks/use-exit'
import { Empty } from '@renderer/components/Status'
import { Icon } from '@renderer/components/Icon'
import { Artwork } from '@renderer/components/Artwork'
import { cx, formatTime } from '@renderer/utils/format'

export function QueuePanel(): JSX.Element | null {
  useLanguage()
  const open = useUi((state) => state.queueOpen)
  const toggleQueue = useUi((state) => state.toggleQueue)
  const { mounted, closing } = useExitAnimation(open, 180)
  const queueLength = usePlayer((state) => state.queue.length)
  const index = usePlayer((state) => state.index)
  const hasCurrent = usePlayer((state) => state.current !== null)
  const clearQueue = usePlayer((state) => state.clearQueue)
  const jamQueueLength = usePlayer((state) => state.jamQueue.length)
  const stashedCount = usePlayer((state) => state.stash?.queue.length ?? 0)
  const inJam = usePlayer((state) => state.stash !== null)

  if (!mounted) return null
  const upNextCount = Math.max(0, queueLength - index - 1)

  return (
    <div className={cx('side-panel glass', closing && 'closing')} role="dialog" aria-label={t('queue.title')}>
      <div className="panel-head">
        <h3>{t('queue.title')}</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(queueLength > 1 || jamQueueLength > 0) && (
            <button className="btn small" onClick={clearQueue}>
              {t('queue.clear')}
            </button>
          )}
          <button className="icon-btn" onClick={() => toggleQueue(false)} aria-label={t('common.close')}>
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      <div className="panel-body">
        {queueLength === 0 && jamQueueLength === 0 ? (
          <Empty icon="queue" title={t('queue.empty')} hint={t('queue.emptyHint')} />
        ) : (
          <>
            {hasCurrent && (
              <>
                <div className="queue-label">{t('queue.nowPlaying')}</div>
                <QueueRow index={index} active />
              </>
            )}
            {jamQueueLength > 0 && (
              <>
                <div className="queue-label jam">
                  <Icon name="radio" size={12} />
                  {t('queue.jamSection')}
                </div>
                {Array.from({ length: jamQueueLength }, (_, offset) => (
                  <JamQueueRow key={offset} index={offset} />
                ))}
              </>
            )}
            {upNextCount > 0 && (
              <>
                <div className="queue-label">{t('queue.upNext')}</div>
                {Array.from({ length: upNextCount }, (_, offset) => (
                  <QueueRow key={index + 1 + offset} index={index + 1 + offset} />
                ))}
              </>
            )}
            {inJam && stashedCount > 0 && (
              <div className="queue-stash-note">{t('queue.personalAfterJam', { count: stashedCount })}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Row of the SHARED jam queue — shows who added the track. */
function JamQueueRow({ index }: { index: number }): JSX.Element | null {
  const track = usePlayer((state) => state.jamQueue[index])
  const locked = usePlayer((state) => state.jamLocked)
  if (!track) return null
  return (
    <div className="track-row">
      <div className="tr-index">
        <span className="tr-num">{index + 1}</span>
      </div>
      <Artwork src={track.artworkSmall ?? track.artwork} alt="" />
      <div className="tr-main">
        <div className="tr-title">{track.title}</div>
        <div className="tr-artist" style={{ cursor: 'default', textDecoration: 'none' }}>
          {track.artist}
          {track.jamAddedBy && <span className="q-added-by">· {track.jamAddedBy}</span>}
        </div>
      </div>
      <div className="tr-actions">
        {!locked && (
          <button
            className="icon-btn"
            aria-label={t('menu.removeFromQueue')}
            onClick={() => usePlayer.getState().jamRemoveFromQueue(index)}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="tr-meta">{formatTime(track.duration)}</div>
    </div>
  )
}

function QueueRow({ index, active = false }: { index: number; active?: boolean }): JSX.Element | null {
  const track = usePlayer((state) => state.queue[index])
  const playing = usePlayer((state) => state.playing)
  if (!track) return null
  return (
    <div className={cx('track-row', active && 'active')} onDoubleClick={() => usePlayer.getState().jumpTo(index)}>
      <div className="tr-index">
        {active ? (
          <div className={cx('eq', !playing && 'paused')}>
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            <span className="tr-num">{index + 1}</span>
            <button
              className="tr-play-hover"
              onClick={() => usePlayer.getState().jumpTo(index)}
              aria-label={t('common.play')}
              tabIndex={-1}
            >
              <Icon name="play" size={14} />
            </button>
          </>
        )}
      </div>
      <Artwork src={track.artworkSmall ?? track.artwork} alt="" />
      <div className="tr-main">
        <div className="tr-title">{track.title}</div>
        <div className="tr-artist" style={{ cursor: 'default', textDecoration: 'none' }}>
          {track.artist}
          {track.jamAddedBy && <span className="q-added-by">· {track.jamAddedBy}</span>}
        </div>
      </div>
      <div className="tr-actions">
        {!active && (
          <button
            className="icon-btn"
            aria-label={t('menu.removeFromQueue')}
            onClick={() => usePlayer.getState().removeFromQueue(index)}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      <div className="tr-meta">{formatTime(track.duration)}</div>
    </div>
  )
}
