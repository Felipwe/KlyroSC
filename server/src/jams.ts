import { randomUUID } from 'node:crypto'
import {
  type JamChatEntry,
  type JamDto,
  type JamInviteDto,
  type JamPlayback,
  type JamTrackRef,
  type SocialUser
} from './types.js'

export const JAM_MAX_MEMBERS = 8
const INVITE_TTL_MS = 10 * 60 * 1000
/** a jam with nobody playing anything for this long is shut down */
const IDLE_TTL_MS = 20 * 60 * 1000
const QUEUE_LIMIT = 30
const CHAT_KEEP = 50
const CHAT_DTO = 30
/** owner offline grace before the crown moves to the oldest member */
const OWNER_OFFLINE_GRACE_MS = 60 * 1000

interface Invite {
  id: string
  jamId: string
  fromId: string
  toId: string
  createdAt: number
}

interface Jam {
  id: string
  ownerId: string
  allowGuestControl: boolean
  /** userId → joinedAt epoch ms (insertion kept, timestamps decide seniority) */
  members: Map<string, number>
  queue: JamTrackRef[]
  playback: JamPlayback
  chat: JamChatEntry[]
  chatCounter: number
  lastActivity: number
  ownerOfflineTimer: NodeJS.Timeout | null
}

export type JamEvent =
  | { kind: 'sync'; userIds: string[] }
  | { kind: 'playback'; userIds: string[]; playback: JamPlayback }
  | { kind: 'queue'; userIds: string[]; queue: JamTrackRef[] }
  | { kind: 'invite'; userIds: string[]; invite: Invite }
  | { kind: 'ended'; userIds: string[]; jamId: string }
  | { kind: 'chat'; userIds: string[]; message: JamChatEntry }

export interface PersistedJamRow {
  id: string
  ownerId: string
  allowGuestControl: boolean
  playback: JamPlayback
  queue: JamTrackRef[]
  chat: JamChatEntry[]
  chatCounter: number
  lastActivity: number
  members: { userId: string; joinedAt: number }[]
}

/** Optional write-through store so jams survive restarts/deploys. */
export interface JamPersistence {
  loadAll(): Promise<PersistedJamRow[]>
  save(row: PersistedJamRow): void
  remove(jamId: string): void
}

const PERSIST_DEBOUNCE_MS = 1_200
/** after a restart, give the restored owner this long to reconnect before the crown moves */
const RESTORE_OWNER_CHECK_MS = 90 * 1000

