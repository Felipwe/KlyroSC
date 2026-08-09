import { create } from 'zustand'
import { type Track } from '@shared/types/track'
import { api } from '@renderer/services/ipc'
import { t } from '@renderer/i18n'
import { toast } from '@renderer/stores/toasts'
import { usePlayer } from './store'

const PREVIEW_SECONDS = 30

interface PreviewState {
  /** track currently previewing */
  trackId: number | null
  /** track whose preview stream is being fetched */
  loadingId: number | null
}

export const usePreview = create<PreviewState>(() => ({ trackId: null, loadingId: null }))

let audio: HTMLAudioElement | null = null
let hls: { destroy(): void } | null = null
let stopTimer: ReturnType<typeof setTimeout> | null = null
let generation = 0
/** main player was playing when the preview started — resume it afterwards */
let resumeMainAfter = false

function cleanup(): void {
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }
  if (hls) {
    hls.destroy()
    hls = null
  }
  if (audio) {
    audio.onended = null
    audio.onerror = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio = null
  }
}

function halt(resume: boolean): void {
  generation++
  cleanup()
  usePreview.setState({ trackId: null, loadingId: null })
  if (resume) {
    if (resumeMainAfter && !usePlayer.getState().playing) usePlayer.getState().toggle()
    resumeMainAfter = false
  }
}

export function stopPreview(): void {
  halt(true)
}

/** Plays a short snippet of the track on a throwaway audio element; toggles off on second call. */
export async function togglePreview(track: Track): Promise<void> {
  const state = usePreview.getState()
  if (state.trackId === track.id || state.loadingId === track.id) {
    stopPreview()
    return
  }
  halt(false) // switching previews keeps the pending main-player resume
  const gen = generation
  usePreview.setState({ loadingId: track.id, trackId: null })

  const player = usePlayer.getState()
  if (player.playing) {
    // a locked jam cannot be paused — refuse instead of playing two audios at once
    if (player.jamLocked) {
      toast(t('social.jam.locked'))
      usePreview.setState({ loadingId: null })
      return
    }
    resumeMainAfter = true
    player.toggle()
  }

  const result = await api.sc.stream(track.id).catch(() => null)
  if (gen !== generation) return
  if (!result || !result.ok) {
    toast(t('toast.previewFailed'), 'error')
    halt(true)
    return
  }

  const element = new Audio()
  element.crossOrigin = 'anonymous'
  element.volume = Math.min(1, Math.max(0.15, usePlayer.getState().volume))
  audio = element

  const source = result.data
  if (source.protocol === 'hls') {
    const mod = await import('hls.js')
    if (gen !== generation) return
    const HlsCtor = mod.default
    if (HlsCtor.isSupported()) {
      const instance = new HlsCtor({ maxBufferLength: 12, backBufferLength: 10 })
      hls = instance
      instance.loadSource(source.url)
      instance.attachMedia(element)
    } else {
      element.src = source.url
    }
  } else {
    element.src = source.url
  }

  element.onended = () => {
    if (gen === generation) stopPreview()
  }
  element.onerror = () => {
    if (gen !== generation) return
    toast(t('toast.previewFailed'), 'error')
    halt(true)
  }

  try {
    await element.play()
  } catch {
    if (gen === generation) halt(true)
    return
  }
  if (gen !== generation) return
  usePreview.setState({ trackId: track.id, loadingId: null })
  stopTimer = setTimeout(() => {
    if (gen === generation) stopPreview()
  }, PREVIEW_SECONDS * 1000)
}

// user starting the main player elsewhere kills the preview (without re-pausing)
usePlayer.subscribe((state, previous) => {
  if (!state.playing || previous.playing) return
  const preview = usePreview.getState()
  if (preview.trackId !== null || preview.loadingId !== null) {
    resumeMainAfter = false
    halt(false)
  }
})
