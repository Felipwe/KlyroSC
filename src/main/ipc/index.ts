import { type MainWindow } from '../app/window'
import { type SettingsService } from '../services/settings'
import { type LibraryService } from '../services/library'
import { type SoundCloudApi } from '../services/soundcloud/api'
import { type ScAuthService } from '../services/soundcloud/auth'
import { type PresenceManager } from '../integrations/discord/presence'
import { type PluginManager } from '../plugins/manager'
import { type UpdaterService } from '../updater'
import { registerAppIpc } from './app'
import { registerDataIpc } from './data'
import { registerSoundCloudIpc } from './soundcloud'
import { registerFeatureIpc } from './features'

export interface AppContext {
  mainWindow: MainWindow
  settings: SettingsService
  library: LibraryService
  sc: SoundCloudApi
  auth: ScAuthService
  presence: PresenceManager
  plugins: PluginManager
  updater: UpdaterService
  flushers: (() => void)[]
}

export function registerIpc(ctx: AppContext): void {
  registerAppIpc(ctx)
  registerDataIpc(ctx)
  registerSoundCloudIpc(ctx)
  registerFeatureIpc(ctx)
}
