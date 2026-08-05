import { create } from 'zustand'
import { type Track } from '@shared/types/track'
import { type RepeatMode } from '@shared/types/player'
import { QUEUE_PERSIST_LIMIT } from '@shared/constants'
import { api } from '@renderer/services/ipc'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/stores/toasts'
import { useLibrary } from '@renderer/stores/library'
import { useSettings } from '@renderer/stores/settings'
import { AudioEngine } from './engine'
import { dedupeAppend, nextIndex, previousIndex, shuffled, smartShuffled, unshuffled } from './queue-utils'

interface PlayerState {
  queue: Track[]
  originalQueue: Track[] | null
  index: number
  current: Track | null
  playing: boolean
  buffering: boolean
  position: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  previewActive: boolean

  playTracks(tracks: Track[], startIndex?: number): void
  playNow(track: Track): void
  playNext(track: Track): void
  addToQueue(tracks: Track[]): void
  removeFromQueue(index: number): void
  jumpTo(index: number): void
  clearQueue(): void
  toggle(): void
  next(auto?: boolean): void
  previous(): void
  seek(position: number): void
  setVolume(volume: number): void
  toggleMute(): void
  toggleShuffle(): void
  cycleRepeat(): void
}

let engine: AudioEngine | null = null
let historyCounted = false
let consecutiveErrors = 0
let playerInitialized = false
let smartShuffleEnabled = true

const pickShuffle = (): typeof shuffled => (smartShuffleEnabled ? smartShuffled : shuffled)

const getEngine = (): AudioEngine => {
  if (engine) return engine
  engine = new AudioEngine({
    onDuration: (duration) => {
      const track = usePlayer.getState().current
      const previewActive =
        track !== null && duration > 0 && duration <= 65 && duration < track.duration * 0.6
      usePlayer.setState({ duration, previewActive })
    },
    onTime: (position) => {
      usePlayer.setState({ position })
      maybeCountHistory(position)
    },
    onEnded: () => usePlayer.getState().next(true),
    onBuffering: (buffering) => usePlayer.setState({ buffering }),
    onPlayingChange: (playing) => usePlayer.setState({ playing }),
    onError: (message) => {
      const state = usePlayer.getState()
      const title = state.current?.title ?? ''
      consecutiveErrors++
      api.log('warn', `playback error on "${title}": ${message}`)
      if (consecutiveErrors === 1 && state.current) {
        api.log('info', `retrying "${title}" with a fresh stream url`)
        startTrack(state.index, true, state.position > 2 ? state.position : 0, true)
        return
      }
      if (consecutiveErrors >= 4 || state.queue.length <= 1) {
        toast(t('toast.playbackError', { title }), 'error')
        usePlayer.setState({ playing: false, buffering: false })
      } else {
        toast(t('toast.trackSkipped'), 'error')
        state.next(true)
      }
    }
  })
  return engine
}

function maybeCountHistory(position: number): void {
  if (historyCounted) return
  const { current, duration } = usePlayer.getState()
  if (!current || duration <= 0) return
  if (position >= 30 || position >= duration * 0.5) {
    historyCounted = true
    useLibrary.getState().addHistory(current)
  }
}

