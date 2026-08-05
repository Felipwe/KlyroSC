import { SOCIAL_API_BASE } from '@shared/constants'
import {
  EMPTY_SOCIAL,
  type ChatEventPayload,
  type ChatMessage,
  type Friend,
  type FriendPresence,
  type FriendRequest,
  type JamInvite,
  type JamPlayback,
  type JamState,
  type JamTrackRef,
  type ListeningInfo,
  type NewSocialAccount,
  type SocialSnapshot,
  type SocialUser
} from '@shared/types/social'
import {
  decryptChatMessage,
  deriveChatKey,
  encryptChatMessage,
  generateChatKeyPair,
  isValidPublicKey,
  type ChatKeyPair
} from '@shared/utils/chat-crypto'
import { isRecord } from '@shared/types/result'
import { JsonStore } from '../../core/store'
import { logger } from '../../core/logger'
import { paths } from '../../core/paths'

const log = logger.scope('social')

interface SocialCredentials {
  token: string | null
  user: SocialUser | null
  chatKeys: ChatKeyPair | null
  /** which public key we already uploaded, to avoid redundant POST /keys */
  uploadedKey: string | null
}

interface PendingAccount {
  token: string
  user: SocialUser
  accountNumber: string
}

const parseCredentials = (raw: unknown): SocialCredentials => {
  const empty: SocialCredentials = { token: null, user: null, chatKeys: null, uploadedKey: null }
  if (!isRecord(raw)) return empty
  const user =
    isRecord(raw.user) && typeof raw.user.id === 'string' && typeof raw.user.name === 'string'
      ? {
          id: raw.user.id,
          name: raw.user.name,
          publicId: typeof raw.user.publicId === 'number' ? raw.user.publicId : 0
        }
      : null
  const chatKeys =
    isRecord(raw.chatKeys) &&
    typeof raw.chatKeys.publicKey === 'string' &&
    typeof raw.chatKeys.privateKey === 'string'
      ? { publicKey: raw.chatKeys.publicKey, privateKey: raw.chatKeys.privateKey }
      : null
  return {
    token: typeof raw.token === 'string' && raw.token.length > 0 ? raw.token : null,
    user,
    chatKeys,
    uploadedKey: typeof raw.uploadedKey === 'string' ? raw.uploadedKey : null
  }
}

export class SocialService {
  private store = new JsonStore<SocialCredentials>(paths.socialFile(), parseCredentials)
  private snapshot: SocialSnapshot = { ...EMPTY_SOCIAL }
  private ws: WebSocket | null = null
  private pending: PendingAccount | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectDelay = 3_000
  private pingTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private resyncTimer: NodeJS.Timeout | null = null
  private presenceTimer: NodeJS.Timeout | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private clockOffset = 0
  private lastListening: ListeningInfo | null = null
  private presenceDirty = false
  private destroyed = false
  private chatKeyCache = new Map<string, { theirKey: string; key: CryptoKey }>()
  private typingThrottle = new Map<string, number>()

  constructor(
    private emitState: (snapshot: SocialSnapshot) => void,
    private emitJamPlayback: (playback: JamPlayback) => void,
    private emitChatMessage: (payload: ChatEventPayload) => void,
    private emitChatSent: (payload: { friendId: string; tempId: string; id: number; at: number }) => void,
    private emitChatTyping: (payload: { friendId: string }) => void
  ) {}

  private get baseUrl(): string {
    return (process.env.KLYRO_SOCIAL_API ?? SOCIAL_API_BASE).replace(/\/+$/, '')
  }

  private get wsUrl(): string {
    return `${this.baseUrl.replace(/^http/, 'ws')}/ws`
  }

  status(): SocialSnapshot {
    return this.snapshot
  }

  init(): void {
    const creds = this.store.get()
    if (creds.token && creds.user) {
      this.snapshot = { ...EMPTY_SOCIAL, account: creds.user }
      void this.connect()
    }
  }

  destroy(): void {
    this.destroyed = true
    this.teardownSocket()
    this.store.flush()
  }

