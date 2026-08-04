import { globalShortcut } from 'electron'
import { IPC } from '@shared/types/ipc'
import { type MainWindow } from './window'
import { logger } from '../core/logger'

const log = logger.scope('shortcuts')

export function applyGlobalMediaKeys(mainWindow: MainWindow, enabled: boolean): void {
  globalShortcut.unregister('MediaPlayPause')
  globalShortcut.unregister('MediaNextTrack')
  globalShortcut.unregister('MediaPreviousTrack')
  if (!enabled) return
  try {
    globalShortcut.register('MediaPlayPause', () => mainWindow.send(IPC.media, 'play-pause'))
    globalShortcut.register('MediaNextTrack', () => mainWindow.send(IPC.media, 'next'))
    globalShortcut.register('MediaPreviousTrack', () => mainWindow.send(IPC.media, 'previous'))
    log.info('global media keys registered')
  } catch (error) {
    log.warn(`could not register media keys: ${String(error)}`)
  }
}
