import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push(message: string, kind?: ToastKind, duration?: number): void
  dismiss(id: number): void
}

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'info', duration = 3000) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts.slice(-1), { id, kind, message }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
    }, duration)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}))

export const toast = (message: string, kind: ToastKind = 'info'): void =>
  useToasts.getState().push(message, kind)
