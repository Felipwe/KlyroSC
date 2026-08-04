import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { app } from 'electron'
import semver from 'semver'
import {
  isApiCompatible,
  pluginDefaults,
  validatePluginManifest,
  type PluginConfigValue,
  type PluginInfo,
  type PluginManifest
} from '@shared/types/plugin'
import { isRecord } from '@shared/types/result'
import { type PlayerEvent } from '@shared/types/player'
import { type Track } from '@shared/types/track'
import { JsonStore } from '../core/store'
import { ensureDir, paths } from '../core/paths'
import { logger } from '../core/logger'
import { createHostApi, type HostBridge, type PluginRuntimeHooks } from './host-api'

const log = logger.scope('plugins')
const MAX_ERRORS = 5
const MAX_SOURCE_SIZE = 512 * 1024

interface PluginState {
  enabled: boolean
  config: Record<string, PluginConfigValue>
}

interface LoadedPlugin {
  manifest: PluginManifest
  dir: string
  builtin: boolean
  compatible: boolean
  incompatibleReason: string | null
  running: boolean
  error: string | null
  errorCount: number
  hooks: PluginRuntimeHooks | null
  deactivate: (() => void) | null
}

const parseState = (raw: unknown): Record<string, PluginState> => {
  if (!isRecord(raw)) return {}
  const out: Record<string, PluginState> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    out[id] = {
      enabled: value.enabled === true,
      config: isRecord(value.config) ? (value.config as Record<string, PluginConfigValue>) : {}
    }
  }
  return out
}

