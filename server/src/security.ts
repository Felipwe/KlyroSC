import { createHash, randomBytes, randomInt } from 'node:crypto'

/** 16 random digits, Mullvad style. The number is the credential — never stored in plain text. */
export function generateAccountNumber(): string {
  let digits = ''
  for (let i = 0; i < 16; i++) digits += String(randomInt(10))
  return digits
}

export function isAccountNumber(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{16}$/.test(value)
}

/** Opaque bearer token handed to the client after login. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
