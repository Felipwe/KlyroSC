import { create } from 'zustand'
import { LOGGED_OUT, type AuthState } from '@shared/types/auth'
import { api } from '@renderer/services/ipc'
import { t } from '@renderer/i18n'
import { toast } from './toasts'
import { useLibrary } from './library'

interface AuthStore {
  state: AuthState
  loaded: boolean
  busy: boolean
  promptDismissed: boolean
  load(): Promise<void>
  login(): Promise<boolean>
  logout(): Promise<void>
  dismissPrompt(): void
}

export const useAuth = create<AuthStore>((set, get) => ({
  state: LOGGED_OUT,
  loaded: false,
  busy: false,
  promptDismissed: false,

  load: async () => {
    if (get().loaded) return
    const state = await api.auth.status()
    set({ state, loaded: true })
    api.auth.onChange((next) => set({ state: next }))
  },

  login: async () => {
    if (get().busy) return false
    set({ busy: true })
    const result = await api.auth.login()
    set({ busy: false })
    if (!result.ok) {
      toast(t('auth.failed', { error: result.error }), 'error')
      return false
    }
    if (!result.data.loggedIn || !result.data.user) return false
    set({ state: result.data, promptDismissed: true })
    await useLibrary.getState().load()
    toast(t('auth.welcome', { name: result.data.user.name }), 'success')
    return true
  },

  logout: async () => {
    const state = await api.auth.logout()
    set({ state })
  },

  dismissPrompt: () => set({ promptDismissed: true })
}))
