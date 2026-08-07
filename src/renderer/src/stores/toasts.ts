import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  /** exit animation in progress */
  closing?: boolean
}

interface ToastState {
  toasts: Toast[]
  push(message: string, kind?: ToastKind, duration?: number): void
  dismiss(id: number): void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, kind = 'info', duration = 3000) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts.slice(-1), { id, kind, message }] }))
    setTimeout(() => get().dismiss(id), duration)
  },
  dismiss: (id) => {
    const found = get().toasts.find((toast) => toast.id === id)
    if (!found || found.closing) return
    set((state) => ({
      toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast))
    }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
    }, 180)
  }
}))

export const toast = (message: string, kind: ToastKind = 'info'): void =>
  useToasts.getState().push(message, kind)
