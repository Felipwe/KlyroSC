import { type KlyroApi } from '@shared/types/ipc'

export const api: KlyroApi = window.klyro

export function reportError(scope: string, error: unknown): void {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  try {
    api.log('error', `[${scope}] ${message}`)
  } catch {
    console.error(scope, error)
  }
}
