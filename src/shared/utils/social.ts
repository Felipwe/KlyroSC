import { type JamPlayback } from '../types/social'

/** Strips everything but digits (users paste "1234 5678 9012 3456" or with dashes). */
export function normalizeAccountNumber(input: string): string {
  return input.replace(/[^0-9]/g, '')
}

export function isValidAccountNumber(input: string): boolean {
  return /^[0-9]{16}$/.test(normalizeAccountNumber(input))
}

/** "1234567890123456" → "1234 5678 9012 3456" */
export function formatAccountNumber(input: string): string {
  const digits = normalizeAccountNumber(input)
  return digits.replace(/(.{4})(?=.)/g, '$1 ').trim()
}

/** Collapses whitespace so "  bold   zebra " matches "Bold Zebra" server-side. */
export function normalizeFriendName(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

/** Parses "#42", "42", " 42 " into the numeric public id, or null when not a valid id. */
export function parsePublicId(input: string): number | null {
  const cleaned = input.trim().replace(/^#/, '').trim()
  if (!/^[0-9]{1,15}$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value >= 1 ? value : null
}

/** Deterministic hue (0-359) for a user's avatar, stable across clients. */
export function avatarHue(name: string): number {
  let hash = 5381
  for (let i = 0; i < name.length; i++) hash = (hash * 33) ^ name.charCodeAt(i)
  return Math.abs(hash) % 360
}

/** "Bold Zebra" → "BZ" */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => (word[0] ?? '').toUpperCase())
    .join('')
}

/** Where jam playback should be right now, extrapolating from the stamped moment. */
export function expectedJamPosition(playback: JamPlayback, now: number): number {
  if (!playback.track) return 0
  const base = Math.max(0, playback.position)
  if (!playback.playing) return Math.min(base, playback.track.duration)
  const elapsed = Math.max(0, (now - playback.at) / 1000)
  return Math.min(base + elapsed, playback.track.duration)
}
