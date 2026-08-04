import { usePlayer } from './store'

let initialized = false

export function initMediaSession(): void {
  if (initialized || !('mediaSession' in navigator)) return
  initialized = true
  const session = navigator.mediaSession

  session.setActionHandler('play', () => usePlayer.getState().toggle())
  session.setActionHandler('pause', () => usePlayer.getState().toggle())
  session.setActionHandler('previoustrack', () => usePlayer.getState().previous())
  session.setActionHandler('nexttrack', () => usePlayer.getState().next())
  session.setActionHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number') usePlayer.getState().seek(details.seekTime)
  })
  session.setActionHandler('seekbackward', () =>
    usePlayer.getState().seek(Math.max(0, usePlayer.getState().position - 10))
  )
  session.setActionHandler('seekforward', () =>
    usePlayer.getState().seek(usePlayer.getState().position + 10)
  )

  usePlayer.subscribe((state, previous) => {
    if (state.current !== previous.current) {
      if (state.current) {
        session.metadata = new MediaMetadata({
          title: state.current.title,
          artist: state.current.artist,
          artwork: state.current.artwork
            ? [{ src: state.current.artwork, sizes: '500x500', type: 'image/jpeg' }]
            : []
        })
      } else {
        session.metadata = null
      }
    }
    if (state.playing !== previous.playing)
      session.playbackState = state.playing ? 'playing' : 'paused'
    if (
      state.duration > 0 &&
      (state.current !== previous.current || Math.abs(state.position - previous.position) > 2)
    ) {
      try {
        session.setPositionState({
          duration: state.duration,
          playbackRate: 1,
          position: Math.min(state.position, state.duration)
        })
      } catch {
        /* invalid transient state */
      }
    }
  })
}
