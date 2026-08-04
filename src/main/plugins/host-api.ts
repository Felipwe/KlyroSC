import { Notification, shell } from 'electron'
import { createHash } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { type PluginConfigValue, type PluginManifest } from '@shared/types/plugin'
import { type Track } from '@shared/types/track'
import { type MediaAction } from '@shared/types/player'
import { ensureDir, paths } from '../core/paths'
import { type ScopedLogger } from '../core/logger'

export interface HostBridge {
  sendPlayerCommand(action: MediaAction): void
  sendToast(message: string): void
  isWindowFocused(): boolean
  getTrack(): Track | null
  isPlaying(): boolean
  getConfig(id: string): Record<string, PluginConfigValue>
  updateConfig(id: string, patch: Record<string, PluginConfigValue>): void
  reportError(id: string, error: unknown): void
}

export interface PluginRuntimeHooks {
  trackListeners: Set<(track: Track | null) => void>
  stateListeners: Set<(playing: boolean) => void>
  progressListeners: Set<(position: number, duration: number) => void>
  configListeners: Set<(config: Record<string, PluginConfigValue>) => void>
  timers: Set<NodeJS.Timeout>
}

export function createHostApi(
  manifest: PluginManifest,
  hooks: PluginRuntimeHooks,
  bridge: HostBridge,
  log: ScopedLogger
): Record<string, unknown> {
  const has = (permission: string): boolean => manifest.permissions.includes(permission as never)
  const deny = (permission: string): never => {
    throw new Error(`plugin "${manifest.id}" lacks the "${permission}" permission`)
  }
  const guarded = <A extends unknown[], R>(fn: (...args: A) => R): ((...args: A) => R | undefined) => {
    return (...args: A) => {
      try {
        return fn(...args)
      } catch (error) {
        bridge.reportError(manifest.id, error)
        return undefined
      }
    }
  }

  const storageFile = path.join(ensureDir(paths.pluginDataDir()), `${manifest.id}.json`)

  return {
    id: manifest.id,
    appVersion: app.getVersion(),
    log: (...args: unknown[]) => log.info(args.map((a) => stringify(a)).join(' ')),
    md5: (text: string) => createHash('md5').update(String(text), 'utf8').digest('hex'),
    isWindowFocused: () => bridge.isWindowFocused(),

    getConfig: () => bridge.getConfig(manifest.id),
    updateConfig: (patch: Record<string, PluginConfigValue>) => {
      if (typeof patch !== 'object' || patch === null) return
      bridge.updateConfig(manifest.id, patch)
    },
    onConfigChange: (cb: (config: Record<string, PluginConfigValue>) => void) => {
      const wrapped = guarded(cb)
      hooks.configListeners.add(wrapped)
      return () => hooks.configListeners.delete(wrapped)
    },

    storage: {
      get: (): unknown => {
        if (!has('storage')) deny('storage')
        try {
          return JSON.parse(fs.readFileSync(storageFile, 'utf8'))
        } catch {
          return {}
        }
      },
      set: (data: unknown): void => {
        if (!has('storage')) deny('storage')
        fs.writeFileSync(storageFile, JSON.stringify(data ?? {}), 'utf8')
      }
    },

    fetch: (url: string, init?: RequestInit): Promise<Response> => {
      if (!has('network')) deny('network')
      if (typeof url !== 'string' || !url.startsWith('https://'))
        throw new Error('plugins may only fetch https:// URLs')
      return fetch(url, { ...init, signal: AbortSignal.timeout(20000) })
    },

    notify: (title: string, body: string): void => {
      if (!has('notifications')) deny('notifications')
      if (Notification.isSupported())
        new Notification({ title: String(title).slice(0, 80), body: String(body).slice(0, 200), silent: true }).show()
    },
    toast: (message: string): void => {
      if (!has('notifications')) deny('notifications')
      bridge.sendToast(String(message).slice(0, 200))
    },

    openExternal: (url: string): void => {
      if (!has('shell')) deny('shell')
      if (typeof url === 'string' && url.startsWith('https://')) void shell.openExternal(url)
    },

    player: {
      getTrack: () => bridge.getTrack(),
      isPlaying: () => bridge.isPlaying(),
      onTrack: (cb: (track: Track | null) => void) => {
        const wrapped = guarded(cb)
        hooks.trackListeners.add(wrapped)
        return () => hooks.trackListeners.delete(wrapped)
      },
      onState: (cb: (playing: boolean) => void) => {
        const wrapped = guarded(cb)
        hooks.stateListeners.add(wrapped)
        return () => hooks.stateListeners.delete(wrapped)
      },
      onProgress: (cb: (position: number, duration: number) => void) => {
        const wrapped = guarded(cb)
        hooks.progressListeners.add(wrapped)
        return () => hooks.progressListeners.delete(wrapped)
      },
      playPause: () => {
        if (!has('player')) deny('player')
        bridge.sendPlayerCommand('play-pause')
      },
      pause: () => {
        if (!has('player')) deny('player')
        if (bridge.isPlaying()) bridge.sendPlayerCommand('play-pause')
      },
      play: () => {
        if (!has('player')) deny('player')
        if (!bridge.isPlaying()) bridge.sendPlayerCommand('play-pause')
      },
      next: () => {
        if (!has('player')) deny('player')
        bridge.sendPlayerCommand('next')
      },
      previous: () => {
        if (!has('player')) deny('player')
        bridge.sendPlayerCommand('previous')
      }
    },

    setTimeout: (fn: () => void, ms: number): NodeJS.Timeout => {
      const timer = setTimeout(guarded(fn), Math.max(0, Number(ms) || 0))
      hooks.timers.add(timer)
      return timer
    },
    clearTimeout: (timer: NodeJS.Timeout): void => {
      clearTimeout(timer)
      hooks.timers.delete(timer)
    },
    setInterval: (fn: () => void, ms: number): NodeJS.Timeout => {
      const timer = setInterval(guarded(fn), Math.max(250, Number(ms) || 1000))
      hooks.timers.add(timer)
      return timer
    },
    clearInterval: (timer: NodeJS.Timeout): void => {
      clearInterval(timer)
      hooks.timers.delete(timer)
    }
  }
}

const stringify = (value: unknown): string => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
