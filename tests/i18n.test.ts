import { describe, expect, it } from 'vitest'
import { en } from '../src/renderer/src/i18n/locales/en'
import { pt } from '../src/renderer/src/i18n/locales/pt'

type Node = Record<string, unknown>

function flatten(node: Node, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else if (typeof value === 'object' && value !== null)
      for (const [innerPath, innerValue] of flatten(value as Node, path)) out.set(innerPath, innerValue)
  }
  return out
}

const paramsOf = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()

describe('i18n dictionaries', () => {
  const enFlat = flatten(en)
  const ptFlat = flatten(pt as unknown as Node)

  it('pt covers every en key', () => {
    for (const key of enFlat.keys()) expect(ptFlat.has(key), `missing pt key: ${key}`).toBe(true)
  })

  it('en covers every pt key', () => {
    for (const key of ptFlat.keys()) expect(enFlat.has(key), `extra pt key: ${key}`).toBe(true)
  })

  it('has no empty strings', () => {
    for (const [key, value] of enFlat) expect(value.length, `empty en: ${key}`).toBeGreaterThan(0)
    for (const [key, value] of ptFlat) expect(value.length, `empty pt: ${key}`).toBeGreaterThan(0)
  })

  it('keeps interpolation params consistent', () => {
    for (const [key, value] of enFlat) {
      const other = ptFlat.get(key)
      if (other !== undefined) expect(paramsOf(other), `params differ for ${key}`).toEqual(paramsOf(value))
    }
  })
})