export class JamService {
  private jams = new Map<string, Jam>()
  private memberIndex = new Map<string, string>() // userId → jamId
  private invites = new Map<string, Invite>()
  private sweeper: NodeJS.Timeout
  private persistTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    private emit: (event: JamEvent) => void,
    private isOnline: (userId: string) => boolean = () => true,
    private persistence: JamPersistence | null = null
  ) {
    this.sweeper = setInterval(() => this.sweep(), 60_000)
    this.sweeper.unref()
  }

  /** Rebuilds in-memory jams from the store after a restart; clients resync on reconnect. */
  async restore(): Promise<number> {
    if (!this.persistence) return 0
    const rows = await this.persistence.loadAll()
    for (const row of rows) {
      if (row.members.length === 0) {
        this.persistence.remove(row.id)
        continue
      }
      const jam: Jam = {
        id: row.id,
        ownerId: row.ownerId,
        allowGuestControl: row.allowGuestControl,
        members: new Map(row.members.map((member) => [member.userId, member.joinedAt])),
        queue: row.queue,
        // freeze the position at the moment we went down — the controller re-emits on reconnect
        playback: { ...row.playback, at: Date.now() },
        chat: row.chat,
        chatCounter: row.chatCounter,
        lastActivity: Date.now(),
        ownerOfflineTimer: null
      }
      this.jams.set(jam.id, jam)
      for (const memberId of jam.members.keys()) this.memberIndex.set(memberId, jam.id)
    }
    if (rows.length > 0) {
      const timer = setTimeout(() => {
        for (const jam of this.jams.values()) {
          if (!this.isOnline(jam.ownerId)) this.memberOffline(jam.ownerId)
        }
      }, RESTORE_OWNER_CHECK_MS)
      timer.unref?.()
    }
    return this.jams.size
  }

  private schedulePersist(jam: Jam): void {
    if (!this.persistence) return
    if (this.persistTimers.has(jam.id)) return
    this.persistTimers.set(
      jam.id,
      setTimeout(() => {
        this.persistTimers.delete(jam.id)
        if (!this.jams.has(jam.id) || !this.persistence) return
        this.persistence.save({
          id: jam.id,
          ownerId: jam.ownerId,
          allowGuestControl: jam.allowGuestControl,
          playback: jam.playback,
          queue: jam.queue,
          chat: jam.chat,
          chatCounter: jam.chatCounter,
          lastActivity: jam.lastActivity,
          members: [...jam.members.entries()].map(([userId, joinedAt]) => ({ userId, joinedAt }))
        })
      }, PERSIST_DEBOUNCE_MS)
    )
  }

  jamOf(userId: string): Jam | null {
    const jamId = this.memberIndex.get(userId)
    return jamId ? (this.jams.get(jamId) ?? null) : null
  }

  invitesFor(userId: string): Invite[] {
    return [...this.invites.values()].filter((invite) => invite.toId === userId)
  }

  toDto(jam: Jam, resolveUser: (id: string) => SocialUser | null): JamDto {
    // oldest first so clients can show seniority naturally
    const ordered = [...jam.members.entries()].sort((a, b) => a[1] - b[1])
    return {
      id: jam.id,
      ownerId: jam.ownerId,
      allowGuestControl: jam.allowGuestControl,
      members: ordered.map(([id]) => {
        const user = resolveUser(id) ?? { id, name: 'Unknown', publicId: 0, avatar: null }
        return { ...user, owner: id === jam.ownerId }
      }),
      queue: jam.queue,
      playback: jam.playback,
      chat: jam.chat.slice(-CHAT_DTO)
    }
  }

  inviteToDto(invite: Invite, resolveUser: (id: string) => SocialUser | null): JamInviteDto {
    return {
      id: invite.id,
      jamId: invite.jamId,
      from: resolveUser(invite.fromId) ?? { id: invite.fromId, name: 'Unknown', publicId: 0, avatar: null },
      createdAt: new Date(invite.createdAt).toISOString()
    }
  }

  create(userId: string): Jam {
    this.leave(userId)
    const jam: Jam = {
      id: randomUUID(),
      ownerId: userId,
      allowGuestControl: false,
      members: new Map([[userId, Date.now()]]),
      queue: [],
      playback: { track: null, playing: false, position: 0, at: Date.now() },
      chat: [],
      chatCounter: 0,
      lastActivity: Date.now(),
      ownerOfflineTimer: null
    }
    this.jams.set(jam.id, jam)
    this.memberIndex.set(userId, jam.id)
    this.schedulePersist(jam)
    this.emit({ kind: 'sync', userIds: [userId] })
    return jam
  }

  invite(fromId: string, toId: string): { ok: true } | { ok: false; error: string } {
    const jam = this.jamOf(fromId)
    if (!jam) return { ok: false, error: 'not_in_jam' }
    if (jam.members.has(toId)) return { ok: false, error: 'already_member' }
    if (jam.members.size >= JAM_MAX_MEMBERS) return { ok: false, error: 'jam_full' }
    const existing = [...this.invites.values()].find(
      (invite) => invite.jamId === jam.id && invite.toId === toId
    )
    if (existing) return { ok: false, error: 'already_invited' }
    const invite: Invite = {
      id: randomUUID(),
      jamId: jam.id,
      fromId,
      toId,
      createdAt: Date.now()
    }
    this.invites.set(invite.id, invite)
    jam.lastActivity = Date.now()
    this.emit({ kind: 'invite', userIds: [toId], invite })
    return { ok: true }
  }

  acceptInvite(userId: string, inviteId: string): { ok: true; jam: Jam } | { ok: false; error: string } {
    const invite = this.invites.get(inviteId)
    if (!invite || invite.toId !== userId) return { ok: false, error: 'invite_not_found' }
    this.invites.delete(inviteId)
    const jam = this.jams.get(invite.jamId)
    if (!jam) return { ok: false, error: 'jam_gone' }
    if (jam.members.size >= JAM_MAX_MEMBERS) return { ok: false, error: 'jam_full' }
    this.leave(userId)
    jam.members.set(userId, Date.now())
    this.memberIndex.set(userId, jam.id)
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    this.emit({ kind: 'sync', userIds: [...jam.members.keys()] })
    return { ok: true, jam }
  }

  declineInvite(userId: string, inviteId: string): void {
    const invite = this.invites.get(inviteId)
    if (!invite || invite.toId !== userId) return
    this.invites.delete(inviteId)
    this.emit({ kind: 'sync', userIds: [userId, invite.fromId] })
  }

  /** Member walks out. Owner leaving hands the jam to the oldest member (or ends it alone). */
  leave(userId: string): void {
    const jam = this.jamOf(userId)
    if (!jam) return
    if (jam.ownerId === userId) {
      if (jam.members.size <= 1) {
        this.end(jam.id)
        return
      }
      jam.members.delete(userId)
      this.memberIndex.delete(userId)
      this.transferOwnership(jam)
      return
    }
    jam.members.delete(userId)
    this.memberIndex.delete(userId)
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    this.emit({ kind: 'sync', userIds: [userId, ...jam.members.keys()] })
  }

  end(jamId: string): void {
    const jam = this.jams.get(jamId)
    if (!jam) return
    if (jam.ownerOfflineTimer) clearTimeout(jam.ownerOfflineTimer)
    const pending = this.persistTimers.get(jamId)
    if (pending) {
      clearTimeout(pending)
      this.persistTimers.delete(jamId)
    }
    this.persistence?.remove(jamId)
    const memberIds = [...jam.members.keys()]
    this.jams.delete(jamId)
    for (const id of memberIds) this.memberIndex.delete(id)
    for (const [id, invite] of this.invites) if (invite.jamId === jamId) this.invites.delete(id)
    this.emit({ kind: 'ended', userIds: memberIds, jamId })
  }

  /** Owner throws a member out. The target sees the jam as ended on their side. */
  kick(ownerId: string, targetId: string): { ok: true } | { ok: false; error: string } {
    const jam = this.jamOf(ownerId)
    if (!jam) return { ok: false, error: 'not_in_jam' }
    if (jam.ownerId !== ownerId) return { ok: false, error: 'owner_only' }
    if (ownerId === targetId || !jam.members.has(targetId)) return { ok: false, error: 'not_member' }
    jam.members.delete(targetId)
    this.memberIndex.delete(targetId)
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    this.emit({ kind: 'ended', userIds: [targetId], jamId: jam.id })
    this.emit({ kind: 'sync', userIds: [targetId, ...jam.members.keys()] })
    return { ok: true }
  }

  /** Owner voluntarily hands the crown to another member. */
  transferTo(ownerId: string, targetId: string): { ok: true } | { ok: false; error: string } {
    const jam = this.jamOf(ownerId)
    if (!jam) return { ok: false, error: 'not_in_jam' }
    if (jam.ownerId !== ownerId) return { ok: false, error: 'owner_only' }
    if (ownerId === targetId || !jam.members.has(targetId)) return { ok: false, error: 'not_member' }
    jam.ownerId = targetId
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    this.emit({ kind: 'sync', userIds: [...jam.members.keys()] })
    return { ok: true }
  }

  setGuestControl(userId: string, allow: boolean): boolean {
    const jam = this.jamOf(userId)
    if (!jam || jam.ownerId !== userId) return false
    jam.allowGuestControl = allow
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    this.emit({ kind: 'sync', userIds: [...jam.members.keys()] })
    return true
  }

  canControl(jam: Jam, userId: string): boolean {
    return jam.ownerId === userId || jam.allowGuestControl
  }

  updatePlayback(
    userId: string,
    payload: { track: JamTrackRef | null; playing: boolean; position: number }
  ): void {
    const jam = this.jamOf(userId)
    if (!jam || !this.canControl(jam, userId)) return
    jam.playback = {
      track: payload.track,
      playing: payload.playing,
      position: Math.max(0, Math.min(payload.position, 86_400)),
      at: Date.now()
    }
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    const others = [...jam.members.keys()].filter((id) => id !== userId)
    if (others.length > 0) this.emit({ kind: 'playback', userIds: others, playback: jam.playback })
  }

  updateQueue(userId: string, queue: JamTrackRef[]): void {
    const jam = this.jamOf(userId)
    if (!jam || !this.canControl(jam, userId)) return
    jam.queue = queue.slice(0, QUEUE_LIMIT)
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    const others = [...jam.members.keys()].filter((id) => id !== userId)
    if (others.length > 0) this.emit({ kind: 'queue', userIds: others, queue: jam.queue })
  }

  /** Group chat: any member can talk; broadcast to everyone (sender included, for ordering). */
  addChat(userId: string, userName: string, text: string): boolean {
    const jam = this.jamOf(userId)
    if (!jam) return false
    const message: JamChatEntry = {
      id: ++jam.chatCounter,
      fromId: userId,
      fromName: userName,
      text,
      at: Date.now()
    }
    jam.chat = [...jam.chat, message].slice(-CHAT_KEEP)
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    this.emit({ kind: 'chat', userIds: [...jam.members.keys()], message })
    return true
  }

  heartbeat(userId: string): void {
    const jam = this.jamOf(userId)
    if (jam) {
      jam.lastActivity = Date.now()
      this.schedulePersist(jam)
    }
  }

  /** Owner went offline (app closed / connection lost): after a grace period the
   *  crown moves to the oldest member still online, so the jam survives. */
  memberOffline(userId: string): void {
    const jam = this.jamOf(userId)
    if (!jam || jam.ownerId !== userId || jam.ownerOfflineTimer) return
    jam.ownerOfflineTimer = setTimeout(() => {
      jam.ownerOfflineTimer = null
      if (!this.jams.has(jam.id) || jam.ownerId !== userId) return
      if (this.isOnline(userId)) return // came back in time
      jam.members.delete(userId)
      this.memberIndex.delete(userId)
      if (jam.members.size === 0) {
        this.end(jam.id)
        return
      }
      this.transferOwnership(jam, userId)
    }, OWNER_OFFLINE_GRACE_MS)
    jam.ownerOfflineTimer.unref?.()
  }

  /** Owner reconnected before the grace ran out. */
  memberOnline(userId: string): void {
    const jam = this.jamOf(userId)
    if (jam && jam.ownerId === userId && jam.ownerOfflineTimer) {
      clearTimeout(jam.ownerOfflineTimer)
      jam.ownerOfflineTimer = null
    }
  }

  /** Oldest online member first; falls back to oldest member overall. */
  private transferOwnership(jam: Jam, previousOwner?: string): void {
    const ordered = [...jam.members.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)
    const next = ordered.find((id) => this.isOnline(id)) ?? ordered[0]
    if (!next) {
      this.end(jam.id)
      return
    }
    jam.ownerId = next
    jam.lastActivity = Date.now()
    this.schedulePersist(jam)
    const notify = previousOwner ? [previousOwner, ...jam.members.keys()] : [...jam.members.keys()]
    this.emit({ kind: 'sync', userIds: notify })
  }

  /** Removes a deleted account from any jam and drops its invites. */
  forgetUser(userId: string): void {
    this.leave(userId)
    for (const [id, invite] of this.invites)
      if (invite.toId === userId || invite.fromId === userId) this.invites.delete(id)
  }

  private sweep(): void {
    const now = Date.now()
    for (const [id, invite] of this.invites) {
      if (now - invite.createdAt > INVITE_TTL_MS) {
        this.invites.delete(id)
        this.emit({ kind: 'sync', userIds: [invite.toId, invite.fromId] })
      }
    }
    for (const jam of [...this.jams.values()]) {
      const idle = now - jam.lastActivity > IDLE_TTL_MS
      if (jam.members.size === 0 || idle) this.end(jam.id)
    }
  }
}