function startTrack(index: number, autoplay = true, startAt = 0, fresh = false): void {
  const { queue } = usePlayer.getState()
  const track = queue[index]
  if (!track) return
  historyCounted = startAt > 0
  usePlayer.setState({
    index,
    current: track,
    position: startAt,
    duration: track.duration,
    buffering: true,
    playing: false,
    previewActive: false
  })
  void getEngine()
    .load(track.id, autoplay, startAt, fresh)
    .then((ok) => {
      if (ok) consecutiveErrors = 0
    })
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  originalQueue: null,
  index: 0,
  current: null,
  playing: false,
  buffering: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: 'off',
  previewActive: false,

  playTracks: (tracks, startIndex = 0) => {
    if (tracks.length === 0) return
    const shuffleOn = get().shuffle
    if (shuffleOn) {
      const result = pickShuffle()(tracks, startIndex)
      set({ queue: result.queue, originalQueue: [...tracks] })
      startTrack(result.index)
    } else {
      set({ queue: [...tracks], originalQueue: null })
      startTrack(startIndex)
    }
  },

  playNow: (track) => {
    const { queue, index, current } = get()
    if (current?.id === track.id) {
      get().toggle()
      return
    }
    const existing = queue.findIndex((item) => item.id === track.id)
    if (existing >= 0) {
      startTrack(existing)
      return
    }
    const next = [...queue]
    next.splice(index + (queue.length > 0 ? 1 : 0), 0, track)
    set({ queue: next })
    startTrack(queue.length > 0 ? index + 1 : 0)
  },

  playNext: (track) => {
    const { queue, index } = get()
    if (queue.length === 0) {
      get().playTracks([track])
      return
    }
    const next = [...queue]
    let currentIndex = index
    const existing = next.findIndex((item, i) => item.id === track.id && i !== index)
    if (existing >= 0) {
      next.splice(existing, 1)
      if (existing < currentIndex) currentIndex--
    }
    next.splice(currentIndex + 1, 0, track)
    set({ queue: next, index: currentIndex })
    toast(t('toast.playNext'), 'success')
  },

  addToQueue: (tracks) => {
    const { queue } = get()
    if (queue.length === 0) {
      get().playTracks(tracks)
      return
    }
    set({ queue: dedupeAppend(queue, tracks) })
    toast(t('toast.addedToQueue'), 'success')
  },

  removeFromQueue: (removeIndex) => {
    const { queue, index } = get()
    if (removeIndex === index) return
    const next = queue.filter((_, i) => i !== removeIndex)
    set({ queue: next, index: removeIndex < index ? index - 1 : index })
  },

  jumpTo: (index) => {
    if (index >= 0 && index < get().queue.length) startTrack(index)
  },

  clearQueue: () => {
    const { queue, index } = get()
    const current = queue[index]
    set({
      queue: current ? [current] : [],
      index: 0,
      originalQueue: null
    })
    toast(t('toast.queueCleared'))
  },

  toggle: () => {
    const { current, playing, queue } = get()
    if (!current) {
      if (queue.length > 0) startTrack(0)
      return
    }
    const eng = getEngine()
    if (playing) eng.pauseWithFade()
    else void eng.playWithFade().catch(() => set({ playing: false }))
  },

  next: (auto = false) => {
    const state = get()
    const result = nextIndex({ queue: state.queue, index: state.index, repeat: state.repeat }, auto)
    if (result.kind === 'index') {
      startTrack(result.index)
      return
    }
    if (result.kind === 'restart') {
      startTrack(state.index)
      return
    }
    if (auto && useSettings.getState().settings.playback.autoplayRelated) {
      const last = state.queue[state.queue.length - 1]
      if (last) {
        void api.sc.related(last.id).then((related) => {
          if (related.ok && related.data.length > 0) {
            const appended = dedupeAppend(get().queue, related.data).slice(0, QUEUE_PERSIST_LIMIT)
            if (appended.length > get().queue.length) {
              set({ queue: appended })
              startTrack(get().index + 1)
              return
            }
          }
          set({ playing: false })
        })
        return
      }
    }
    getEngine().stop()
    set({ playing: false, position: 0 })
  },

  previous: () => {
    const state = get()
    if (state.position > 4) {
      getEngine().seek(0)
      set({ position: 0 })
      return
    }
    const prev = previousIndex({ queue: state.queue, index: state.index, repeat: state.repeat })
    if (prev !== null) startTrack(prev)
    else {
      getEngine().seek(0)
      set({ position: 0 })
    }
  },

  seek: (position) => {
    getEngine().seek(position)
    set({ position })
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume))
    set({ volume: clamped, muted: false })
    getEngine().setVolume(clamped)
    void useSettings.getState().update({ playback: { volume: clamped, muted: false } })
  },

  toggleMute: () => {
    const muted = !get().muted
    set({ muted })
    getEngine().setVolume(muted ? 0 : get().volume)
    void useSettings.getState().update({ playback: { muted } })
  },

  toggleShuffle: () => {
    const state = get()
    if (!state.shuffle) {
      const result = pickShuffle()(state.queue, state.index)
      set({
        shuffle: true,
        originalQueue: state.originalQueue ?? [...state.queue],
        queue: result.queue,
        index: result.index
      })
    } else {
      const original = state.originalQueue ?? state.queue
      const result = unshuffled(original, state.current?.id ?? null)
      set({ shuffle: false, originalQueue: null, queue: result.queue, index: result.index })
    }
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const current = get().repeat
    const next = order[(order.indexOf(current) + 1) % order.length] ?? 'off'
    set({ repeat: next })
  }
}))

