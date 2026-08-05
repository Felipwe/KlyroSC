import { create } from 'zustand'

const KEY = 'klyro.search-history'
const LIMIT = 12

const persist = (entries: string[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    /* storage unavailable */
  }
}

const load = (): string[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((q): q is string => typeof q === 'string' && q.length > 0).slice(0, LIMIT)
  } catch {
    return []
  }
}

interface SearchHistoryState {
  entries: string[]
  add(query: string): void
  remove(query: string): void
}

export const useSearchHistory = create<SearchHistoryState>((set, get) => ({
  entries: load(),

  add: (query) => {
    const clean = query.trim()
    if (clean.length < 2 || clean.startsWith('https://')) return
    const lower = clean.toLowerCase()
    // drop exact dupes and the partial prefixes typed on the way to this query
    const entries = [
      clean,
      ...get().entries.filter((entry) => {
        const el = entry.toLowerCase()
        return el !== lower && !lower.startsWith(el)
      })
    ].slice(0, LIMIT)
    set({ entries })
    persist(entries)
  },

  remove: (query) => {
    const entries = get().entries.filter((entry) => entry !== query)
    set({ entries })
    persist(entries)
  }
}))
