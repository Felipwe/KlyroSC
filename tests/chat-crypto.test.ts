import { describe, expect, it } from 'vitest'
import {
  decryptChatMessage,
  deriveChatKey,
  encryptChatMessage,
  generateChatKeyPair,
  isValidPublicKey
} from '../src/shared/utils/chat-crypto'

describe('chat crypto (X25519 + HKDF + AES-GCM)', () => {
  it('generates valid keypairs', async () => {
    const pair = await generateChatKeyPair()
    expect(isValidPublicKey(pair.publicKey)).toBe(true)
    expect(pair.privateKey.length).toBeGreaterThan(40)
    const pair2 = await generateChatKeyPair()
    expect(pair2.publicKey).not.toBe(pair.publicKey)
  })

  it('both sides derive the same key and can roundtrip messages', async () => {
    const alice = await generateChatKeyPair()
    const bob = await generateChatKeyPair()
    const aliceKey = await deriveChatKey(alice.privateKey, alice.publicKey, bob.publicKey)
    const bobKey = await deriveChatKey(bob.privateKey, bob.publicKey, alice.publicKey)

    const message = 'olá! 🎵 mensagem secreta com acentos e emoji'
    const encrypted = await encryptChatMessage(aliceKey, message)
    expect(encrypted.iv.length).toBeGreaterThan(10)
    expect(encrypted.ct).not.toContain(message)

    const decrypted = await decryptChatMessage(bobKey, encrypted.iv, encrypted.ct)
    expect(decrypted).toBe(message)
  })

  it('unique IVs per message', async () => {
    const alice = await generateChatKeyPair()
    const bob = await generateChatKeyPair()
    const key = await deriveChatKey(alice.privateKey, alice.publicKey, bob.publicKey)
    const a = await encryptChatMessage(key, 'same text')
    const b = await encryptChatMessage(key, 'same text')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
  })

  it('tampered ciphertext fails authentication', async () => {
    const alice = await generateChatKeyPair()
    const bob = await generateChatKeyPair()
    const key = await deriveChatKey(alice.privateKey, alice.publicKey, bob.publicKey)
    const { iv, ct } = await encryptChatMessage(key, 'authentic')
    const tampered = ct.slice(0, -4) + (ct.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(await decryptChatMessage(key, iv, tampered)).toBeNull()
  })

  it('a third party cannot decrypt', async () => {
    const alice = await generateChatKeyPair()
    const bob = await generateChatKeyPair()
    const eve = await generateChatKeyPair()
    const pairKey = await deriveChatKey(alice.privateKey, alice.publicKey, bob.publicKey)
    const eveKey = await deriveChatKey(eve.privateKey, eve.publicKey, alice.publicKey)
    const { iv, ct } = await encryptChatMessage(pairKey, 'not for eve')
    expect(await decryptChatMessage(eveKey, iv, ct)).toBeNull()
  })

  it('rejects malformed public keys', () => {
    expect(isValidPublicKey('short')).toBe(false)
    expect(isValidPublicKey(123)).toBe(false)
    expect(isValidPublicKey('!'.repeat(44))).toBe(false)
    expect(isValidPublicKey(btoa(String.fromCharCode(...new Uint8Array(16))))).toBe(false)
  })
})
