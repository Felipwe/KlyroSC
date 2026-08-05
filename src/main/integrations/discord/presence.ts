import { Client } from '@xhayper/discord-rpc'
import { APP_ICON_URL, APP_REPO_URL } from '@shared/constants'
import { type PresencePayload } from '@shared/types/player'
import { logger } from '../../core/logger'
import { resolveDiscordClientId } from './config'

const log = logger.scope('discord')

const ACTIVITY_LISTENING = 2
const MIN_PUSH_INTERVAL = 4000
const RETRY_BASE = 5000
const RETRY_MAX = 60000

interface PresenceConfig {
  enabled: boolean
  showButtons: boolean
  clientId: string
}

export class PresenceManager {
  private client: Client | null = null
  private ready = false
  private connecting = false
  private destroyed = false
  private retryDelay = RETRY_BASE
  private retryTimer: NodeJS.Timeout | null = null
  private pushTimer: NodeJS.Timeout | null = null
  private lastPushAt = 0
  private payload: PresencePayload | null = null
  private jamLabel: string | null = null
  private cleared = true
  private config: PresenceConfig = { enabled: false, showButtons: true, clientId: '' }

  configure(config: PresenceConfig): void {
    const clientChanged = config.clientId !== this.config.clientId
    const enabledChanged = config.enabled !== this.config.enabled
    this.config = config
    if (!config.enabled) {
      this.disconnect()
      return
    }
    if (clientChanged || enabledChanged || (!this.client && !this.connecting)) {
      this.disconnect()
      this.destroyed = false
      this.connect()
    }
  }

  update(payload: PresencePayload | null): void {
    this.payload = payload
    this.schedulePush()
  }

  /** Shown next to the artist while in a jam (e.g. "Jam 2/8"). */
  setJamInfo(label: string | null): void {
    if (label === this.jamLabel) return
    this.jamLabel = label
    this.schedulePush()
  }

  private connect(): void {
    if (this.connecting || this.ready || !this.config.enabled || this.destroyed) return
    this.connecting = true
    const clientId = resolveDiscordClientId(this.config.clientId)
    const client = new Client({ clientId })
    this.client = client

    client.on('ready', () => {
      this.ready = true
      this.connecting = false
      this.retryDelay = RETRY_BASE
      log.info('connected to Discord')
      this.schedulePush(true)
    })

    client.on('disconnected', () => {
      log.warn('Discord connection lost')
      this.ready = false
      this.scheduleRetry()
    })

    client.login().catch((error: unknown) => {
      this.connecting = false
      this.ready = false
      log.warn(`Discord unavailable: ${String(error)}`)
      this.scheduleRetry()
    })
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.config.enabled || this.destroyed) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connecting = false
      this.connect()
    }, this.retryDelay)
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX)
  }

  private schedulePush(immediate = false): void {
    if (this.pushTimer) return
    const elapsed = Date.now() - this.lastPushAt
    const wait = immediate ? 0 : Math.max(0, MIN_PUSH_INTERVAL - elapsed)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.push()
    }, wait)
  }

  private async push(): Promise<void> {
    if (!this.ready || !this.client?.user) return
    this.lastPushAt = Date.now()
    try {
      const p = this.payload
      if (!p || !this.config.enabled || !p.playing) {
        if (!this.cleared) {
          await this.client.user.clearActivity()
          this.cleared = true
        }
        return
      }
      const now = Date.now()
      const state = this.jamLabel ? `${p.artist} · ${this.jamLabel}` : p.artist
      const activity: Parameters<NonNullable<Client['user']>['setActivity']>[0] = {
        type: ACTIVITY_LISTENING,
        details: p.title.slice(0, 128),
        state: state.slice(0, 128),
        largeImageKey: p.artworkUrl ?? APP_ICON_URL,
        instance: false
      }
      if (p.durationSec > 0) {
        const start = now - Math.round(p.positionSec * 1000)
        activity.startTimestamp = start
        activity.endTimestamp = start + Math.round(p.durationSec * 1000)
      }
      if (this.config.showButtons && p.trackUrl.startsWith('https://')) {
        activity.buttons = [
          { label: 'Listen on SoundCloud', url: p.trackUrl },
          { label: 'Get KlyroSC', url: APP_REPO_URL }
        ]
      }
      await this.client.user.setActivity(activity)
      this.cleared = false
    } catch (error) {
      log.warn(`failed to push presence: ${String(error)}`)
    }
  }

  private disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
    const client = this.client
    this.client = null
    this.ready = false
    this.connecting = false
    if (client) {
      client.user?.clearActivity().catch(() => undefined)
      client.destroy().catch(() => undefined)
    }
  }

  destroy(): void {
    this.destroyed = true
    this.disconnect()
  }
}
