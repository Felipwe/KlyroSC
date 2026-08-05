import { randomUUID } from 'node:crypto'
import {
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
  members: Set<string>
  queue: JamTrackRef[]
  playback: JamPlayback
  lastActivity: number
}

export type JamEvent =
  | { kind: 'sync'; userIds: string[] }
  | { kind: 'playback'; userIds: string[]; playback: JamPlayback }
  | { kind: 'queue'; userIds: string[]; queue: JamTrackRef[] }
  | { kind: 'invite'; userIds: string[]; invite: Invite }
  | { kind: 'ended'; userIds: string[]; jamId: string }

export class JamService {
  private jams = new Map<string, Jam>()
  private memberIndex = new Map<string, string>() // userId → jamId
  private invites = new Map<string, Invite>()
  private sweeper: NodeJS.Timeout

  constructor(private emit: (event: JamEvent) => void) {
    this.sweeper = setInterval(() => this.sweep(), 60_000)
    this.sweeper.unref()
  }

  jamOf(userId: string): Jam | null {
    const jamId = this.memberIndex.get(userId)
    return jamId ? (this.jams.get(jamId) ?? null) : null
  }

  invitesFor(userId: string): Invite[] {
    return [...this.invites.values()].filter((invite) => invite.toId === userId)
  }

  toDto(jam: Jam, resolveUser: (id: string) => SocialUser | null): JamDto {
    return {
      id: jam.id,
      ownerId: jam.ownerId,
      allowGuestControl: jam.allowGuestControl,
      members: [...jam.members].map((id) => {
        const user = resolveUser(id) ?? { id, name: 'Unknown', publicId: 0, avatar: null }
        return { ...user, owner: id === jam.ownerId }
      }),
      queue: jam.queue,
      playback: jam.playback
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
      members: new Set([userId]),
      queue: [],
      playback: { track: null, playing: false, position: 0, at: Date.now() },
      lastActivity: Date.now()
    }
    this.jams.set(jam.id, jam)
    this.memberIndex.set(userId, jam.id)
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
    jam.members.add(userId)
    this.memberIndex.set(userId, jam.id)
    jam.lastActivity = Date.now()
    this.emit({ kind: 'sync', userIds: [...jam.members] })
    return { ok: true, jam }
  }

  declineInvite(userId: string, inviteId: string): void {
    const invite = this.invites.get(inviteId)
    if (!invite || invite.toId !== userId) return
    this.invites.delete(inviteId)
    this.emit({ kind: 'sync', userIds: [userId, invite.fromId] })
  }

  /** Member walks out. Owner leaving ends the jam for everyone. */
  leave(userId: string): void {
    const jam = this.jamOf(userId)
    if (!jam) return
    if (jam.ownerId === userId) {
      this.end(jam.id)
      return
    }
    jam.members.delete(userId)
    this.memberIndex.delete(userId)
    jam.lastActivity = Date.now()
    this.emit({ kind: 'sync', userIds: [userId, ...jam.members] })
  }

  end(jamId: string): void {
    const jam = this.jams.get(jamId)
    if (!jam) return
    const memberIds = [...jam.members]
    this.jams.delete(jamId)
    for (const id of memberIds) this.memberIndex.delete(id)
    for (const [id, invite] of this.invites) if (invite.jamId === jamId) this.invites.delete(id)
    this.emit({ kind: 'ended', userIds: memberIds, jamId })
  }

  setGuestControl(userId: string, allow: boolean): boolean {
    const jam = this.jamOf(userId)
    if (!jam || jam.ownerId !== userId) return false
    jam.allowGuestControl = allow
    jam.lastActivity = Date.now()
    this.emit({ kind: 'sync', userIds: [...jam.members] })
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
    const others = [...jam.members].filter((id) => id !== userId)
    if (others.length > 0) this.emit({ kind: 'playback', userIds: others, playback: jam.playback })
  }

  updateQueue(userId: string, queue: JamTrackRef[]): void {
    const jam = this.jamOf(userId)
    if (!jam || !this.canControl(jam, userId)) return
    jam.queue = queue.slice(0, QUEUE_LIMIT)
    jam.lastActivity = Date.now()
    const others = [...jam.members].filter((id) => id !== userId)
    if (others.length > 0) this.emit({ kind: 'queue', userIds: others, queue: jam.queue })
  }

  heartbeat(userId: string): void {
    const jam = this.jamOf(userId)
    if (jam) jam.lastActivity = Date.now()
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
