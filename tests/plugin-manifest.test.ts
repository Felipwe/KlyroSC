import { describe, expect, it } from 'vitest'
import { pluginDefaults, validatePluginManifest } from '../src/shared/types/plugin'

const valid = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Does things',
  author: 'Tester',
  main: 'index.js',
  apiVersion: 1,
  permissions: ['network', 'storage'],
  settings: [{ key: 'enabled', type: 'boolean', label: 'Enabled', default: true }]
}

describe('validatePluginManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validatePluginManifest(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.id).toBe('my-plugin')
      expect(result.manifest.permissions).toEqual(['network', 'storage'])
      expect(result.manifest.settings).toHaveLength(1)
    }
  })

  it('rejects invalid ids', () => {
    expect(validatePluginManifest({ ...valid, id: 'My Plugin!' }).ok).toBe(false)
    expect(validatePluginManifest({ ...valid, id: '' }).ok).toBe(false)
  })

  it('rejects bad versions', () => {
    expect(validatePluginManifest({ ...valid, version: 'v1' }).ok).toBe(false)
  })

  it('rejects path traversal in main', () => {
    expect(validatePluginManifest({ ...valid, main: '../evil.js' }).ok).toBe(false)
    expect(validatePluginManifest({ ...valid, main: 'index.ts' }).ok).toBe(false)
  })

  it('rejects unknown permissions', () => {
    expect(validatePluginManifest({ ...valid, permissions: ['filesystem'] }).ok).toBe(false)
  })

  it('rejects malformed settings fields', () => {
    expect(validatePluginManifest({ ...valid, settings: [{ key: 'x', type: 'color', label: 'X', default: 1 }] }).ok).toBe(false)
    expect(validatePluginManifest({ ...valid, settings: [{ type: 'boolean', label: 'X', default: true }] }).ok).toBe(false)
  })

  it('tolerates missing optional fields', () => {
    const result = validatePluginManifest({
      id: 'tiny',
      name: 'Tiny',
      version: '0.1.0',
      main: 'index.js',
      apiVersion: 1,
      permissions: []
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.author).toBe('Unknown')
      expect(result.manifest.settings).toEqual([])
    }
  })
})

describe('pluginDefaults', () => {
  it('collects defaults from settings schema', () => {
    const result = validatePluginManifest(valid)
    if (result.ok) expect(pluginDefaults(result.manifest)).toEqual({ enabled: true })
  })
})