export async function initPlayer(): Promise<void> {
  if (playerInitialized) return
  playerInitialized = true
  const settings = useSettings.getState().settings
  usePlayer.setState({ volume: settings.playback.volume, muted: settings.playback.muted })
  const eng = getEngine()
  eng.setVolume(settings.playback.muted ? 0 : settings.playback.volume)
  eng.setFade(settings.playback.fadeMs)

  useSettings.subscribe((state) => {
    eng.setFade(state.settings.playback.fadeMs)
  })

  if (settings.playback.resumeOnLaunch) {
    const snapshot = await api.playback.load()
    if (snapshot && snapshot.queue.length > 0) {
      usePlayer.setState({
        queue: snapshot.queue,
        originalQueue: snapshot.originalQueue,
        index: snapshot.index,
        shuffle: snapshot.shuffle,
        repeat: snapshot.repeat,
        current: snapshot.queue[snapshot.index] ?? null,
        position: snapshot.position,
        duration: snapshot.queue[snapshot.index]?.duration ?? 0
      })
      startTrack(snapshot.index, false, snapshot.position)
    }
  }

  api.events.onMedia((action) => handleMediaAction(action))
  api.events.onPlayerCommand((action) => handleMediaAction(action))

  const syncSmartShuffle = (plugins: { manifest: { id: string }; enabled: boolean }[]): void => {
    smartShuffleEnabled = plugins.find((plugin) => plugin.manifest.id === 'smart-shuffle')?.enabled ?? false
  }
  void api.plugins.list().then(syncSmartShuffle)
  api.events.onPluginsChanged(syncSmartShuffle)

  startSnapshotPersistence()
}

function handleMediaAction(action: string): void {
  const player = usePlayer.getState()
  if (action === 'play-pause') player.toggle()
  else if (action === 'next') player.next()
  else if (action === 'previous') player.previous()
  else if (action === 'stop') {
    getEngine().stop()
    usePlayer.setState({ playing: false, position: 0 })
  }
}

function startSnapshotPersistence(): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const save = (): void => {
    const state = usePlayer.getState()
    if (state.queue.length === 0) return
    api.playback.save({
      queue: state.queue.slice(0, QUEUE_PERSIST_LIMIT),
      originalQueue: state.originalQueue?.slice(0, QUEUE_PERSIST_LIMIT) ?? null,
      index: Math.min(state.index, QUEUE_PERSIST_LIMIT - 1),
      position: state.position,
      shuffle: state.shuffle,
      repeat: state.repeat,
      savedAt: Date.now()
    })
  }

  usePlayer.subscribe((state, previous) => {
    if (
      state.queue !== previous.queue ||
      state.index !== previous.index ||
      state.repeat !== previous.repeat ||
      state.shuffle !== previous.shuffle
    ) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, 1500)
    }
  })
  setInterval(() => {
    if (usePlayer.getState().playing) save()
  }, 10000)
  window.addEventListener('beforeunload', save)
}
