import { type JSX } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { usePlayer } from '@renderer/player/store'
import { useUi } from '@renderer/stores/ui'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { Slider } from '@renderer/components/controls'

export function MiniPlayer(): JSX.Element {
  useLanguage()
  const player = usePlayer()
  const setMiniMode = useUi((state) => state.setMiniMode)

  return (
    <div className="mini-player">
      <div className="ambient" />
      <Artwork src={player.current?.artwork ?? null} alt="" />
      <div className="mini-main">
        <div className="mini-title">{player.current?.title ?? t('player.nothingPlaying')}</div>
        <div className="mini-artist">{player.current?.artist ?? t('player.nothingPlayingHint')}</div>
        <div className="mini-controls">
          <button className="icon-btn" onClick={player.previous} aria-label={t('player.previous')}>
            <Icon name="previous" size={16} />
          </button>
          <button
            className="pb-play"
            style={{ width: 34, height: 34 }}
            onClick={player.toggle}
            aria-label={player.playing ? t('player.pause') : t('player.play')}
          >
            <Icon name={player.playing ? 'pause' : 'play'} size={15} />
          </button>
          <button className="icon-btn" onClick={() => player.next()} aria-label={t('player.next')}>
            <Icon name="next" size={16} />
          </button>
        </div>
        <Slider value={player.position} max={player.duration} step={1} onChange={player.seek} ariaLabel="seek" />
      </div>
      <button
        className="icon-btn mini-close"
        onClick={() => setMiniMode(false)}
        aria-label={t('player.expand')}
        title={t('player.expand')}
      >
        <Icon name="expand" size={14} />
      </button>
    </div>
  )
}
