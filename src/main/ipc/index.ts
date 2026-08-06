import { type MainWindow } from '../app/window'
import { type TrayPopup } from '../app/tray-popup'
import { type SettingsService } from '../services/settings'
import { type LibraryService } from '../services/library'
import { type SoundCloudApi } from '../services/soundcloud/api'
import { type ScAuthService } from '../services/soundcloud/auth'
import { type PresenceManager } from '../integrations/discord/presence'
import { type PluginManager } from '../plugins/manager'
import { type UpdaterService } from '../updater'
import { type SocialService } from '../services/social/service'
import { type StatsService } from '../services/stats'
import { registerAppIpc } from './app'
import { registerDataIpc } from './data'
import { registerSoundCloudIpc } from './soundcloud'
import { registerFeatureIpc } from './features'
import { registerSocialIpc } from './social'

export interface AppContext {
  mainWindow: MainWindow
  trayPopup: TrayPopup
  settings: SettingsService
  library: LibraryService
  sc: SoundCloudApi
  auth: ScAuthService
  presence: PresenceManager
  plugins: PluginManager
  updater: UpdaterService
  social: SocialService
  stats: StatsService
  flushers: (() => void)[]
}

export function registerIpc(ctx: AppContext): void {
  registerAppIpc(ctx)
  registerDataIpc(ctx)
  registerSoundCloudIpc(ctx)
  registerFeatureIpc(ctx)
  registerSocialIpc(ctx)
}
