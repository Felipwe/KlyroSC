/** Wire types mirrored from the KlyroSC client (src/shared/types/social.ts). */

export interface SocialUser {
  id: string
  name: string
  publicId: number
  /** small data-url picture, or null for the generated initials avatar */
  avatar: string | null
}

/** data:image/(jpeg|png|webp);base64 payload, small enough for state snapshots */
export function isValidAvatar(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 90_000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  )
}

export interface ListeningInfo {
  trackId: number
  title: string
  artist: string
  artwork: string | null
  playing: boolean
}

export type PresenceStatus = 'online' | 'away' | 'dnd'

export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return value === 'online' || value === 'away' || value === 'dnd'
}

export interface FriendPresence {
  online: boolean
  status: PresenceStatus
  listening: ListeningInfo | null
}

/** Small self-reported listening stats shown on profiles. */
export interface UserStats {
  listeningMs: number
  topTrack: { title: string; artist: string; artwork: string | null; plays: number } | null
}

export function isUserStats(value: unknown): value is UserStats {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.listeningMs !== 'number' || !Number.isFinite(v.listeningMs) || v.listeningMs < 0) return false
  if (v.topTrack === null) return true
  if (typeof v.topTrack !== 'object' || v.topTrack === null) return false
  const track = v.topTrack as Record<string, unknown>
  return (
    typeof track.title === 'string' &&
    track.title.length > 0 &&
    track.title.length <= 400 &&
    typeof track.artist === 'string' &&
    track.artist.length <= 400 &&
    (track.artwork === null || (typeof track.artwork === 'string' && track.artwork.length <= 1000)) &&
    typeof track.plays === 'number' &&
    Number.isInteger(track.plays) &&
    track.plays >= 0 &&
    track.plays <= 1_000_000
  )
}

export interface JamTrackRef {
  trackId: number
  title: string
  artist: string
  artwork: string | null
  duration: number
  /** who queued this track in the jam (client-attributed, validated for size) */
  addedById?: string | null
  addedByName?: string | null
}

export interface JamChatEntry {
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
  /** server epoch ms of when position was measured */
  at: number
}

export interface JamMemberDto extends SocialUser {
  owner: boolean
}

export interface JamDto {
  id: string
  ownerId: string
  allowGuestControl: boolean
  members: JamMemberDto[]
  queue: JamTrackRef[]
  playback: JamPlayback
  chat: JamChatEntry[]
}

export interface JamInviteDto {
  id: string
  jamId: string
  from: SocialUser
  createdAt: string
}

export function isListeningInfo(value: unknown): value is ListeningInfo {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.trackId === 'number' &&
    Number.isFinite(v.trackId) &&
    typeof v.title === 'string' &&
    v.title.length <= 400 &&
    typeof v.artist === 'string' &&
    v.artist.length <= 400 &&
    (v.artwork === null || (typeof v.artwork === 'string' && v.artwork.length <= 1000)) &&
    typeof v.playing === 'boolean'
  )
}

export function isJamTrackRef(value: unknown): value is JamTrackRef {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const addedByOk =
    (v.addedById === undefined || v.addedById === null || (typeof v.addedById === 'string' && v.addedById.length <= 40)) &&
    (v.addedByName === undefined ||
      v.addedByName === null ||
      (typeof v.addedByName === 'string' && v.addedByName.length <= 50))
  return (
    addedByOk &&
    typeof v.trackId === 'number' &&
    Number.isFinite(v.trackId) &&
    v.trackId > 0 &&
    typeof v.title === 'string' &&
    v.title.length > 0 &&
    v.title.length <= 400 &&
    typeof v.artist === 'string' &&
    v.artist.length <= 400 &&
    (v.artwork === null || (typeof v.artwork === 'string' && v.artwork.length <= 1000)) &&
    typeof v.duration === 'number' &&
    Number.isFinite(v.duration) &&
    v.duration >= 0 &&
    v.duration <= 86_400
  )
}
