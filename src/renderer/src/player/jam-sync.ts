import { type Track } from '@shared/types/track'
import { type JamPlayback, type JamTrackRef } from '@shared/types/social'
import { expectedJamPosition } from '@shared/utils/social'
import { api } from '@renderer/services/ipc'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/stores/toasts'
import { useSocial } from '@renderer/stores/social'
import { usePlayer } from './store'

const DRIFT_TOLERANCE = 2.5
const QUEUE_PREVIEW = 25

let initialized = false
let applyingRemote = false
let releaseTimer: ReturnType<typeof setTimeout> | null = null
let queueTimer: ReturnType<typeof setTimeout> | null = null
let lastJamId: string | null = null
let lastQueueSig = ''
let lastAppliedQueueSig = ''

const toRef = (track: Track): JamTrackRef => ({
  trackId: track.id,
  title: track.title,
  artist: track.artist,
  artwork: track.artwork,
  duration: track.duration
})

const trackFromRef = (ref: JamTrackRef): Track => ({
  id: ref.trackId,
  title: ref.title,
  artist: ref.artist,
  artistId: 0,
  artistUrl: '',
  artistAvatar: null,
  url: '',
  artwork: ref.artwork,
  artworkSmall: ref.artwork,
  duration: ref.duration,
  genre: null,
  playCount: 0,
  likeCount: 0,
  createdAt: new Date().toISOString(),
  snippet: false,
  jamAddedBy: ref.addedByName ?? undefined
})

function role(): { inJam: boolean; control: boolean } {
  const { jam, account } = useSocial.getState().snapshot
  if (!jam || !account) return { inJam: false, control: false }
  return { inJam: true, control: jam.ownerId === account.id || jam.allowGuestControl }
}

function markApplying(): void {
  applyingRemote = true
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    applyingRemote = false
  }, 150)
}

function emitPlayback(optimisticPlaying?: boolean): void {
  const state = usePlayer.getState()
  api.social.sendJamPlayback({
    track: state.current ? toRef(state.current) : null,
    playing: optimisticPlaying ?? state.playing,
    position: state.position
  })
}

function emitQueue(immediate = false): void {
  if (queueTimer) clearTimeout(queueTimer)
  queueTimer = setTimeout(
    () => {
      queueTimer = null
      const state = usePlayer.getState()
      const social = useSocial.getState().snapshot
      const me = social.account
      const known = new Map(
        (social.jam?.queue ?? []).map((ref) => [ref.trackId, ref] as const)
      )
      // keep the original "added by" tag; new tracks are attributed to us.
      // ONLY the dedicated jam queue is shared — personal queues never leak in
      const refs = state.jamQueue.slice(0, QUEUE_PREVIEW).map((track) => {
        const existing = known.get(track.id)
        return {
          ...toRef(track),
          addedById: existing?.addedById ?? me?.id ?? null,
          addedByName: existing?.addedByName ?? track.jamAddedBy ?? me?.name ?? null
        }
      })
      const sig = refs.map((ref) => ref.trackId).join(',')
      if (sig === lastQueueSig) return
      lastQueueSig = sig
      api.social.sendJamQueue(refs)
    },
    immediate ? 0 : 400
  )
}

/** Everyone mirrors the jam queue locally  the jam queue outranks any local queue. */
function applyJamQueue(): void {
  const player = usePlayer.getState()
  const { inJam } = role()
  if (!inJam) return
  const queue = useSocial.getState().snapshot.jam?.queue ?? []
  const sig = queue.map((ref) => `${ref.trackId}:${ref.addedByName ?? ''}`).join(',')
  if (sig === lastAppliedQueueSig) return
  const idSig = queue.map((ref) => ref.trackId).join(',')
  if (!player.jamLocked && idSig === lastQueueSig) {
    // our own emission bounced back through a state refresh — nothing to mirror
    lastAppliedQueueSig = sig
    return
  }
  lastAppliedQueueSig = sig
  lastQueueSig = idSig
  markApplying()
  // straight into the shared jam queue — the personal queue is untouched
  player.jamSetQueue(queue.map(trackFromRef))
}

