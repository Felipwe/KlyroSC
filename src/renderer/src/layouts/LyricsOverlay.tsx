import { memo, useEffect, useRef, useState, type JSX, type RefObject } from 'react'
import { type Lyrics, type SyncedLine } from '@shared/types/player'
import { activeLineIndex } from '@shared/utils/lrc'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { usePlayer } from '@renderer/player/store'
import { useUi } from '@renderer/stores/ui'
import { useExitAnimation } from '@renderer/hooks/use-exit'
import { Artwork } from '@renderer/components/Artwork'
import { Icon } from '@renderer/components/Icon'
import { Empty, Loading } from '@renderer/components/Status'
import { cx } from '@renderer/utils/format'

export function LyricsOverlay(): JSX.Element | null {
  useLanguage()
  const open = useUi((state) => state.lyricsOpen)
  const toggleLyrics = useUi((state) => state.toggleLyrics)
  const track = usePlayer((state) => state.current)
  const { mounted, closing } = useExitAnimation(open && track !== null, 200)
  const position = usePlayer((state) => state.position)
  const decodedDuration = usePlayer((state) => state.duration)
  const [state, setState] = useState<'loading' | 'done' | 'none'>('loading')
  const [lyrics, setLyrics] = useState<Lyrics>({ synced: null, plain: null })
  const contentRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const trackId = track?.id ?? null
  const lyricsArtist = track?.lyricsArtist ?? track?.artist ?? ''
  const lyricsTitle = track?.title ?? ''

  const lookupDuration = track
    ? Math.round(
        decodedDuration > 0 &&
          (track.duration <= 0 || decodedDuration >= track.duration * 0.75)
          ? decodedDuration
          : track.duration
      )
    : 0

  useEffect(() => {
    if (!open || trackId === null || !lyricsArtist || !lyricsTitle) return
    let cancelled = false
    setState('loading')
    setLyrics({ synced: null, plain: null })
    void api.lyrics.get(lyricsArtist, lyricsTitle, lookupDuration).then((result) => {
      if (cancelled) return
      if (result.ok && (result.data.synced || result.data.plain)) {
        setLyrics(result.data)
        setState('done')
      } else {
        setState('none')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, trackId, lyricsArtist, lyricsTitle, lookupDuration])

  const active = lyrics.synced ? activeLineIndex(lyrics.synced, position) : -1

  useEffect(() => {
    const content = contentRef.current
    const line = activeRef.current
    if (!content || !line) return
    const top = line.offsetTop - (content.clientHeight - line.offsetHeight) / 2
    content.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [active])

  useEffect(() => {
    if (open) contentRef.current?.scrollTo({ top: 0 })
  }, [open, trackId])

  useEffect(() => {
    if (open && !track) toggleLyrics(false)
  }, [open, track, toggleLyrics])

  if (!mounted || !track) return null

  return (
    <div className={cx('lyrics-overlay', closing && 'closing')} style={{ background: 'var(--bg)' }}>
      {track.artwork && <div className="lyrics-backdrop" style={{ backgroundImage: `url(${track.artwork})` }} />}
      <div className="lyrics-head">
        <div className="lh-track">
          <Artwork src={track.artwork} alt="" />
          <div style={{ minWidth: 0 }}>
            <div className="pb-title">{track.title}</div>
            <div className="pb-artist" style={{ cursor: 'default' }}>
              {track.artist}
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => toggleLyrics(false)} aria-label={t('common.close')}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="lyrics-content" ref={contentRef}>
        {state === 'loading' && <Loading />}
        {state === 'none' && <Empty icon="mic" title={t('lyrics.none')} hint={t('lyrics.noneHint')} />}
        {state === 'done' && lyrics.synced && (
          <SyncedLines lines={lyrics.synced} active={active} activeRef={activeRef} />
        )}
        {state === 'done' && !lyrics.synced && lyrics.plain && (
          <>
            <span className="badge" style={{ marginBottom: 18 }}>
              {t('lyrics.notSynced')}
            </span>
            <div className="lyrics-plain">{lyrics.plain}</div>
          </>
        )}
      </div>
    </div>
  )
}

const SyncedLines = memo(function SyncedLines({
  lines,
  active,
  activeRef
}: {
  lines: SyncedLine[]
  active: number
  activeRef: RefObject<HTMLDivElement | null>
}): JSX.Element {
  return (
    <>
      {lines.map((line, index) => (
        <div
          key={index}
          ref={index === active ? activeRef : undefined}
          className={cx('lyrics-line', index === active && 'active')}
          onClick={() => usePlayer.getState().seek(line.time)}
        >
          {line.text || '· · ·'}
        </div>
      ))}
    </>
  )
})
