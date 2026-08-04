import { useSyncExternalStore } from 'react'
import { type LanguageSetting } from '@shared/types/settings'
import { en, type Dict } from './locales/en'
import { pt } from './locales/pt'

export type Language = 'en' | 'pt'

const dicts: Record<Language, Dict> = { en, pt }

let current: Language = detectSystemLanguage()
const listeners = new Set<() => void>()

export function detectSystemLanguage(): Language {
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('pt')
    ? 'pt'
    : 'en'
}

export function applyLanguage(setting: LanguageSetting): void {
  const next: Language = setting === 'auto' ? detectSystemLanguage() : setting
  if (next === current) return
  current = next
  document.documentElement.lang = next === 'pt' ? 'pt-BR' : 'en'
  for (const listener of listeners) listener()
}

export function getLanguage(): Language {
  return current
}

function lookup(dict: Dict, path: string): unknown {
  let node: unknown = dict
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

export function t(path: string, params?: Record<string, string | number>): string {
  const value = lookup(dicts[current], path) ?? lookup(en, path)
  let text = typeof value === 'string' ? value : path
  if (params) {
    for (const [key, param] of Object.entries(params))
      text = text.replaceAll(`{${key}}`, String(param))
  }
  return text
}

export function useLanguage(): Language {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current
  )
}
