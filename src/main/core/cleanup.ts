import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { logger } from './logger'

const log = logger.scope('cleanup')

export function cleanupLegacyData(): void {
  const userData = app.getPath('userData')
  const targets = [
    path.join(userData, 'Partitions', 'soundcloud'),
    path.join(userData, 'adblocker-engine.bin'),
    path.join(userData, 'cookies.json')
  ]
  for (const target of targets) {
    if (!fs.existsSync(target)) continue
    fs.promises
      .rm(target, { recursive: true, force: true })
      .then(() => log.info(`removed legacy leftover: ${path.basename(target)}`))
      .catch((error: unknown) => log.warn(`could not remove ${target}: ${String(error)}`))
  }
}
