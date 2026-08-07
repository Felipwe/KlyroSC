/** KlyroSC Socials  shared types between main, renderer and (mirrored by) the server. */

export interface SocialUser {
  id: string
  name: string
  /** short sequential account number shown as #42  how friends find you */
  publicId: number  /** small data-url profile picture, or null for the generated initials avatar */
  avatar: string | null}

export interface ListeningInfo {
  trackId: number
  title: string
  artist: string
  artwork: string | null
  playing: boolean
}

/** Discord-style manual presence status. */
export type PresenceStatus = 'online' | 'away' | 'dnd'

export interface FriendPresence {
  online: boolean
  status: PresenceStatus
  listening: ListeningInfo | null
}

/** Self-reported listening stats shown on profiles. */
export interface UserStats {
  listeningMs: number
  topTrack: { title: string; artist: string; artwork: string | null; plays: number } | null
}

/** Wire payload for stats reports — the server adds `listeningDeltaMs` to the account total. */
export interface UserStatsReport extends UserStats {
  listeningDeltaMs: number
}

export interface Friend extends SocialUser {
  since: string
  presence: FriendPresence
  stats: UserStats | null
  /** X25519 public key (base64) for end-to-end chat, when the friend has one */
  chatKey: string | null
}

export interface FriendRequest {
  id: string
  user: SocialUser
  direction: 'in' | 'out'
  createdAt: string
}

export interface JamTrackRef {
  trackId: number
  title: string
  artist: string
  artwork: string | null
  duration: number
  /** who queued this track in the jam */
  addedById?: string | null
  addedByName?: string | null
}

export interface JamChatMessage {
  id: number
  fromId: string
  fromName: string
  text: string
  at: number
}

export interface JamPlayback {
  track: JamTrackRef | null
  playing: boolean
  position: number
  /** epoch ms (already converted to local clock by the main process) of when position was measured */
  at: number
}

export interface JamMember extends SocialUser {
  owner: boolean
}

export interface JamState {
  id: string
  ownerId: string
  allowGuestControl: boolean
  members: JamMember[]
  queue: JamTrackRef[]
  playback: JamPlayback
  chat: JamChatMessage[]
}

export interface JamInvite {
  id: string
  jamId: string
  from: SocialUser
  createdAt: string
}

export interface SocialSnapshot {
  /** logged into a KlyroSC Socials account */
  account: SocialUser | null
  /** live websocket connection established */
  connected: boolean
  /** my own manual presence status */
  myStatus: PresenceStatus
  friends: Friend[]
  requests: FriendRequest[]
  invites: JamInvite[]
  /** friendId → highest message id of MINE that friend has read (seen ticks) */
  reads: Record<string, number>
  jam: JamState | null
}

export interface NewSocialAccount {
  user: SocialUser
  accountNumber: string
}

/** Admin (public id #1) overview of every account. */
export interface AdminUserRow {
  publicId: number
  name: string
  online: boolean
}

export interface AdminUsers {
  active: number
  inactive: number
  users: AdminUserRow[]
}

export interface ChatMessage {
  id: number
  fromMe: boolean
  text: string
  at: number
  pending?: boolean
}

export interface ChatEventPayload {
  friendId: string
  message: ChatMessage
}

export const EMPTY_SOCIAL: SocialSnapshot = {
  account: null,
  connected: false,
  myStatus: 'online',
  friends: [],
  requests: [],
  invites: [],
  reads: {},
  jam: null
}

export const JAM_MAX_MEMBERS = 8
