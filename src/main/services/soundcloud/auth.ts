import { BrowserWindow, session, type Session } from 'electron'
import { type AuthState, type AuthUser, LOGGED_OUT } from '@shared/types/auth'
import { isRecord } from '@shared/types/result'
import { JsonStore } from '../../core/store'
import path from 'node:path'
import { app } from 'electron'
import { logger } from '../../core/logger'
import { setScAuthToken, SC_UA } from './client'
import { artworkUrl } from './mappers'
import { type SoundCloudApi } from './api'

const log = logger.scope('sc-auth')
const PARTITION = 'persist:sc-auth'
const SIGNIN_URL = 'https://soundcloud.com/signin'
const LOGIN_TIMEOUT = 5 * 60 * 1000

const parseUser = (raw: unknown): AuthUser | null => {
  if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: raw.name,
    handle: typeof raw.handle === 'string' ? raw.handle : '',
    avatar: typeof raw.avatar === 'string' ? raw.avatar : null,
    url: typeof raw.url === 'string' ? raw.url : ''
  }
}

export class ScAuthService {
  private store = new JsonStore<AuthUser | null>(
    path.join(app.getPath('userData'), 'auth.json'),
    parseUser
  )
  private token: string | null = null
  private user: AuthUser | null = null
  private listeners = new Set<(state: AuthState) => void>()
  private loginWindow: BrowserWindow | null = null

  constructor(private readonly sc: SoundCloudApi) {}

  private get session(): Session {
    return session.fromPartition(PARTITION)
  }

  async init(): Promise<void> {
    // language must match the system locale — bot checks score UA/locale coherence
    this.session.setUserAgent(SC_UA, app.getLocale() || 'en-US')
    this.token = await this.readTokenCookie()
    if (this.token) {
      setScAuthToken(this.token)
      this.user = this.store.get()
      void this.refreshProfile()
      log.info('restored SoundCloud session')
    }
  }

  state(): AuthState {
    return this.token && this.user ? { loggedIn: true, user: this.user } : { ...LOGGED_OUT }
  }

  isLoggedIn(): boolean {
    return this.token !== null && this.user !== null
  }

  userId(): number | null {
    return this.user?.id ?? null
  }

  onChange(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const state = this.state()
    for (const listener of this.listeners) listener(state)
  }

  private async readTokenCookie(): Promise<string | null> {
    try {
      const cookies = await this.session.cookies.get({ name: 'oauth_token' })
      const value = cookies.find((c) => c.domain?.includes('soundcloud.com'))?.value
      return value && value.length > 8 ? value : null
    } catch {
      return null
    }
  }

  private async fetchMe(): Promise<AuthUser | null> {
    const raw = await this.sc.me()
    if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.username !== 'string') return null
    return {
      id: raw.id,
      name: raw.username,
      handle: typeof raw.permalink === 'string' ? raw.permalink : '',
      avatar: artworkUrl(typeof raw.avatar_url === 'string' ? raw.avatar_url : null, 't120x120'),
      url: typeof raw.permalink_url === 'string' ? raw.permalink_url : ''
    }
  }

  private async refreshProfile(): Promise<void> {
    try {
      const me = await this.fetchMe()
      if (me) {
        this.user = me
        this.store.set(me)
        this.emit()
      }
    } catch (error) {
      if (!this.user) {
        log.warn(`stored session is invalid: ${String(error)}`)
        this.token = null
        setScAuthToken(null)
      }
    }
  }

  async login(parent: BrowserWindow | null): Promise<AuthState> {
    if (this.isLoggedIn()) return this.state()
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus()
      return this.state()
    }

    const token = await this.openLoginWindow(parent)
    if (!token) return this.state()

    this.token = token
    setScAuthToken(token)
    try {
      this.user = await this.fetchMe()
      this.store.set(this.user)
      this.store.flush()
      log.info(`logged in as ${this.user?.name ?? 'unknown'}`)
    } catch (error) {
      log.error('could not load profile after login', error)
    }
    this.emit()
    return this.state()
  }

  private openLoginWindow(parent: BrowserWindow | null): Promise<string | null> {
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        width: 520,
        height: 780,
        parent: parent ?? undefined,
        autoHideMenuBar: true,
        title: 'SoundCloud  KlyroSC',
        backgroundColor: '#0a0b12',
        webPreferences: {
          partition: PARTITION,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      })
      this.loginWindow = win

      let settled = false
      const cookieListener = (): void => void check()
      const timeout = setTimeout(() => finish(null), LOGIN_TIMEOUT)

      const finish = (token: string | null): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.session.cookies.removeListener('changed', cookieListener)
        this.loginWindow = null
        if (!win.isDestroyed()) win.close()
        resolve(token)
      }

      const check = async (): Promise<void> => {
        if (settled) return
        const token = await this.readTokenCookie()
        if (token) finish(token)
      }

      this.session.cookies.on('changed', cookieListener)
      win.webContents.on('did-navigate', () => void check())
      win.webContents.setWindowOpenHandler(({ url }) =>
        url.startsWith('https://') ? { action: 'allow' } : { action: 'deny' }
      )
      win.on('closed', () => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          this.session.cookies.removeListener('changed', cookieListener)
          this.loginWindow = null
          resolve(null)
        }
      })

      void win.loadURL(SIGNIN_URL)
      void check()
    })
  }

  async logout(): Promise<AuthState> {
    this.token = null
    this.user = null
    setScAuthToken(null)
    this.store.set(null)
    this.store.flush()
    try {
      await this.session.clearStorageData()
    } catch (error) {
      log.warn(`could not clear auth session: ${String(error)}`)
    }
    this.emit()
    log.info('logged out')
    return this.state()
  }
}
