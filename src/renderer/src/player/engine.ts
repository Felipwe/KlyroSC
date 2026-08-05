import type Hls from 'hls.js'
import { type StreamSource } from '@shared/types/player'
import { api, reportError } from '@renderer/services/ipc'
import { clamp } from '@renderer/utils/format'

export interface EngineEvents {
  onDuration(duration: number): void
  onTime(position: number): void
  onEnded(): void
  onError(message: string): void
  onBuffering(buffering: boolean): void
  onPlayingChange(playing: boolean): void
}

export class AudioEngine {
  private audio = new Audio()
  private hls: Hls | null = null
  private generation = 0
  private erroredGeneration = -1
  private sourceReady = false
  private pendingSeeks = 0
  private seekSettleTimer: ReturnType<typeof setTimeout> | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null
  private targetVolume = 0.8
  private fadeMs = 220
  private fadeTimer: ReturnType<typeof setInterval> | null = null

  constructor(private events: EngineEvents) {
    this.audio.preload = 'auto'
    this.audio.addEventListener('timeupdate', () => {
      // ignore echoes from before a pending seek completed
      if (this.sourceReady && this.pendingSeeks === 0) this.events.onTime(this.audio.currentTime)
    })
    this.audio.addEventListener('seeked', () => {
      if (this.pendingSeeks > 0) this.pendingSeeks--
      if (this.pendingSeeks === 0) {
        this.clearSeekSettle()
        if (this.sourceReady) this.events.onTime(this.audio.currentTime)
      }
    })
    this.audio.addEventListener('durationchange', () => {
      if (this.sourceReady && Number.isFinite(this.audio.duration))
        this.events.onDuration(this.audio.duration)
    })
    this.audio.addEventListener('ended', () => {
      if (this.sourceReady) this.events.onEnded()
    })
    this.audio.addEventListener('waiting', () => this.events.onBuffering(true))
    this.audio.addEventListener('canplay', () => this.events.onBuffering(false))
    this.audio.addEventListener('playing', () => {
      this.clearWatchdog()
      this.events.onBuffering(false)
      this.events.onPlayingChange(true)
    })
    this.audio.addEventListener('pause', () => this.events.onPlayingChange(false))
    this.audio.addEventListener('error', () => {
      if (this.audio.src) this.emitError('audio element error')
    })
  }

  private emitError(message: string): void {
    if (this.erroredGeneration === this.generation) return
    this.erroredGeneration = this.generation
    this.clearWatchdog()
    this.events.onError(message)
  }

  private clearSeekSettle(): void {
    if (this.seekSettleTimer) {
      clearTimeout(this.seekSettleTimer)
      this.seekSettleTimer = null
    }
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private armWatchdog(generation: number): void {
    this.clearWatchdog()
    const startPos = this.audio.currentTime
    this.watchdogTimer = setTimeout(() => {
      if (generation !== this.generation) return
      const progressed = this.audio.currentTime - startPos
      if (progressed < 0.5 && this.audio.readyState < 3) this.emitError('stream stalled')
    }, 15000)
  }

  async load(trackId: number, autoplay: boolean, startAt = 0, fresh = false): Promise<boolean> {
    const generation = ++this.generation
    this.sourceReady = false
    this.pendingSeeks = 0
    this.clearSeekSettle()
    this.clearWatchdog()
    this.detachHls()
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()

    const result = await api.sc.stream(trackId, fresh)
    if (generation !== this.generation) return false
    if (!result.ok) {
      this.emitError(result.error)
      return false
    }
    const source = result.data
    try {
      if (source.protocol === 'hls') await this.attachHls(source, generation)
      else this.audio.src = source.url
      if (generation !== this.generation) return false
      this.sourceReady = true
      if (startAt > 0) this.audio.currentTime = startAt
      if (autoplay) {
        this.armWatchdog(generation)
        await this.playWithFade()
      } else {
        this.applyVolume(this.targetVolume)
      }
      return generation === this.generation
    } catch (error) {
      if (generation === this.generation) {
        reportError('engine', error)
        this.emitError(error instanceof Error ? error.message : String(error))
      }
      return false
    }
  }

  private async attachHls(source: StreamSource, generation: number): Promise<void> {
    const mod = await import('hls.js')
    const HlsCtor = mod.default
    if (generation !== this.generation) return
    if (!HlsCtor.isSupported()) {
      this.audio.src = source.url
      return
    }
    const hls = new HlsCtor({ enableWorker: true, maxBufferLength: 30, backBufferLength: 30 })
    this.hls = hls
    let networkRetries = 0
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      if (data.type === 'networkError' && ++networkRetries <= 2) hls.startLoad()
      else if (data.type === 'mediaError') hls.recoverMediaError()
      else this.emitError(`stream error: ${data.details}`)
    })
    hls.loadSource(source.url)
    hls.attachMedia(this.audio)
  }

  private detachHls(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
  }

  private stopFade(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer)
      this.fadeTimer = null
    }
  }

  private applyVolume(linear: number): void {
    this.audio.volume = clamp(linear, 0, 1) ** 2
  }

  private ramp(from: number, to: number, ms: number, done?: () => void): void {
    this.stopFade()
    if (ms <= 20) {
      this.applyVolume(to)
      done?.()
      return
    }
    const start = performance.now()
    this.fadeTimer = setInterval(() => {
      const progress = clamp((performance.now() - start) / ms, 0, 1)
      this.applyVolume(from + (to - from) * progress)
      if (progress >= 1) {
        this.stopFade()
        done?.()
      }
    }, 16)
  }

  async playWithFade(): Promise<void> {
    this.applyVolume(0)
    await this.audio.play()
    this.ramp(0, this.targetVolume, this.fadeMs)
  }

  pauseWithFade(): void {
    this.ramp(this.targetVolume, 0, Math.min(this.fadeMs, 160), () => this.audio.pause())
  }

  stop(): void {
    this.generation++
    this.sourceReady = false
    this.pendingSeeks = 0
    this.clearSeekSettle()
    this.clearWatchdog()
    this.stopFade()
    this.detachHls()
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }

  seek(position: number): void {
    if (!this.sourceReady || !Number.isFinite(position)) return
    const duration = this.audio.duration
    const max = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.4) : Infinity
    this.pendingSeeks++
    this.clearSeekSettle()
    // safety: never let a lost 'seeked' event mute time updates forever
    this.seekSettleTimer = setTimeout(() => {
      this.pendingSeeks = 0
    }, 2500)
    this.audio.currentTime = Math.min(Math.max(0, position), max)
  }

  setVolume(volume: number): void {
    this.targetVolume = clamp(volume, 0, 1)
    if (!this.fadeTimer) this.applyVolume(this.targetVolume)
  }

  setFade(ms: number): void {
    this.fadeMs = clamp(ms, 0, 1000)
  }

  get position(): number {
    return this.audio.currentTime
  }

  get paused(): boolean {
    return this.audio.paused
  }
}
