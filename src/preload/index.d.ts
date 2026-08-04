import { type KlyroApi } from '@shared/types/ipc'

declare global {
  interface Window {
    klyro: KlyroApi
  }
}

export {}
