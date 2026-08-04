import { app } from 'electron'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  sanitizeSettings,
  type Settings
} from '@shared/types/settings'
import { type DeepPartial } from '@shared/types/result'
import { JsonStore } from '../core/store'
import { paths } from '../core/paths'

type Listener = (settings: Settings, previous: Settings) => void

export class SettingsService {
  private store: JsonStore<Settings>
  private listeners = new Set<Listener>()

  constructor() {
    this.store = new JsonStore<Settings>(paths.settingsFile(), sanitizeSettings)
  }

  get(): Settings {
    return this.store.get()
  }

  patch(patch: DeepPartial<Settings>): Settings {
    const previous = this.store.get()
    const next = mergeSettings(previous, patch)
    this.store.set(next)
    this.applySideEffects(next, previous)
    for (const listener of this.listeners) listener(next, previous)
    return next
  }

  reset(): Settings {
    const previous = this.store.get()
    const next = structuredClone(DEFAULT_SETTINGS)
    this.store.set(next)
    this.applySideEffects(next, previous)
    for (const listener of this.listeners) listener(next, previous)
    return next
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private applySideEffects(next: Settings, previous: Settings): void {
    if (next.startup.launchAtLogin !== previous.startup.launchAtLogin && process.platform !== 'linux') {
      app.setLoginItemSettings({
        openAtLogin: next.startup.launchAtLogin,
        args: next.startup.startMinimized ? ['--hidden'] : []
      })
    }
  }

  flush(): void {
    this.store.flush()
  }
}
