import { create } from 'zustand'

export type Route =
  | { name: 'home' }
  | { name: 'search'; query?: string }
  | { name: 'favorites' }
  | { name: 'history' }
  | { name: 'playlists' }
  | { name: 'playlist'; ref: string; local: boolean }
  | { name: 'artist'; id: number }
  | { name: 'track'; id: number }
  | { name: 'settings'; section?: string }

interface NavState {
  stack: Route[]
  index: number
  route: Route
  push(route: Route): void
  replace(route: Route): void
  back(): void
  forward(): void
  canBack(): boolean
  canForward(): boolean
}

const sameRoute = (a: Route, b: Route): boolean => JSON.stringify(a) === JSON.stringify(b)

export const useNav = create<NavState>((set, get) => ({
  stack: [{ name: 'home' }],
  index: 0,
  route: { name: 'home' },
  push: (route) => {
    const { stack, index } = get()
    const current = stack[index]
    if (current && sameRoute(current, route)) return
    const next = [...stack.slice(0, index + 1), route].slice(-50)
    set({ stack: next, index: next.length - 1, route })
  },
  replace: (route) => {
    const { stack, index } = get()
    const next = [...stack]
    next[index] = route
    set({ stack: next, route })
  },
  back: () => {
    const { stack, index } = get()
    if (index > 0) {
      const route = stack[index - 1]
      if (route) set({ index: index - 1, route })
    }
  },
  forward: () => {
    const { stack, index } = get()
    if (index < stack.length - 1) {
      const route = stack[index + 1]
      if (route) set({ index: index + 1, route })
    }
  },
  canBack: () => get().index > 0,
  canForward: () => get().index < get().stack.length - 1
}))
