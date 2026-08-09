import { create } from 'zustand'
import { type Track } from '@shared/types/track'
import { type RepeatMode } from '@shared/types/player'
import { QUEUE_PERSIST_LIMIT } from '@shared/constants'
import { type EqState } from '@shared/utils/eq'
import { api } from '@renderer/services/ipc'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/stores/toasts'
import { useLibrary } from '@renderer/stores/library'
import { useSettings } from '@renderer/stores/settings'
import { useSocial } from '@renderer/stores/social'
import { AudioEngine } from './engine'
import {
  dedupeAppend,
  mixRecommendations,
  nextIndex,
  previousIndex,
  shuffled,
  smartShuffled,
  unshuffled,
  withoutSmartPicks
} from './queue-utils'

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
  /** shuffle upgraded with similar-track recommendations woven into the queue */
  smartShuffle: boolean
  repeat: RepeatMode
  previewActive: boolean
  /** true when following a jam without control permission  transport is locked */
  jamLocked: boolean
  /** the shared jam queue — completely separate from the personal queue */
  jamQueue: Track[]
  /** personal queue parked while a jam overrides playback; restored on jam end */
  stash: { queue: Track[]; originalQueue: Track[] | null; index: number; shuffle: boolean } | null

  playTracks(tracks: Track[], startIndex?: number): void
  /** plays a list straight into Smart Shuffle: flow-aware order + similar-track recommendations */
  playTracksSmart(tracks: Track[]): void
  playNow(track: Track): void
  playStation(track: Track): void
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
  toggleSmartShuffle(): void
  cycleRepeat(): void
  setJamLock(locked: boolean): void
  jamEnter(): void
  jamExit(): void
  jamSetQueue(tracks: Track[]): void
  jamRemoveFromQueue(index: number): void
  jamApplyTrack(track: Track, position: number, playing: boolean): void
  jamApplyTransport(playing: boolean, position: number | null): void
}

let engine: AudioEngine | null = null
let historyCounted = false
let consecutiveErrors = 0
let playerInitialized = false
let smartShuffleEnabled = true
let forcedPreview = false
let volumePersistTimer: ReturnType<typeof setTimeout> | null = null
/** bumped whenever the queue context changes so in-flight recommendation fetches are dropped */
let smartShuffleGeneration = 0

/** Applies EQ straight to the audio graph without persisting (live preview while dragging). */
export function applyEqLive(eq: EqState): void {
  getEngine().setEq(eq)
}

const pickShuffle = (): typeof shuffled => (smartShuffleEnabled ? smartShuffled : shuffled)

/** Pulls similar tracks for a few seeds of the queue and weaves them in as recommendations. */
async function injectSmartRecommendations(): Promise<void> {
  const generation = ++smartShuffleGeneration
  const state = usePlayer.getState()
  const seeds: Track[] = []
  if (state.current) seeds.push(state.current)
  const others = state.queue.filter((track) => track.id !== state.current?.id)
  for (let i = 0; i < 2 && others.length > 0; i++) {
    const pick = others.splice(Math.floor(Math.random() * others.length), 1)[0]
    if (pick) seeds.push(pick)
  }
  if (seeds.length === 0) return
  const results = await Promise.all(seeds.map((seed) => api.sc.related(seed.id).catch(() => null)))
  const recommendations: Track[] = []
  const seen = new Set<number>()
  for (const result of results) {
    if (!result || !result.ok) continue
    for (const rec of result.data) {
      if (seen.has(rec.id)) continue
      seen.add(rec.id)
      recommendations.push(rec)
    }
  }
  if (recommendations.length === 0) return
  const fresh = usePlayer.getState()
  // context changed while fetching (new queue, jam, smart shuffle off) → drop silently
  if (generation !== smartShuffleGeneration || !fresh.smartShuffle || fresh.stash !== null) return
  const mixed = mixRecommendations(fresh.queue, fresh.index, recommendations)
  if (mixed.length > fresh.queue.length)
    usePlayer.setState({ queue: mixed.slice(0, QUEUE_PERSIST_LIMIT) })
}