  // ————— HTTP helper —————

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    tokenOverride?: string
  ): Promise<T> {
    const token = tokenOverride ?? this.store.get().token
    const headers: Record<string, string> = { accept: 'application/json' }
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers['content-type'] = 'application/json'
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(12_000)
      })
    } catch {
      throw new Error('network')
    }
    if (response.status === 204) return undefined as T
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      /* non-JSON body */
    }
    if (!response.ok) {
      const code =
        isRecord(payload) && typeof payload.error === 'string' ? payload.error : `http_${response.status}`
      if (response.status === 401 && !tokenOverride && this.store.get().token) {
        // stale session — drop credentials so the UI falls back to onboarding
        log.warn('session rejected by server, logging out')
        this.clearCredentials()
      }
      throw new Error(code)
    }
    return payload as T
  }

  // ————— account lifecycle —————

  async createAccount(): Promise<NewSocialAccount> {
    const data = await this.request<{ user: SocialUser; accountNumber: string; token: string }>(
      'POST',
      '/account'
    )
    this.pending = { token: data.token, user: data.user, accountNumber: data.accountNumber }
    return { user: data.user, accountNumber: data.accountNumber }
  }

  async confirmAccount(typedNumber: string): Promise<SocialSnapshot> {
    if (!this.pending) throw new Error('no_pending_account')
    const digits = typedNumber.replace(/[^0-9]/g, '')
    if (digits !== this.pending.accountNumber) throw new Error('code_mismatch')
    this.store.set({ token: this.pending.token, user: this.pending.user, chatKeys: null, uploadedKey: null })
    this.store.flush()
    this.snapshot = { ...EMPTY_SOCIAL, account: this.pending.user }
    this.pending = null
    await this.connect()
    return this.snapshot
  }

  async login(accountNumber: string): Promise<SocialSnapshot> {
    const digits = accountNumber.replace(/[^0-9]/g, '')
    if (!/^[0-9]{16}$/.test(digits)) throw new Error('invalid_account')
    const data = await this.request<{ user: SocialUser; token: string }>('POST', '/auth/login', {
      accountNumber: digits
    })
    this.store.set({ token: data.token, user: data.user, chatKeys: null, uploadedKey: null })
    this.store.flush()
    this.snapshot = { ...EMPTY_SOCIAL, account: data.user }
    await this.connect()
    return this.snapshot
  }

  async logout(): Promise<SocialSnapshot> {
    try {
      if (this.store.get().token) await this.request<void>('POST', '/auth/logout')
    } catch {
      /* best effort */
    }
    this.clearCredentials()
    return this.snapshot
  }

  async deleteAccount(): Promise<SocialSnapshot> {
    await this.request<void>('DELETE', '/account')
    this.clearCredentials()
    return this.snapshot
  }

  private clearCredentials(): void {
    this.store.set({ token: null, user: null, chatKeys: null, uploadedKey: null })
    this.store.flush()
    this.chatKeyCache.clear()
    this.teardownSocket()
    this.snapshot = { ...EMPTY_SOCIAL }
    this.emit()
  }

  // ————— friends —————

  async addFriend(publicId: number): Promise<void> {
    await this.request<unknown>('POST', '/friends/requests', { publicId })
    await this.refreshState()
  }

  async respondRequest(id: string, accept: boolean): Promise<void> {
    const suffix = accept ? 'accept' : 'decline'
    await this.request<unknown>('POST', `/friends/requests/${encodeURIComponent(id)}/${suffix}`)
    await this.refreshState()
  }

  async removeFriend(userId: string): Promise<void> {
    await this.request<void>('DELETE', `/friends/${encodeURIComponent(userId)}`)
    await this.refreshState()
  }

  // ————— jams —————

  async createJam(): Promise<void> {
    const state = await this.request<Record<string, unknown>>('POST', '/jams')
    this.applyState(state)
  }

  async inviteToJam(userId: string): Promise<void> {
    await this.request<unknown>('POST', '/jams/current/invites', { userId })
  }

  async respondInvite(id: string, accept: boolean): Promise<void> {
    if (accept) {
      const state = await this.request<Record<string, unknown>>(
        'POST',
        `/invites/${encodeURIComponent(id)}/accept`
      )
      this.applyState(state)
    } else {
      await this.request<void>('POST', `/invites/${encodeURIComponent(id)}/decline`)
      await this.refreshState()
    }
  }

  async leaveJam(): Promise<void> {
    await this.request<void>('POST', '/jams/current/leave')
    await this.refreshState()
  }

  async endJam(): Promise<void> {
    await this.request<void>('POST', '/jams/current/end')
    await this.refreshState()
  }

  async setJamControl(allow: boolean): Promise<void> {
    await this.request<unknown>('PATCH', '/jams/current', { allowGuestControl: allow })
  }

  // ————— realtime out —————

  setNowPlaying(listening: ListeningInfo | null): void {
    const changed =
      JSON.stringify(listening ?? null) !== JSON.stringify(this.lastListening ?? null)
    this.lastListening = listening
    if (!changed) return
    this.presenceDirty = true
    if (this.presenceTimer) return
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null
      if (!this.presenceDirty) return
      this.presenceDirty = false
      this.sendWs({ t: 'presence', listening: this.lastListening })
    }, 900)
  }

  sendJamPlayback(payload: { track: JamTrackRef | null; playing: boolean; position: number }): void {
    if (!this.snapshot.jam) return
    this.sendWs({ t: 'jam:playback', playback: payload })
  }

  sendJamQueue(queue: JamTrackRef[]): void {
    if (!this.snapshot.jam) return
    this.sendWs({ t: 'jam:queue', queue: queue.slice(0, 30) })
  }

  reconnectNow(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectDelay = 3_000
    void this.connect()
  }

  // ————— e2e chat —————

  private async ensureChatKeys(): Promise<ChatKeyPair | null> {
    const creds = this.store.get()
    if (!creds.token) return null
    if (creds.chatKeys) return creds.chatKeys
    const pair = await generateChatKeyPair()
    this.store.set({ ...this.store.get(), chatKeys: pair })
    this.store.flush()
    return pair
  }

  private async uploadChatKeyIfNeeded(): Promise<void> {
    const pair = await this.ensureChatKeys()
    if (!pair) return
    const creds = this.store.get()
    if (creds.uploadedKey === pair.publicKey) return
    try {
      await this.request<unknown>('POST', '/keys', { publicKey: pair.publicKey })
      this.store.set({ ...this.store.get(), uploadedKey: pair.publicKey })
      this.store.flush()
    } catch (error) {
      log.warn(`chat key upload failed: ${String(error)}`)
    }
  }

  private async chatKeyFor(friendId: string): Promise<CryptoKey | null> {
    let friend = this.snapshot.friends.find((item) => item.id === friendId)
    if (!friend?.chatKey) {
      // maybe the snapshot is stale (friend rotated keys) — refresh once
      try {
        await this.refreshState()
      } catch {
        return null
      }
      friend = this.snapshot.friends.find((item) => item.id === friendId)
    }
    if (!friend?.chatKey || !isValidPublicKey(friend.chatKey)) return null
    const cached = this.chatKeyCache.get(friendId)
    if (cached && cached.theirKey === friend.chatKey) return cached.key
    const pair = await this.ensureChatKeys()
    if (!pair) return null
    try {
      const key = await deriveChatKey(pair.privateKey, pair.publicKey, friend.chatKey)
      this.chatKeyCache.set(friendId, { theirKey: friend.chatKey, key })
      return key
    } catch (error) {
      log.warn(`chat key derivation failed: ${String(error)}`)
      return null
    }
  }

  async chatHistory(friendId: string, before?: number): Promise<ChatMessage[]> {
    const me = this.store.get().user
    if (!me) throw new Error('unauthorized')
    const key = await this.chatKeyFor(friendId)
    const query = before && before > 0 ? `?before=${Math.floor(before)}` : ''
    const data = await this.request<{
      messages: { id: number; fromId: string; iv: string; ct: string; at: number }[]
    }>('GET', `/chat/${encodeURIComponent(friendId)}${query}`)
    if (!key) return []
    const result: ChatMessage[] = []
    for (const row of data.messages) {
      const text = await decryptChatMessage(key, row.iv, row.ct)
      if (text === null) continue // other key generation — unreadable, skip honestly
      result.push({ id: row.id, fromMe: row.fromId === me.id, text, at: row.at })
    }
    return result
  }

  async chatSend(friendId: string, text: string, tempId: string): Promise<void> {
    const trimmed = text.trim()
    if (trimmed.length === 0 || trimmed.length > 2000) throw new Error('invalid_message')
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('network')
    const key = await this.chatKeyFor(friendId)
    if (!key) throw new Error('no_chat_key')
    const { iv, ct } = await encryptChatMessage(key, trimmed)
    this.sendWs({ t: 'chat:send', to: friendId, iv, ct, tempId })
  }

  chatTyping(friendId: string): void {
    const now = Date.now()
    const last = this.typingThrottle.get(friendId) ?? 0
    if (now - last < 1_200) return
    this.typingThrottle.set(friendId, now)
    this.sendWs({ t: 'chat:typing', to: friendId })
  }

  // ————— connection —————

  private async connect(): Promise<void> {
    if (this.destroyed) return
    const creds = this.store.get()
    if (!creds.token) return
    try {
      await this.refreshState()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message === 'unauthorized') return // credentials were cleared
      log.warn(`state fetch failed (${message}) — retrying`)
      this.scheduleReconnect()
      return
    }
    this.openSocket()
  }

  private openSocket(): void {
    const token = this.store.get().token
    if (!token || this.destroyed) return
    this.teardownSocket(false)
    let socket: WebSocket
    try {
      socket = new WebSocket(this.wsUrl)
    } catch (error) {
      log.warn(`websocket create failed: ${String(error)}`)
      this.scheduleReconnect()
      return
    }
    this.ws = socket

    socket.onopen = (): void => {
      socket.send(JSON.stringify({ t: 'hello', token }))
    }
    socket.onmessage = (event): void => {
      try {
        const data = JSON.parse(String(event.data)) as Record<string, unknown>
        this.handleWsMessage(data)
      } catch {
        /* ignore malformed */
      }
    }
    socket.onclose = (): void => {
      if (this.ws !== socket) return
      this.ws = null
      this.stopTimers()
      if (this.snapshot.connected) {
        this.snapshot = { ...this.snapshot, connected: false }
        this.emit()
      }
      this.scheduleReconnect()
    }
    socket.onerror = (): void => {
      /* onclose follows */
    }
  }

  private handleWsMessage(message: Record<string, unknown>): void {
    switch (message.t) {
      case 'ready': {
        this.reconnectDelay = 3_000
        if (typeof message.serverNow === 'number') this.clockOffset = message.serverNow - Date.now()
        this.snapshot = { ...this.snapshot, connected: true }
        this.emit()
        this.startTimers()
        void this.uploadChatKeyIfNeeded()
        // re-announce what we're listening to after reconnects
        if (this.lastListening) this.sendWs({ t: 'presence', listening: this.lastListening })
        break
      }
      case 'pong': {
        const sent = typeof message.sent === 'number' ? message.sent : 0
        const serverNow = typeof message.serverNow === 'number' ? message.serverNow : 0
        if (sent > 0 && serverNow > 0) {
          const rtt = Date.now() - sent
          this.clockOffset = serverNow - (sent + rtt / 2)
        }
        break
      }
      case 'sync':
        this.scheduleRefresh()
        break
      case 'presence': {
        const userId = typeof message.userId === 'string' ? message.userId : null
        const presence = message.presence as FriendPresence | undefined
        if (!userId || !isRecord(presence)) break
        this.snapshot = {
          ...this.snapshot,
          friends: this.snapshot.friends.map((friend) =>
            friend.id === userId ? { ...friend, presence } : friend
          )
        }
        this.emit()
        break
      }
      case 'jam:playback': {
        if (!this.snapshot.jam || !isRecord(message.playback)) break
        const playback = this.toLocalPlayback(message.playback as unknown as JamPlayback)
        this.snapshot = { ...this.snapshot, jam: { ...this.snapshot.jam, playback } }
        this.emit()
        this.emitJamPlayback(playback)
        break
      }
      case 'jam:queue': {
        if (!this.snapshot.jam || !Array.isArray(message.queue)) break
        this.snapshot = {
          ...this.snapshot,
          jam: { ...this.snapshot.jam, queue: message.queue as JamTrackRef[] }
        }
        this.emit()
        break
      }
      case 'jam:ended':
        this.snapshot = { ...this.snapshot, jam: null }
        this.emit()
        this.scheduleRefresh()
        break
      case 'chat:msg': {
        const from = typeof message.from === 'string' ? message.from : null
        const id = typeof message.id === 'number' ? message.id : 0
        const iv = typeof message.iv === 'string' ? message.iv : ''
        const ct = typeof message.ct === 'string' ? message.ct : ''
        const at = typeof message.at === 'number' ? message.at : Date.now()
        if (!from || !iv || !ct) break
        void (async () => {
          const key = await this.chatKeyFor(from)
          if (!key) return
          const text = await decryptChatMessage(key, iv, ct)
          if (text === null) return
          this.emitChatMessage({ friendId: from, message: { id, fromMe: false, text, at } })
        })()
        break
      }
      case 'chat:sent': {
        const to = typeof message.to === 'string' ? message.to : null
        const tempId = typeof message.tempId === 'string' ? message.tempId : ''
        const id = typeof message.id === 'number' ? message.id : 0
        const at = typeof message.at === 'number' ? message.at : Date.now()
        if (to) this.emitChatSent({ friendId: to, tempId, id, at })
        break
      }
      case 'chat:typing': {
        const from = typeof message.from === 'string' ? message.from : null
        if (from) this.emitChatTyping({ friendId: from })
        break
      }
      default:
        break
    }
  }

  private toLocalPlayback(playback: JamPlayback): JamPlayback {
    return { ...playback, at: playback.at - this.clockOffset }
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      void this.refreshState().catch((error) => log.warn(`refresh failed: ${String(error)}`))
    }, 250)
  }

  private async refreshState(): Promise<void> {
    const state = await this.request<Record<string, unknown>>('GET', '/state')
    this.applyState(state)
  }

  private applyState(state: Record<string, unknown>): void {
    if (typeof state.serverNow === 'number' && this.clockOffset === 0)
      this.clockOffset = state.serverNow - Date.now()
    const user = state.user as SocialUser | undefined
    const jamRaw = state.jam as JamState | null | undefined
    const jam = jamRaw ? { ...jamRaw, playback: this.toLocalPlayback(jamRaw.playback) } : null
    this.snapshot = {
      account: user ?? this.snapshot.account,
      connected: this.snapshot.connected,
      friends: (state.friends as Friend[] | undefined) ?? [],
      requests: (state.requests as FriendRequest[] | undefined) ?? [],
      invites: (state.invites as JamInvite[] | undefined) ?? [],
      jam
    }
    if (user) {
      const creds = this.store.get()
      if (
        creds.token &&
        (creds.user?.id !== user.id || creds.user?.name !== user.name || creds.user?.publicId !== user.publicId)
      )
        this.store.set({ ...creds, user })
    }
    this.emit()
  }

  private sendWs(message: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify(message))
    } catch {
      /* socket race */
    }
  }

  private startTimers(): void {
    this.stopTimers()
    this.pingTimer = setInterval(() => {
      this.sendWs({ t: 'ping', sent: Date.now() })
    }, 5 * 60 * 1000)
    this.heartbeatTimer = setInterval(() => {
      if (this.snapshot.jam && this.lastListening?.playing) this.sendWs({ t: 'jam:heartbeat' })
    }, 2 * 60 * 1000)
    // safety net: a missed ws 'sync' must never leave the snapshot stale forever
    this.resyncTimer = setInterval(() => {
      void this.refreshState().catch(() => undefined)
    }, 30 * 1000)
  }

  private stopTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.resyncTimer) clearInterval(this.resyncTimer)
    this.pingTimer = null
    this.heartbeatTimer = null
    this.resyncTimer = null
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer || !this.store.get().token) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000)
  }

  private teardownSocket(clearReconnect = true): void {
    this.stopTimers()
    if (clearReconnect && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      const socket = this.ws
      this.ws = null
      try {
        socket.onclose = null
        socket.close()
      } catch {
        /* already closed */
      }
    }
  }

  private emit(): void {
    this.emitState(this.snapshot)
  }
}
