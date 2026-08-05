import { type WebSocket } from 'ws'
import { type FriendPresence, type ListeningInfo, type SocialUser } from './types.js'

interface Client {
  socket: WebSocket
  user: SocialUser
  friends: Set<string>
  listening: ListeningInfo | null
  lastSeen: number
  msgWindowStart: number
  msgCount: number
}

/** Live connection registry: one socket per user, presence fan-out to friends only. */
export class Hub {
  private clients = new Map<string, Client>()

  connect(user: SocialUser, socket: WebSocket, friends: string[]): void {
    const existing = this.clients.get(user.id)
    if (existing && existing.socket !== socket) {
      try {
        existing.socket.close(4000, 'replaced')
      } catch {
        /* ignore */
      }
    }
    this.clients.set(user.id, {
      socket,
      user,
      friends: new Set(friends),
      listening: existing?.listening ?? null,
      lastSeen: Date.now(),
      msgWindowStart: Date.now(),
      msgCount: 0
    })
    this.broadcastPresence(user.id)
  }

  disconnect(userId: string, socket: WebSocket): void {
    const client = this.clients.get(userId)
    if (!client || client.socket !== socket) return
    this.clients.delete(userId)
    for (const friendId of client.friends) {
      this.send(friendId, {
        t: 'presence',
        userId,
        presence: { online: false, listening: null } satisfies FriendPresence
      })
    }
  }

  isOnline(userId: string): boolean {
    return this.clients.has(userId)
  }

  userOf(userId: string): SocialUser | null {
    return this.clients.get(userId)?.user ?? null
  }

  presenceOf(userId: string): FriendPresence {
    const client = this.clients.get(userId)
    return client ? { online: true, listening: client.listening } : { online: false, listening: null }
  }

  setListening(userId: string, listening: ListeningInfo | null): void {
    const client = this.clients.get(userId)
    if (!client) return
    client.listening = listening
    client.lastSeen = Date.now()
    this.broadcastPresence(userId)
  }

  /** Simple flood guard: max 80 messages per 10s per socket (chat included). */
  allowMessage(userId: string): boolean {
    const client = this.clients.get(userId)
    if (!client) return false
    const now = Date.now()
    if (now - client.msgWindowStart > 10_000) {
      client.msgWindowStart = now
      client.msgCount = 0
    }
    client.msgCount++
    return client.msgCount <= 80
  }

  /** Friendship caches must follow accepted/removed friendships for presence routing. */
  linkFriends(a: string, b: string): void {
    this.clients.get(a)?.friends.add(b)
    this.clients.get(b)?.friends.add(a)
    const clientA = this.clients.get(a)
    const clientB = this.clients.get(b)
    if (clientA) this.send(b, { t: 'presence', userId: a, presence: this.presenceOf(a) })
    if (clientB) this.send(a, { t: 'presence', userId: b, presence: this.presenceOf(b) })
  }

  unlinkFriends(a: string, b: string): void {
    this.clients.get(a)?.friends.delete(b)
    this.clients.get(b)?.friends.delete(a)
  }

  send(userId: string, message: Record<string, unknown>): void {
    const client = this.clients.get(userId)
    if (!client || client.socket.readyState !== client.socket.OPEN) return
    try {
      client.socket.send(JSON.stringify(message))
    } catch {
      /* socket teardown race — ignore */
    }
  }

  sendMany(userIds: string[], message: Record<string, unknown>): void {
    for (const id of userIds) this.send(id, message)
  }

  private broadcastPresence(userId: string): void {
    const client = this.clients.get(userId)
    if (!client) return
    const presence = this.presenceOf(userId)
    for (const friendId of client.friends) {
      this.send(friendId, { t: 'presence', userId, presence })
    }
  }
}