/** Transport guard while following a jam someone else controls. */
const jamBlocked = (): boolean => {
  if (!usePlayer.getState().jamLocked) return false
  toast(t('social.jam.locked'))
  return true
}

const getEngine = (): AudioEngine => {
  if (engine) return engine
  engine = new AudioEngine({
    onDuration: (duration) => {
      const track = usePlayer.getState().current
      const previewActive =
        forcedPreview ||
        (track !== null && duration > 0 && duration <= 65 && duration < track.duration * 0.6)
      usePlayer.setState({ duration, previewActive })
    },
    onTime: (position) => {
      usePlayer.setState({ position })
      maybeCountHistory(position)
    },
    onEnded: () => usePlayer.getState().next(true),
    onBuffering: (buffering) => usePlayer.setState({ buffering }),
    onPlayingChange: (playing) => {
      // Audio confirmed playing → clear the error streak so unrelated future errors start fresh.
      if (playing && consecutiveErrors > 0) consecutiveErrors = 0
      usePlayer.setState({ playing })
    },
    onStreamInfo: ({ preview, substituted }) => {
      forcedPreview = preview
      usePlayer.setState({ previewActive: preview })
      if (substituted) toast(t('toast.playingFullVersion'), 'success')
      else if (preview) toast(t('toast.previewOnly'))
    },
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
  forcedPreview = false
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
      // Source-setup failure (e.g. IPC error) counts as an error immediately.
      // Successful setup does NOT reset the counter  that only happens on real playback.
      if (!ok) consecutiveErrors++
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
  smartShuffle: false,
  repeat: 'off',
  previewActive: false,
  jamLocked: false,
  jamQueue: [],
  stash: null,

  playTracks: (tracks, startIndex = 0) => {
    if (tracks.length === 0 || jamBlocked()) return
    smartShuffleGeneration++
    const shuffleOn = get().shuffle
    if (get().smartShuffle) set({ smartShuffle: false })
    if (shuffleOn) {
      const result = pickShuffle()(tracks, startIndex)
      set({ queue: result.queue, originalQueue: [...tracks] })
      startTrack(result.index)
    } else {
      set({ queue: [...tracks], originalQueue: null })
      startTrack(startIndex)
    }
  },

  playTracksSmart: (tracks) => {
    if (tracks.length === 0 || jamBlocked()) return
    // inside a jam the shared queue rules — fall back to a plain play
    if (get().stash !== null) {
      get().playTracks(tracks)
      return
    }
    smartShuffleGeneration++
    const result = smartShuffled(tracks, 0)
    set({
      queue: result.queue,
      originalQueue: [...tracks],
      shuffle: true,
      smartShuffle: true
    })
    startTrack(result.index)
    toast(t('toast.smartShuffleOn'), 'success')
    void injectSmartRecommendations()
  },

  playNow: (track) => {
    if (jamBlocked()) return
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

  playStation: (track) => {
    if (jamBlocked()) return
    const { current } = get()
    if (current?.id === track.id) {
      get().toggle()
      return
    }
    set({ queue: [track], originalQueue: null })
    startTrack(0)
    void api.sc.related(track.id).then((related) => {
      if (!related.ok || related.data.length === 0) return
      const state = get()
      // only extend if the station seed is still what's playing and nothing else was queued
      if (state.queue.length !== 1 || state.queue[0]?.id !== track.id) return
      const items = related.data.filter((item) => item.id !== track.id)
      if (items.length > 0)
        set({ queue: [track, ...items].slice(0, QUEUE_PERSIST_LIMIT) })
    })
  },

  playNext: (track) => {
    if (jamBlocked()) return
    const state = get()
    if (state.stash !== null) {
      // in a jam: explicit adds go to the SHARED queue, never the personal one
      const mine = useSocial.getState().snapshot.account?.name
      set({
        jamQueue: [
          { ...track, jamAddedBy: track.jamAddedBy ?? mine },
          ...state.jamQueue.filter((item) => item.id !== track.id)
        ]
      })
      toast(t('toast.playNext'), 'success')
      return
    }
    const { queue, index } = state
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
    if (jamBlocked()) return
    const state = get()
    if (state.stash !== null) {
      const known = new Set(state.jamQueue.map((item) => item.id))
      const mine = useSocial.getState().snapshot.account?.name
      const fresh = tracks
        .filter((track) => !known.has(track.id))
        .map((track) => ({ ...track, jamAddedBy: track.jamAddedBy ?? mine }))
      if (fresh.length > 0) set({ jamQueue: [...state.jamQueue, ...fresh] })
      toast(t('toast.addedToJamQueue'), 'success')
      return
    }
    const { queue } = state
    if (queue.length === 0) {
      get().playTracks(tracks)
      return
    }
    set({ queue: dedupeAppend(queue, tracks) })
    toast(t('toast.addedToQueue'), 'success')
  },

  removeFromQueue: (removeIndex) => {
    if (jamBlocked()) return
    const { queue, index } = get()
    if (removeIndex === index) return
    const next = queue.filter((_, i) => i !== removeIndex)
    set({ queue: next, index: removeIndex < index ? index - 1 : index })
  },

  jumpTo: (index) => {
    if (jamBlocked()) return
    if (index >= 0 && index < get().queue.length) startTrack(index)
  },

  clearQueue: () => {
    if (jamBlocked()) return
    const state = get()
    if (state.stash !== null) {
      if (state.jamQueue.length > 0) {
        set({ jamQueue: [] })
        toast(t('toast.queueCleared'))
      }
      return
    }
    const { queue, index } = state
    const current = queue[index]
    set({
      queue: current ? [current] : [],
      index: 0,
      originalQueue: null,
      smartShuffle: false
    })
    toast(t('toast.queueCleared'))
  },

  toggle: () => {
    if (jamBlocked()) return
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
    if (state.jamLocked) {
      // follower: wait for the controller's next track instead of advancing locally
      if (auto) {
        set({ playing: false })
        return
      }
      toast(t('social.jam.locked'))
      return
    }
    // in a jam the shared queue outranks everything else
    if (state.stash !== null && state.jamQueue.length > 0) {
      const [head, ...rest] = state.jamQueue
      if (head) {
        set({ jamQueue: rest, queue: [head], index: 0, originalQueue: null, shuffle: false })
        startTrack(0)
        return
      }
    }
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
    if (jamBlocked()) return
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
    if (jamBlocked()) return
    getEngine().seek(position)
    set({ position })
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume))
    set({ volume: clamped, muted: false })
    getEngine().setVolume(clamped)
    // trailing debounce so rapid slider drags cannot persist out of order
    if (volumePersistTimer) clearTimeout(volumePersistTimer)
    volumePersistTimer = setTimeout(() => {
      volumePersistTimer = null
      const state = get()
      void useSettings.getState().update({ playback: { volume: state.volume, muted: state.muted } })
    }, 350)
  },

  toggleMute: () => {
    const muted = !get().muted
    set({ muted })
    getEngine().setVolume(muted ? 0 : get().volume)
    void useSettings.getState().update({ playback: { muted } })
  },

  toggleShuffle: () => {
    if (jamBlocked()) return
    smartShuffleGeneration++
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
      const original = state.originalQueue ?? withoutSmartPicks(state.queue, state.current?.id ?? null).queue
      const result = unshuffled(original, state.current?.id ?? null)
      set({ shuffle: false, smartShuffle: false, originalQueue: null, queue: result.queue, index: result.index })
    }
  },

  toggleSmartShuffle: () => {
    if (jamBlocked()) return
    const state = get()
    if (state.smartShuffle) {
      // full off: back to the original order, recommendations removed
      smartShuffleGeneration++
      const original = state.originalQueue ?? withoutSmartPicks(state.queue, state.current?.id ?? null).queue
      const result = unshuffled(original, state.current?.id ?? null)
      set({ shuffle: false, smartShuffle: false, originalQueue: null, queue: result.queue, index: result.index })
      toast(t('toast.smartShuffleOff'))
      return
    }
    if (state.stash !== null) return
    if (state.queue.length === 0) return
    if (!state.shuffle) {
      // smart mode always uses the flow-aware ordering
      const result = smartShuffled(state.queue, state.index)
      set({
        shuffle: true,
        smartShuffle: true,
        originalQueue: state.originalQueue ?? [...state.queue],
        queue: result.queue,
        index: result.index
      })
    } else {
      set({ smartShuffle: true })
    }
    toast(t('toast.smartShuffleOn'), 'success')
    void injectSmartRecommendations()
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const current = get().repeat
    const next = order[(order.indexOf(current) + 1) % order.length] ?? 'off'
    set({ repeat: next })
  },

  setJamLock: (locked) => {
    if (get().jamLocked !== locked) set({ jamLocked: locked })
  },

  jamEnter: () => {
    const state = get()
    if (state.stash !== null) return
    smartShuffleGeneration++
    // park the personal queue; while in the jam, playback is [current] + jamQueue
    set({
      stash: {
        queue: state.queue,
        originalQueue: state.originalQueue,
        index: state.index,
        shuffle: state.shuffle
      },
      queue: state.current ? [state.current] : [],
      index: 0,
      originalQueue: null,
      shuffle: false,
      smartShuffle: false,
      jamQueue: []
    })
  },

  jamExit: () => {
    const state = get()
    if (state.stash === null) {
      set({ jamQueue: [] })
      return
    }
    const upcoming = state.stash.queue
      .slice(state.stash.index + 1)
      .filter((track) => track.id !== state.current?.id)
    if (state.current) {
      set({
        stash: null,
        jamQueue: [],
        queue: [state.current, ...upcoming],
        index: 0,
        originalQueue: null,
        shuffle: false
      })
    } else {
      set({
        stash: null,
        jamQueue: [],
        queue: state.stash.queue,
        index: Math.min(state.stash.index, Math.max(0, state.stash.queue.length - 1)),
        originalQueue: state.stash.originalQueue,
        shuffle: state.stash.shuffle
      })
    }
  },

  jamSetQueue: (tracks) => {
    set({ jamQueue: tracks })
  },

  jamRemoveFromQueue: (index) => {
    if (jamBlocked()) return
    set({ jamQueue: get().jamQueue.filter((_, i) => i !== index) })
  },

  jamApplyTrack: (track, position, playing) => {
    set({ queue: [track], originalQueue: null, shuffle: false })
    startTrack(0, playing, Math.max(0, position))
  },

  jamApplyTransport: (playing, position) => {
    const eng = getEngine()
    if (position !== null) {
      eng.seek(position)
      set({ position })
    }
    if (playing === get().playing) return
    if (playing) void eng.playWithFade().catch(() => set({ playing: false }))
    else eng.pauseWithFade()
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
  eng.setEq(settings.eq)

  useSettings.subscribe((state, previous) => {
    eng.setFade(state.settings.playback.fadeMs)
    if (state.settings.eq !== previous.settings.eq) eng.setEq(state.settings.eq)
  })

  if (settings.playback.resumeOnLaunch) {
    const snapshot = await api.playback.load()
    if (snapshot && snapshot.queue.length > 0) {
      usePlayer.setState({
        queue: snapshot.queue,
        originalQueue: snapshot.originalQueue,
        index: snapshot.index,
        shuffle: snapshot.shuffle,
        smartShuffle: snapshot.smartShuffle === true,
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
    // during a jam the live queue is jam-owned — persist the parked personal queue instead
    const personal = state.stash ?? {
      queue: state.queue,
      originalQueue: state.originalQueue,
      index: state.index,
      shuffle: state.shuffle
    }
    if (personal.queue.length === 0) return
    api.playback.save({
      queue: personal.queue.slice(0, QUEUE_PERSIST_LIMIT),
      originalQueue: personal.originalQueue?.slice(0, QUEUE_PERSIST_LIMIT) ?? null,
      index: Math.min(personal.index, QUEUE_PERSIST_LIMIT - 1),
      position: state.stash ? 0 : state.position,
      shuffle: personal.shuffle,
      smartShuffle: state.stash ? false : state.smartShuffle,
      repeat: state.repeat,
      savedAt: Date.now()
    })
  }

  usePlayer.subscribe((state, previous) => {
    if (
      state.queue !== previous.queue ||
      state.index !== previous.index ||
      state.repeat !== previous.repeat ||
      state.shuffle !== previous.shuffle ||
      state.smartShuffle !== previous.smartShuffle
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
