import { ipcMain } from 'electron'
import { err, ok, type Result } from '@shared/types/result'
import { logger } from '../core/logger'

const log = logger.scope('ipc')

export function handle<T>(
  channel: string,
  fn: (...args: unknown[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => fn(...args))
}

export function handleResult<T>(
  channel: string,
  fn: (...args: unknown[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<Result<T>> => {
    try {
      return ok(await fn(...args))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.warn(`${channel} failed: ${message}`)
      return err(message)
    }
  })
}

export function on(channel: string, fn: (...args: unknown[]) => void): void {
  ipcMain.on(channel, (_event, ...args: unknown[]) => {
    try {
      fn(...args)
    } catch (error) {
      log.warn(`${channel} listener failed: ${String(error)}`)
    }
  })
}
