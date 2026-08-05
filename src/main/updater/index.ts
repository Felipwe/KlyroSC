import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { type UpdateStatus } from '@shared/types/update'
import { logger } from '../core/logger'

const { autoUpdater } = electronUpdater
const log = logger.scope('updater')

type Broadcast = (status: UpdateStatus) => void

export class UpdaterService {
  private status: UpdateStatus = {
    phase: 'idle',
    current: app.getVersion(),
    latest: null,
    notes: null,
    percent: 0,
    error: null
  }
  private broadcast: Broadcast
  private wired = false
  private autoFlow = false
  private autoInstallScheduled = false
  private onBeforeInstall?: () => void

  constructor(broadcast: Broadcast, private autoDownload: boolean, onBeforeInstall?: () => void) {
    this.broadcast = broadcast
    this.onBeforeInstall = onBeforeInstall
  }

  private setStatus(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch }
    this.broadcast(this.status)
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  setAutoDownload(value: boolean): void {
    this.autoDownload = value
    if (this.wired) autoUpdater.autoDownload = value
  }

  private wire(): void {
    if (this.wired) return
    this.wired = true
    autoUpdater.autoDownload = this.autoDownload
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () =>
      this.setStatus({ phase: 'checking', error: null })
    )
    autoUpdater.on('update-available', (info) => {
      this.setStatus({
        phase: this.autoDownload ? 'downloading' : 'available',
        latest: info.version,
        notes: normalizeNotes(info.releaseNotes),
        percent: 0
      })
    })
    autoUpdater.on('update-not-available', () =>
      this.setStatus({ phase: 'not-available', latest: null, percent: 0 })
    )
    autoUpdater.on('download-progress', (progress) =>
      this.setStatus({ phase: 'downloading', percent: Math.round(progress.percent) })
    )
    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({ phase: 'downloaded', latest: info.version, percent: 100 })
      if (this.autoFlow) this.scheduleAutoInstall()
    })
    autoUpdater.on('error', (error) => this.handleError(error))
  }

  // close-to-tray keeps the app alive, so autoInstallOnAppQuit never fires on its own;
  // when the boot check finishes downloading, install and relaunch right away.
  private scheduleAutoInstall(): void {
    if (this.autoInstallScheduled) return
    this.autoInstallScheduled = true
    log.info('update downloaded automatically — installing and relaunching')
    this.setStatus({ autoInstalling: true })
    setTimeout(() => {
      this.onBeforeInstall?.()
      autoUpdater.quitAndInstall(true, true)
    }, 6000)
  }

  private handleError(error: unknown): void {
    const raw = error instanceof Error ? error.message : String(error)
    if (/latest\.yml/i.test(raw) && /404/.test(raw)) {
      log.info('no update feed published for the latest release yet')
      this.setStatus({ phase: 'not-available', latest: null, percent: 0, error: null })
      return
    }
    const friendly = (raw.split('\n')[0] ?? raw).slice(0, 160)
    log.warn(`updater error: ${friendly}`)
    this.setStatus({ phase: 'error', error: friendly })
  }

  async check(auto = false): Promise<UpdateStatus> {
    if (!app.isPackaged) {
      this.setStatus({ phase: 'not-available', error: null })
      return this.status
    }
    if (auto) this.autoFlow = true
    this.wire()
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.handleError(error)
    }
    return this.status
  }

  async download(): Promise<UpdateStatus> {
    if (!app.isPackaged || this.status.phase !== 'available') return this.status
    // manual download from the Updates tab: let the user hit Restart when ready
    this.autoFlow = false
    this.wire()
    try {
      this.setStatus({ phase: 'downloading', percent: 0 })
      await autoUpdater.downloadUpdate()
    } catch (error) {
      this.handleError(error)
    }
    return this.status
  }

  install(): void {
    if (this.status.phase === 'downloaded') {
      this.onBeforeInstall?.()
      autoUpdater.quitAndInstall()
    }
  }
}

function normalizeNotes(notes: string | { note: string | null; version: string }[] | null | undefined): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return stripHtml(notes)
  return notes
    .map((n) => `${n.version}\n${stripHtml(n.note ?? '')}`)
    .join('\n\n')
    .trim()
}

const stripHtml = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
