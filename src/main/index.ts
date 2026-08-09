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
import { TrayPopup, type TrayPopupLabels } from './app/tray-popup'
import { applyGlobalMediaKeys } from './app/shortcuts'
import { SettingsService } from './services/settings'
import { LibraryService } from './services/library'
import { SoundCloudApi } from './services/soundcloud/api'
import { ScAuthService } from './services/soundcloud/auth'
import { PresenceManager } from './integrations/discord/presence'
import { PluginManager } from './plugins/manager'
import { UpdaterService } from './updater'
import { SocialService } from './services/social/service'
import { StatsService } from './services/stats'
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
  // one-time switch to the album-art theme for existing installs (changeable in settings)
  if (!settings.get().system.artThemeMigrated)
    settings.patch({ appearance: { accent: 'art' }, system: { artThemeMigrated: true } })

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
  const trayPopup = new TrayPopup(
    () => {
      const s = settings.get()
      return {
        version: app.getVersion(),
        accent: s.appearance.accent,
        accentColors:
          s.appearance.accent === 'custom'
            ? { a: s.appearance.custom.colorA, b: s.appearance.custom.colorB }
            : null,
        labels: trayPopupLabels(resolveLanguage(s))
      }
    },
    (action) => {
      if (action === 'open') {
        mainWindow.show()
      } else if (action === 'quit') {
        mainWindow.isQuitting = true
        app.quit()
      } else {
        mainWindow.send(IPC.media, action)
      }
    }
  )
  const updater = new UpdaterService(
    (status) => mainWindow.send(IPC.updateStatusEvent, status),
    settings.get().updates.autoDownload,
    () => {
      // let the auto-update actually quit past the close-to-tray guard
      mainWindow.isQuitting = true
    }
  )
  const social = new SocialService(
    (snapshot) => {
      mainWindow.send(IPC.socialState, snapshot)
      presence.setJamInfo(snapshot.jam ? `Jam ${snapshot.jam.members.length}/8` : null)
    },
    (playback) => mainWindow.send(IPC.socialJamPlayback, playback),
    (payload) => mainWindow.send(IPC.socialChatMessage, payload),
    (payload) => mainWindow.send(IPC.socialChatSent, payload),
    (payload) => mainWindow.send(IPC.socialChatTypingEvent, payload),
    (payload) => mainWindow.send(IPC.socialChatRejected, payload),
    (action) => mainWindow.send(IPC.socialAdminEvent, action)
  )
  const stats = new StatsService()
  // profile stats shared with friends: refresh shortly after boot, then periodically.
  // sends only the unreported delta; the server accumulates it into the account total
  const reportStats = (): void => {
    const report = stats.pendingReport()
    void social
      .reportStats({
        listeningMs: report.deviceMs,
        listeningDeltaMs: report.deltaMs,
        topTrack: stats.topTrack(library.get().history)
      })
      .then((accountTotal) => {
        if (accountTotal !== null) stats.commitReport(report.deviceMs, accountTotal)
      })
  }
  setTimeout(reportStats, 20_000)
  setInterval(reportStats, 5 * 60 * 1000)

  const ctx: AppContext = {
    mainWindow,
    trayPopup,
    settings,
    library,
    sc,
    auth,
    presence,
    plugins,
    updater,
    social,
    stats,
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

    const createTray = (): void => {
      tray.destroy()
      tray.create(mainWindow, (bounds) => trayPopup.toggle(bounds))
    }
    createTray()

    applyGlobalMediaKeys(mainWindow, current.system.globalMediaKeys)
    presence.configure(current.discord)
    plugins.loadAll()
    const applySystemPlugins = (): void => {
      const list = plugins.list()
      const isEnabled = (id: string): boolean =>
        list.find((plugin) => plugin.manifest.id === id)?.enabled ?? false
      setAdBlockEnabled(isEnabled('adblock'))
      sc.setRegionUnblock(isEnabled('region-unblock'))
      mainWindow.send(IPC.pluginsChanged, list)
      trayPopup.refresh()
    }
    applySystemPlugins()
    plugins.onChange(applySystemPlugins)
    void auth.init()
    auth.onChange((state) => mainWindow.send(IPC.authChanged, state))
    social.init()

    settings.onChange((next, previous) => {
      mainWindow.send(IPC.settingsChanged, next)
      mainWindow.closeToTray = next.system.closeToTray
      presence.configure(next.discord)
      updater.setAutoDownload(next.updates.autoDownload)
      if (next.system.globalMediaKeys !== previous.system.globalMediaKeys)
        applyGlobalMediaKeys(mainWindow, next.system.globalMediaKeys)
      trayPopup.refresh()
    })

    if (current.updates.autoCheck && app.isPackaged) {
      setTimeout(() => void updater.check(true), 4000)
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
    trayPopup.destroy()
    social.destroy()
    stats.destroy()
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

function trayPopupLabels(lang: 'en' | 'pt'): TrayPopupLabels {
  return lang === 'pt'
    ? {
        nothing: 'Nada tocando',
        nothingHint: 'Escolha um som no app',
        open: 'Abrir o KlyroSC',
        quit: 'Sair'
      }
    : {
        nothing: 'Nothing playing',
        nothingHint: 'Pick a sound in the app',
        open: 'Open KlyroSC',
        quit: 'Quit'
      }
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
