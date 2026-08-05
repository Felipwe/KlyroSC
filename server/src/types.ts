/** Wire types mirrored from the KlyroSC client (src/shared/types/social.ts). */

export interface SocialUser {
  id: string
  name: string
  publicId: number
}

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
  return (
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
