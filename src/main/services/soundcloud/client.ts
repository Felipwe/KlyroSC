import { session } from 'electron'
import { SC_API_BASE, SC_HOME_URL } from '@shared/constants'
import { JsonStore } from '../../core/store'
import { paths } from '../../core/paths'
import { logger } from '../../core/logger'
import { isRecord } from '@shared/types/result'

const log = logger.scope('sc-client')

const AUTH_PARTITION = 'persist:sc-auth'

// UA must match the real engine: Chromium sends Sec-CH-UA client hints with the true
// version/platform, and DataDome flags any mismatch with the User-Agent header
const UA_PLATFORM =
  process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'linux'
      ? 'X11; Linux x86_64'
      : 'Windows NT 10.0; Win64; x64'

// real browsers ship the reduced UA (major.0.0.0), matching the client-hints major
const CHROME_MAJOR = process.versions.chrome.split('.')[0] ?? '142'

export const SC_UA = `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`

const UA = SC_UA

// Mobile UA issues different track_authorization tokens which bypass most geo-restrictions
const MOBILE_UA = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Mobile Safari/537.36`

// Headers that hint a neutral/US geo origin to CDN routing layers
const GEO_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Forwarded-For': '1.1.1.1'
} as const

let authToken: string | null = null

export function setScAuthToken(token: string | null): void {
  authToken = token
}

export interface RequestInitLite {
  method?: 'GET' | 'PUT' | 'DELETE' | 'POST'
  body?: unknown
}

const CLIENT_ID_TTL = 12 * 60 * 60 * 1000
const SCRIPT_RE = /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g
const ID_RES = [/client_id\s*[:=]\s*"([A-Za-z0-9]{32})"/, /[?&]client_id=([A-Za-z0-9]{32})/]

interface ScCache {
  clientId: string | null
  fetchedAt: number
}

const parseCache = (raw: unknown): ScCache => {
  if (isRecord(raw) && typeof raw.clientId === 'string' && typeof raw.fetchedAt === 'number')
    return { clientId: raw.clientId, fetchedAt: raw.fetchedAt }
  return { clientId: null, fetchedAt: 0 }
}

export class ScClient {
  private cache = new JsonStore<ScCache>(paths.scCacheFile(), parseCache)
  private refreshing: Promise<string> | null = null

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res.text()
  }

  private async scrapeClientId(): Promise<string> {
    const html = await this.fetchText(SC_HOME_URL)
    const scripts = [...html.matchAll(SCRIPT_RE)].map((m) => m[1]).filter((s): s is string => !!s)
    if (scripts.length === 0) throw new Error('no asset scripts found on soundcloud.com')
    for (const src of scripts.reverse()) {
      try {
        const js = await this.fetchText(src)
        for (const re of ID_RES) {
          const match = re.exec(js)
          if (match?.[1]) return match[1]
        }
      } catch {
        continue
      }
    }
    throw new Error('client_id not found in any asset script')
  }

  private async ensureClientId(force = false): Promise<string> {
    const cached = this.cache.get()
    if (!force && cached.clientId && Date.now() - cached.fetchedAt < CLIENT_ID_TTL)
      return cached.clientId
    if (!this.refreshing) {
      this.refreshing = this.scrapeClientId()
        .then((id) => {
          this.cache.set({ clientId: id, fetchedAt: Date.now() })
          this.cache.flush()
          log.info('refreshed SoundCloud client_id')
          return id
        })
        .finally(() => {
          this.refreshing = null
        })
    }
    try {
      return await this.refreshing
    } catch (error) {
      if (cached.clientId) {
        log.warn('client_id refresh failed, reusing cached id')
        return cached.clientId
      }
      throw error
    }
  }

  private async request(url: string, init?: RequestInitLite): Promise<unknown> {
    const method = init?.method ?? 'GET'
    const body = init?.body !== undefined ? JSON.stringify(init.body) : undefined

    // Writes must look like the logged-in web app: Chromium's network stack with the
    // sc-auth session cookies (datadome & friends)  plain node fetch gets rejected.
    if (method !== 'GET' && authToken) {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `OAuth ${authToken}`,
        Origin: 'https://soundcloud.com',
        Referer: 'https://soundcloud.com/'
      }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      const res = await session.fromPartition(AUTH_PARTITION).fetch(url, {
        method,
        headers,
        body,
        credentials: 'include',
        signal: AbortSignal.timeout(15000)
      })
      return this.parseResponse(res)
    }

    const headers: Record<string, string> = {
      'User-Agent': UA,
      Accept: 'application/json',
      ...GEO_HEADERS
    }
    if (authToken) headers.Authorization = `OAuth ${authToken}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(15000)
    })
    return this.parseResponse(res)
  }

  private async parseResponse(res: Response): Promise<unknown> {
    if (res.status === 401 || res.status === 403) throw new UnauthorizedError()
    if (!res.ok) throw new Error(`SoundCloud API error ${res.status}`)
    const text = await res.text()
    return text ? JSON.parse(text) : null
  }

  private withClientId(url: string, clientId: string): string {
    const u = new URL(url)
    u.searchParams.set('client_id', clientId)
    return u.toString()
  }

  async api(
    endpoint: string,
    params: Record<string, string | number> = {},
    init?: RequestInitLite
  ): Promise<unknown> {
    const url = new URL(SC_API_BASE + endpoint)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
    return this.absolute(url.toString(), init)
  }

  async absolute(url: string, init?: RequestInitLite): Promise<unknown> {
    let clientId = await this.ensureClientId()
    try {
      return await this.request(this.withClientId(url, clientId), init)
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error
      if (authToken && init?.method && init.method !== 'GET') throw error
      clientId = await this.ensureClientId(true)
      return this.request(this.withClientId(url, clientId), init)
    }
  }

  // Fetches with widget-player origin headers so the API issues embed-context CDN tokens,
  // which bypass most regional licensing restrictions.
  async widgetAbsolute(url: string): Promise<unknown> {
    let clientId = await this.ensureClientId()
    const makeReq = (id: string): Promise<Response> =>
      fetch(this.withClientId(url, id), {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          ...GEO_HEADERS,
          Origin: 'https://w.soundcloud.com',
          Referer: 'https://w.soundcloud.com/'
        },
        signal: AbortSignal.timeout(15000)
      })
    try {
      return this.parseResponse(await makeReq(clientId))
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error
      clientId = await this.ensureClientId(true)
      return this.parseResponse(await makeReq(clientId))
    }
  }

  // Fetches as an Android mobile client.  Mobile context often yields different
  // track_authorization tokens that are not subject to web-player geo-blocks.
  async mobileAbsolute(url: string): Promise<unknown> {
    let clientId = await this.ensureClientId()
    const makeReq = (id: string): Promise<Response> =>
      fetch(this.withClientId(url, id), {
        headers: {
          'User-Agent': MOBILE_UA,
          Accept: 'application/json',
          ...GEO_HEADERS,
          Origin: 'https://soundcloud.com',
          Referer: 'https://soundcloud.com/'
        },
        signal: AbortSignal.timeout(15000)
      })
    try {
      return this.parseResponse(await makeReq(clientId))
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error
      clientId = await this.ensureClientId(true)
      return this.parseResponse(await makeReq(clientId))
    }
  }
}

class UnauthorizedError extends Error {
  constructor() {
    super('SoundCloud rejected the client_id')
  }
}
