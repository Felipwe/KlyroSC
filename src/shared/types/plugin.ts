import { isRecord } from './result'
import { PLUGIN_API_VERSION } from '../constants'

export type PluginPermission = 'network' | 'notifications' | 'player' | 'storage' | 'shell'

export const PLUGIN_PERMISSIONS: readonly PluginPermission[] = [
  'network',
  'notifications',
  'player',
  'storage',
  'shell'
]

export type PluginConfigValue = boolean | string | number

export interface PluginSettingField {
  key: string
  type: 'boolean' | 'string' | 'number' | 'select'
  label: string
  description?: string
  default: PluginConfigValue
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  secret?: boolean
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  main: string
  apiVersion: number
  appRange?: string
  enabledByDefault?: boolean
  permissions: PluginPermission[]
  settings: PluginSettingField[]
}

export interface PluginInfo {
  manifest: PluginManifest
  builtin: boolean
  enabled: boolean
  running: boolean
  compatible: boolean
  incompatibleReason: string | null
  error: string | null
  config: Record<string, PluginConfigValue>
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

export function validatePluginManifest(
  raw: unknown
): { ok: true; manifest: PluginManifest } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: 'manifest is not an object' }
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return { ok: false, error: 'invalid "id"' }
  if (typeof raw.name !== 'string' || raw.name.length === 0 || raw.name.length > 60)
    return { ok: false, error: 'invalid "name"' }
  if (typeof raw.version !== 'string' || !VERSION_RE.test(raw.version))
    return { ok: false, error: 'invalid "version" (expected x.y.z)' }
  if (typeof raw.main !== 'string' || !raw.main.endsWith('.js') || raw.main.includes('..'))
    return { ok: false, error: 'invalid "main"' }
  if (typeof raw.apiVersion !== 'number') return { ok: false, error: 'missing "apiVersion"' }
  if (!Array.isArray(raw.permissions)) return { ok: false, error: 'missing "permissions"' }
  for (const p of raw.permissions) {
    if (!PLUGIN_PERMISSIONS.includes(p as PluginPermission))
      return { ok: false, error: `unknown permission "${String(p)}"` }
  }
  const settings: PluginSettingField[] = []
  if (raw.settings !== undefined) {
    if (!Array.isArray(raw.settings)) return { ok: false, error: 'invalid "settings"' }
    for (const field of raw.settings) {
      if (!isRecord(field)) return { ok: false, error: 'invalid settings field' }
      if (typeof field.key !== 'string' || field.key.length === 0)
        return { ok: false, error: 'settings field missing "key"' }
      if (
        field.type !== 'boolean' &&
        field.type !== 'string' &&
        field.type !== 'number' &&
        field.type !== 'select'
      )
        return { ok: false, error: `settings field "${field.key}" has invalid type` }
      if (typeof field.label !== 'string')
        return { ok: false, error: `settings field "${field.key}" missing label` }
      if (
        typeof field.default !== 'boolean' &&
        typeof field.default !== 'string' &&
        typeof field.default !== 'number'
      )
        return { ok: false, error: `settings field "${field.key}" missing default` }
      settings.push(field as unknown as PluginSettingField)
    }
  }
  return {
    ok: true,
    manifest: {
      id: raw.id,
      name: raw.name,
      version: raw.version,
      description: typeof raw.description === 'string' ? raw.description.slice(0, 400) : '',
      author: typeof raw.author === 'string' ? raw.author.slice(0, 80) : 'Unknown',
      main: raw.main,
      apiVersion: raw.apiVersion,
      appRange: typeof raw.appRange === 'string' ? raw.appRange : undefined,
      enabledByDefault: raw.enabledByDefault === true ? true : undefined,
      permissions: raw.permissions as PluginPermission[],
      settings
    }
  }
}

export function pluginDefaults(manifest: PluginManifest): Record<string, PluginConfigValue> {
  const out: Record<string, PluginConfigValue> = {}
  for (const field of manifest.settings) out[field.key] = field.default
  return out
}

export function isApiCompatible(manifest: PluginManifest): boolean {
  return manifest.apiVersion === PLUGIN_API_VERSION
}
