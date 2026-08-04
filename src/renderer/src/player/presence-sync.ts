import { type PlayerEvent } from '@shared/types/player'
import { api } from '@renderer/services/ipc'
import { usePlayer } from './store'

let lastSent: { positionSec: number; at: number; playing: boolean; trackId: number | null } = {
  positionSec: 0,
  at: 0,
  playing: false,
  trackId: null
}

function sendPresence(): void {
  const state = usePlayer.getState()
  if (!state.current) {
    api.presence.update(null)
    lastSent = { positionSec: 0, at: 0, playing: false, trackId: null }
    return
  }
  api.presence.update({
    title: state.current.title,
    artist: state.current.artist,
    artworkUrl: state.current.artwork,
    trackUrl: state.current.url,
    durationSec: state.duration,
    positionSec: state.position,
    playing: state.playing
  })
  lastSent = {
    positionSec: state.position,
    at: Date.now(),
    playing: state.playing,
    trackId: state.current.id
  }
}

const emitPluginEvent = (event: PlayerEvent): void => api.plugins.emitPlayerEvent(event)

let initialized = false

export function initPresenceSync(): void {
  if (initialized) return
  initialized = true
  let progressTick = 0

  usePlayer.subscribe((state, previous) => {
    if (state.current?.id !== previous.current?.id) {
      sendPresence()
      emitPluginEvent({ type: 'track', track: state.current })
      return
    }
    if (state.playing !== previous.playing) {
      sendPresence()
      emitPluginEvent({ type: 'state', playing: state.playing })
      return
    }
    if (state.position !== previous.position && state.playing) {
      const expected = lastSent.positionSec + (Date.now() - lastSent.at) / 1000
      if (Math.abs(state.position - expected) > 3) sendPresence()
      progressTick++
      if (progressTick % 10 === 0)
        emitPluginEvent({ type: 'progress', position: state.position, duration: state.duration })
    }
  })

  window.addEventListener('beforeunload', () => api.presence.update(null))
}
