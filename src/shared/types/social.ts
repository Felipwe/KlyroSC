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

export interface FriendPresence {
  online: boolean
  listening: ListeningInfo | null
}

export interface Friend extends SocialUser {
  since: string
  presence: FriendPresence
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
  friends: Friend[]
  requests: FriendRequest[]
  invites: JamInvite[]
  jam: JamState | null
}

export interface NewSocialAccount {
  user: SocialUser
  accountNumber: string
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
  friends: [],
  requests: [],
  invites: [],
  jam: null
}

export const JAM_MAX_MEMBERS = 8
