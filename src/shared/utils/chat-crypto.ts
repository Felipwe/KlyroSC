/**
 * End-to-end chat crypto: X25519 (ECDH) + HKDF-SHA256 + AES-256-GCM via WebCrypto.
 * Works in the Electron main process (Node >= 22) and in tests; the server only ever
 * sees public keys and ciphertext.
 */

export interface ChatKeyPair {
  /** raw X25519 public key, base64 (32 bytes) */
  publicKey: string
  /** pkcs8 private key, base64  never leaves the device */
  privateKey: string
}

const subtle = globalThis.crypto.subtle

const toB64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const fromB64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const isValidPublicKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length < 40 || value.length > 60) return false
  try {
    return fromB64(value).length === 32
  } catch {
    return false
  }
}

export async function generateChatKeyPair(): Promise<ChatKeyPair> {
  const pair = (await subtle.generateKey('X25519', true, ['deriveBits'])) as {
    publicKey: CryptoKey
    privateKey: CryptoKey
  }
  const publicRaw = await subtle.exportKey('raw', pair.publicKey)
  const privatePkcs8 = await subtle.exportKey('pkcs8', pair.privateKey)
  return { publicKey: toB64(publicRaw), privateKey: toB64(privatePkcs8) }
}

/**
 * Derives the symmetric AES-256-GCM key for a pair of users.
 * Both sides derive the SAME key: the HKDF salt is the sorted concatenation of
 * both public keys, so direction does not matter.
 */
export async function deriveChatKey(
  myPrivateKeyB64: string,
  myPublicKeyB64: string,
  theirPublicKeyB64: string
): Promise<CryptoKey> {
  const privateKey = await subtle.importKey(
    'pkcs8',
    fromB64(myPrivateKeyB64) as unknown as ArrayBuffer,
    'X25519',
    false,
    ['deriveBits']
  )
  const theirPublic = await subtle.importKey(
    'raw',
    fromB64(theirPublicKeyB64) as unknown as ArrayBuffer,
    'X25519',
    false,
    []
  )
  const sharedBits = await subtle.deriveBits({ name: 'X25519', public: theirPublic }, privateKey, 256)
  const hkdfKey = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  const salt = new TextEncoder().encode([myPublicKeyB64, theirPublicKeyB64].sort().join('|'))
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('klyrosc-chat-v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptChatMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ iv: string; ct: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    encoded as unknown as ArrayBuffer
  )
  return { iv: toB64(iv.buffer), ct: toB64(ciphertext) }
}

/** Returns null when the ciphertext cannot be authenticated/decrypted (tampered or wrong key). */
export async function decryptChatMessage(key: CryptoKey, ivB64: string, ctB64: string): Promise<string | null> {
  try {
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) as unknown as ArrayBuffer },
      key,
      fromB64(ctB64) as unknown as ArrayBuffer
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}
