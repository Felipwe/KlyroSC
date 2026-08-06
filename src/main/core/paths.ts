import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

export const paths = {
  userData: (): string => app.getPath('userData'),
  logs: (): string => path.join(app.getPath('userData'), 'logs'),
  settingsFile: (): string => path.join(app.getPath('userData'), 'settings.json'),
  libraryFile: (): string => path.join(app.getPath('userData'), 'library.json'),
  playbackFile: (): string => path.join(app.getPath('userData'), 'playback.json'),
  windowStateFile: (): string => path.join(app.getPath('userData'), 'window-state.json'),
  scCacheFile: (): string => path.join(app.getPath('userData'), 'soundcloud.json'),
  pluginStateFile: (): string => path.join(app.getPath('userData'), 'plugins.json'),
  socialFile: (): string => path.join(app.getPath('userData'), 'social.json'),
  statsFile: (): string => path.join(app.getPath('userData'), 'stats.json'),
  pluginDataDir: (): string => path.join(app.getPath('userData'), 'plugin-data'),
  externalPluginsDir: (): string => path.join(app.getPath('userData'), 'plugins'),
  builtinPluginsDir: (): string =>
    app.isPackaged
      ? path.join(process.resourcesPath, 'plugins')
      : path.join(app.getAppPath(), 'resources', 'plugins'),
  downloadsDir: (): string => path.join(app.getPath('downloads'), 'KlyroSC')
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