async function applyPlayback(playback: JamPlayback): Promise<void> {
  const { inJam } = role()
  if (!inJam) return
  const player = usePlayer.getState()
  markApplying()
  if (!playback.track) {
    if (player.playing) player.jamApplyTransport(false, null)
    return
  }
  const expected = expectedJamPosition(playback, Date.now())
  if (player.current?.id !== playback.track.trackId) {
    const ref = playback.track
    const result = await api.sc.track(ref.trackId)
    // still the same remote intent? (a newer event may have superseded this one)
    const latest = useSocial.getState().snapshot.jam?.playback
    if (!latest?.track || latest.track.trackId !== ref.trackId) return
    markApplying()
    const track = result.ok ? result.data : trackFromRef(ref)
    usePlayer.getState().jamApplyTrack(track, expectedJamPosition(latest, Date.now()), latest.playing)

  } else {
    const drift = Math.abs(player.position - expected)
    player.jamApplyTransport(playback.playing, drift > DRIFT_TOLERANCE ? expected : null)
  }
}

function syncLock(): void {
  const { inJam, control } = role()
  usePlayer.getState().setJamLock(inJam && !control)
}

function driftCheck(): void {
  const { snapshot } = useSocial.getState()
  const playback = snapshot.jam?.playback
  const player = usePlayer.getState()
  if (!playback?.track || !player.jamLocked) return
  if (!playback.playing || player.buffering) return
  if (player.current?.id !== playback.track.trackId) return
  const expected = expectedJamPosition(playback, Date.now())
  if (Math.abs(player.position - expected) > DRIFT_TOLERANCE) {
    markApplying()
    player.jamApplyTransport(true, expected)
  }
}

export function initJamSync(): void {
  if (initialized) return
  initialized = true

  useSocial.subscribe((state, previous) => {
    const jam = state.snapshot.jam
    const prevJam = previous.snapshot.jam
    syncLock()

    // after a server restart/deploy the connection drops; when it returns, the owner
    // re-announces the live position so everyone stays in sync seamlessly
    if (
      state.snapshot.connected &&
      !previous.snapshot.connected &&
      jam &&
      jam.ownerId === state.snapshot.account?.id &&
      usePlayer.getState().current
    ) {
      emitPlayback()
      lastQueueSig = ''
      emitQueue(true)
    }

    if (jam && jam.id !== lastJamId) {
      lastJamId = jam.id
      lastQueueSig = ''
      lastAppliedQueueSig = ''
      const me = state.snapshot.account?.id
      // park the personal queue — while the jam lasts, its queue rules playback
      markApplying()
      usePlayer.getState().jamEnter()
      if (jam.ownerId === me) {
        const player = usePlayer.getState()
        if (player.current) emitPlayback()
        applyJamQueue()
      } else {
        void applyPlayback(jam.playback)
        applyJamQueue()
      }
    } else if (!jam) {
      lastJamId = null
      lastAppliedQueueSig = ''
      lastQueueSig = ''
      if (prevJam) {
        // the jam ended — bring the personal queue back
        markApplying()
        usePlayer.getState().jamExit()
        toast(t('social.jam.endedToast'))
      }
    } else if (jam.queue !== prevJam?.queue) {
      applyJamQueue()
    }
  })

  api.social.onJamPlayback((playback) => {
    void applyPlayback(playback)
  })

  usePlayer.subscribe((state, previous) => {
    if (applyingRemote) return
    const { inJam, control } = role()
    if (!inJam || !control) return

    if (state.current?.id !== previous.current?.id) {
      // autoplay intent: followers should start even while our stream still buffers
      emitPlayback(state.current !== null ? true : undefined)
      return
    }
    if (state.playing !== previous.playing) {
      emitPlayback()
      return
    }
    if (state.position !== previous.position && Math.abs(state.position - previous.position) > 3) {
      emitPlayback()
      return
    }
    // only the dedicated jam queue syncs — personal queue changes stay local
    if (state.jamQueue !== previous.jamQueue) emitQueue()
  })

  setInterval(driftCheck, 5_000)
}