export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>()
  private state: JsonStore<Record<string, PluginState>>
  private currentTrack: Track | null = null
  private playing = false
  private changeListeners = new Set<() => void>()

  constructor(
    private readonly sendPlayerCommand: HostBridge['sendPlayerCommand'],
    private readonly sendToast: HostBridge['sendToast'],
    private readonly isWindowFocused: HostBridge['isWindowFocused']
  ) {
    this.state = new JsonStore(paths.pluginStateFile(), parseState)
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  private emitChange(): void {
    for (const listener of this.changeListeners) listener()
  }

  loadAll(): void {
    this.stopAll()
    this.plugins.clear()
    this.discover(paths.builtinPluginsDir(), true)
    this.discover(ensureDir(paths.externalPluginsDir()), false)
    for (const plugin of this.plugins.values()) {
      if (plugin.compatible && this.stateOf(plugin.manifest.id).enabled) this.start(plugin)
    }
    log.info(`loaded ${this.plugins.size} plugin(s)`)
    this.emitChange()
  }

  private discover(dir: string, builtin: boolean): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pluginDir = path.join(dir, entry.name)
      try {
        const rawManifest: unknown = JSON.parse(
          fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf8')
        )
        const result = validatePluginManifest(rawManifest)
        if (!result.ok) {
          log.warn(`skipping plugin at ${entry.name}: ${result.error}`)
          continue
        }
        const manifest = result.manifest
        if (this.plugins.has(manifest.id)) continue
        let compatible = true
        let reason: string | null = null
        if (!isApiCompatible(manifest)) {
          compatible = false
          reason = `requires plugin API v${manifest.apiVersion}, app provides v1`
        } else if (manifest.appRange && !semver.satisfies(app.getVersion(), manifest.appRange)) {
          compatible = false
          reason = `requires app ${manifest.appRange}, current is ${app.getVersion()}`
        }
        this.plugins.set(manifest.id, {
          manifest,
          dir: pluginDir,
          builtin,
          compatible,
          incompatibleReason: reason,
          running: false,
          error: null,
          errorCount: 0,
          hooks: null,
          deactivate: null
        })
      } catch (error) {
        log.warn(`invalid plugin at ${entry.name}: ${String(error)}`)
      }
    }
  }

  private stateOf(id: string): PluginState {
    const plugin = this.plugins.get(id)
    const defaults = plugin ? pluginDefaults(plugin.manifest) : {}
    const saved = this.state.get()[id]
    return {
      enabled: saved?.enabled ?? plugin?.manifest.enabledByDefault === true,
      config: { ...defaults, ...(saved?.config ?? {}) }
    }
  }

  private saveState(id: string, patch: Partial<PluginState>): void {
    const current = this.stateOf(id)
    this.state.set({ ...this.state.get(), [id]: { ...current, ...patch } })
  }

  private bridge(): HostBridge {
    return {
      sendPlayerCommand: this.sendPlayerCommand,
      sendToast: this.sendToast,
      isWindowFocused: this.isWindowFocused,
      getTrack: () => this.currentTrack,
      isPlaying: () => this.playing,
      getConfig: (id) => this.stateOf(id).config,
      updateConfig: (id, patch) => {
        this.configure(id, { ...this.stateOf(id).config, ...patch })
      },
      reportError: (id, error) => this.reportError(id, error)
    }
  }

  private reportError(id: string, error: unknown): void {
    const plugin = this.plugins.get(id)
    if (!plugin) return
    plugin.errorCount += 1
    plugin.error = error instanceof Error ? error.message : String(error)
    log.error(`plugin "${id}" error (${plugin.errorCount}/${MAX_ERRORS})`, error)
    if (plugin.errorCount >= MAX_ERRORS && plugin.running) {
      this.stop(plugin)
      plugin.error = `disabled after ${MAX_ERRORS} consecutive errors: ${plugin.error}`
      this.saveState(id, { enabled: false })
      this.sendToast(`Plugin "${plugin.manifest.name}" was disabled after repeated errors`)
    }
  }

  private start(plugin: LoadedPlugin): void {
    if (plugin.running || !plugin.compatible) return
    const mainPath = path.join(plugin.dir, plugin.manifest.main)
    try {
      const resolved = fs.realpathSync(mainPath)
      if (!resolved.startsWith(fs.realpathSync(plugin.dir)))
        throw new Error('plugin main file escapes plugin directory')
      const stat = fs.statSync(resolved)
      if (stat.size > MAX_SOURCE_SIZE) throw new Error('plugin source exceeds 512 KB')
      const source = fs.readFileSync(resolved, 'utf8')

      const hooks: PluginRuntimeHooks = {
        trackListeners: new Set(),
        stateListeners: new Set(),
        progressListeners: new Set(),
        configListeners: new Set(),
        timers: new Set()
      }
      const pluginLog = logger.scope(`plugin:${plugin.manifest.id}`)
      const hostApi = createHostApi(plugin.manifest, hooks, this.bridge(), pluginLog)
      const moduleRef: { exports: Record<string, unknown> } = { exports: {} }
      const sandbox = vm.createContext({
        module: moduleRef,
        exports: moduleRef.exports,
        console: {
          log: (...args: unknown[]) => pluginLog.info(args.map(String).join(' ')),
          warn: (...args: unknown[]) => pluginLog.warn(args.map(String).join(' ')),
          error: (...args: unknown[]) => pluginLog.error(args.map(String).join(' '))
        },
        klyro: hostApi,
        setTimeout: hostApi.setTimeout,
        clearTimeout: hostApi.clearTimeout,
        setInterval: hostApi.setInterval,
        clearInterval: hostApi.clearInterval,
        URL,
        URLSearchParams,
        TextEncoder,
        TextDecoder
      })
      new vm.Script(source, { filename: resolved }).runInContext(sandbox, { timeout: 5000 })

      const exported = moduleRef.exports
      const activate = typeof exported.activate === 'function' ? exported.activate : null
      if (!activate) throw new Error('plugin does not export activate()')
      activate.call(undefined, hostApi)

      plugin.hooks = hooks
      plugin.deactivate = typeof exported.deactivate === 'function' ? (exported.deactivate as () => void) : null
      plugin.running = true
      plugin.error = null
      plugin.errorCount = 0
      log.info(`started plugin "${plugin.manifest.id}"`)
    } catch (error) {
      plugin.error = error instanceof Error ? error.message : String(error)
      plugin.running = false
      log.error(`failed to start plugin "${plugin.manifest.id}"`, error)
    }
  }

  private stop(plugin: LoadedPlugin): void {
    if (!plugin.running) return
    try {
      plugin.deactivate?.()
    } catch (error) {
      log.warn(`plugin "${plugin.manifest.id}" deactivate failed: ${String(error)}`)
    }
    if (plugin.hooks) {
      for (const timer of plugin.hooks.timers) {
        clearTimeout(timer)
        clearInterval(timer)
      }
      plugin.hooks.timers.clear()
      plugin.hooks.trackListeners.clear()
      plugin.hooks.stateListeners.clear()
      plugin.hooks.progressListeners.clear()
      plugin.hooks.configListeners.clear()
    }
    plugin.hooks = null
    plugin.deactivate = null
    plugin.running = false
    log.info(`stopped plugin "${plugin.manifest.id}"`)
  }

  stopAll(): void {
    for (const plugin of this.plugins.values()) this.stop(plugin)
    this.state.flush()
  }

  list(): PluginInfo[] {
    return [...this.plugins.values()]
      .sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.manifest.name.localeCompare(b.manifest.name))
      .map((plugin) => ({
        manifest: plugin.manifest,
        builtin: plugin.builtin,
        enabled: this.stateOf(plugin.manifest.id).enabled,
        running: plugin.running,
        compatible: plugin.compatible,
        incompatibleReason: plugin.incompatibleReason,
        error: plugin.error,
        config: this.stateOf(plugin.manifest.id).config
      }))
  }

  setEnabled(id: string, enabled: boolean): PluginInfo[] {
    const plugin = this.plugins.get(id)
    if (plugin) {
      this.saveState(id, { enabled })
      if (enabled) {
        plugin.errorCount = 0
        this.start(plugin)
      } else this.stop(plugin)
      this.emitChange()
    }
    return this.list()
  }

  configure(id: string, config: Record<string, PluginConfigValue>): PluginInfo[] {
    const plugin = this.plugins.get(id)
    if (plugin) {
      const allowed: Record<string, PluginConfigValue> = {}
      for (const field of plugin.manifest.settings) {
        const value = config[field.key]
        if (value === undefined) continue
        if (field.type === 'boolean' && typeof value === 'boolean') allowed[field.key] = value
        else if (field.type === 'number' && typeof value === 'number' && Number.isFinite(value))
          allowed[field.key] = Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, value))
        else if ((field.type === 'string' || field.type === 'select') && typeof value === 'string')
          allowed[field.key] = value.slice(0, 500)
      }
      this.saveState(id, { config: { ...this.stateOf(id).config, ...allowed } })
      const next = this.stateOf(id).config
      if (plugin.hooks) {
        for (const listener of plugin.hooks.configListeners) listener(next)
      }
    }
    return this.list()
  }

  installFromFolder(sourceDir: string): PluginInfo[] {
    const manifestPath = path.join(sourceDir, 'plugin.json')
    const rawManifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const result = validatePluginManifest(rawManifest)
    if (!result.ok) throw new Error(`invalid plugin.json: ${result.error}`)
    const target = path.join(ensureDir(paths.externalPluginsDir()), result.manifest.id)
    fs.rmSync(target, { recursive: true, force: true })
    fs.cpSync(sourceDir, target, { recursive: true })
    this.loadAll()
    return this.list()
  }

  uninstall(id: string): PluginInfo[] {
    const plugin = this.plugins.get(id)
    if (!plugin) throw new Error('plugin not found')
    if (plugin.builtin) throw new Error('built-in plugins cannot be uninstalled')
    this.stop(plugin)
    fs.rmSync(plugin.dir, { recursive: true, force: true })
    const state = { ...this.state.get() }
    delete state[id]
    this.state.set(state)
    this.plugins.delete(id)
    this.emitChange()
    return this.list()
  }

  onPlayerEvent(event: PlayerEvent): void {
    if (event.type === 'track') this.currentTrack = event.track
    if (event.type === 'state') this.playing = event.playing
    for (const plugin of this.plugins.values()) {
      if (!plugin.running || !plugin.hooks) continue
      if (event.type === 'track') for (const cb of plugin.hooks.trackListeners) cb(event.track)
      else if (event.type === 'state') for (const cb of plugin.hooks.stateListeners) cb(event.playing)
      else for (const cb of plugin.hooks.progressListeners) cb(event.position, event.duration)
    }
  }
}
