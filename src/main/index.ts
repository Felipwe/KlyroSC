import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { APP_ID, APP_NAME } from '@shared/constants'
import { IPC } from '@shared/types/ipc'
import { type Settings } from '@shared/types/settings'
import { logger } from './core/logger'
import { cleanupLegacyData } from './core/cleanup'
import { initAdBlock, setAdBlockEnabled } from './core/adblock'
import { MainWindow } from './app/window'
import { AppTray } from './app/tray'
import { applyGlobalMediaKeys } from './app/shortcuts'
import { SettingsService } from './services/settings'
import { LibraryService } from './services/library'
import { SoundCloudApi } from './services/soundcloud/api'
import { ScAuthService } from './services/soundcloud/auth'
import { PresenceManager } from './integrations/discord/presence'
import { PluginManager } from './plugins/manager'
import { UpdaterService } from './updater'
import { registerIpc, type AppContext } from './ipc'
import { runSmokeCapture } from './smoke'

loadDotEnv()

const log = logger.scope('main')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  app.setAppUserModelId(APP_ID)
  app.setName(APP_NAME)

  const settings = new SettingsService()
  if (!settings.get().performance.hardwareAcceleration) app.disableHardwareAcceleration()

  const mainWindow = new MainWindow()
  const tray = new AppTray()
  const library = new LibraryService()
  const sc = new SoundCloudApi()
  const auth = new ScAuthService(sc)
  const presence = new PresenceManager()
  const plugins = new PluginManager(
    (action) => mainWindow.send(IPC.playerCommand, action),
    (message) => mainWindow.send(IPC.pluginToast, message),
    () => mainWindow.get()?.isFocused() ?? false
  )
  const updater = new UpdaterService(
    (status) => mainWindow.send(IPC.updateStatusEvent, status),
    settings.get().updates.autoDownload
  )

  const ctx: AppContext = {
    mainWindow,
    settings,
    library,
    sc,
    auth,
    presence,
    plugins,
    updater,
    flushers: []
  }

  app.on('second-instance', () => mainWindow.show())

  app.whenReady().then(() => {
    logger.init()
    log.info(`${APP_NAME} ${app.getVersion()} starting (electron ${process.versions.electron})`)
    cleanupLegacyData()

    const current = settings.get()
    mainWindow.closeToTray = current.system.closeToTray
    initAdBlock(true)

    registerIpc(ctx)
    mainWindow.create({
      backgroundThrottling: current.performance.backgroundThrottling,
      startMinimized: current.startup.startMinimized
    })

    const createTray = (s: Settings): void => {
      tray.destroy()
      tray.create(mainWindow, trayLabels(resolveLanguage(s)), () => {
        mainWindow.isQuitting = true
        app.quit()
      })
    }
    createTray(current)

    applyGlobalMediaKeys(mainWindow, current.system.globalMediaKeys)
    presence.configure(current.discord)
    plugins.loadAll()
    const applySystemPlugins = (): void => {
      const list = plugins.list()
      const isEnabled = (id: string): boolean =>
        list.find((plugin) => plugin.manifest.id === id)?.enabled ?? false
      setAdBlockEnabled(isEnabled('adblock'))
      sc.setRegionUnblock(isEnabled('region-unblock'))
    }
    applySystemPlugins()
    plugins.onChange(applySystemPlugins)
    void auth.init()
    auth.onChange((state) => mainWindow.send(IPC.authChanged, state))

    settings.onChange((next, previous) => {
      mainWindow.send(IPC.settingsChanged, next)
      mainWindow.closeToTray = next.system.closeToTray
      presence.configure(next.discord)
      updater.setAutoDownload(next.updates.autoDownload)
      if (next.system.globalMediaKeys !== previous.system.globalMediaKeys)
        applyGlobalMediaKeys(mainWindow, next.system.globalMediaKeys)
      if (next.language !== previous.language) createTray(next)
    })

    if (current.updates.autoCheck && app.isPackaged) {
      setTimeout(() => void updater.check(), 15000)
    }

    if (process.env.KLYRO_SMOKE === '1') {
      void runSmokeCapture(mainWindow)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow.create({
          backgroundThrottling: settings.get().performance.backgroundThrottling,
          startMinimized: false
        })
      } else {
        mainWindow.show()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    mainWindow.isQuitting = true
  })

  app.on('will-quit', () => {
    presence.destroy()
    plugins.stopAll()
    settings.flush()
    library.flush()
    for (const flush of ctx.flushers) flush()
    logger.close()
  })

  process.on('uncaughtException', (error) => {
    log.error('uncaught exception', error)
  })
  process.on('unhandledRejection', (reason) => {
    log.error('unhandled rejection', reason)
  })
}

function resolveLanguage(settings: Settings): 'en' | 'pt' {
  if (settings.language !== 'auto') return settings.language
  const locale = app.getLocale().toLowerCase()
  return locale.startsWith('pt') ? 'pt' : 'en'
}

function trayLabels(lang: 'en' | 'pt'): {
  open: string
  playPause: string
  next: string
  previous: string
  quit: string
} {
  return lang === 'pt'
    ? { open: 'Abrir o KlyroSC', playPause: 'Tocar/Pausar', next: 'Próxima faixa', previous: 'Faixa anterior', quit: 'Sair' }
    : { open: 'Open KlyroSC', playPause: 'Play/Pause', next: 'Next track', previous: 'Previous track', quit: 'Quit' }
}

function loadDotEnv(): void {
  try {
    const file = path.join(app.getAppPath(), '.env')
    const content = fs.readFileSync(file, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim())
      if (match && match[1] && process.env[match[1]] === undefined)
        process.env[match[1]] = (match[2] ?? '').replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env present */
  }
}
