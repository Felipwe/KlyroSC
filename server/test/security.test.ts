import { describe, expect, it } from 'vitest'
import { ADJECTIVES, ANIMALS, NAME_POOL_SIZE, randomName } from '../src/names.js'
import { generateAccountNumber, generateSessionToken, isAccountNumber, sha256 } from '../src/security.js'

describe('names', () => {
  it('has a large unique pool', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
    expect(new Set(ANIMALS).size).toBe(ANIMALS.length)
    expect(NAME_POOL_SIZE).toBeGreaterThan(40_000)
  })

  it('generates two capitalized words', () => {
    for (let i = 0; i < 200; i++) {
      expect(randomName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    }
  })

  it('words contain only letters (friend-add regex compatibility)', () => {
    for (const word of [...ADJECTIVES, ...ANIMALS]) {
      expect(word).toMatch(/^[A-Za-z]{2,24}$/)
    }
  })
})

describe('security', () => {
  it('account numbers are 16 digits', () => {
    for (let i = 0; i < 100; i++) {
      const number = generateAccountNumber()
      expect(number).toMatch(/^[0-9]{16}$/)
      expect(isAccountNumber(number)).toBe(true)
    }
  })

  it('rejects malformed account numbers', () => {
    expect(isAccountNumber('1234')).toBe(false)
    expect(isAccountNumber('1234 5678 9012 3456')).toBe(false)
    expect(isAccountNumber('abcdefghijklmnop')).toBe(false)
    expect(isAccountNumber(1234567890123456)).toBe(false)
    expect(isAccountNumber(null)).toBe(false)
  })

  it('session tokens are long and url-safe', () => {
    const token = generateSessionToken()
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(generateSessionToken()).not.toBe(token)
  })

  it('sha256 is deterministic hex', () => {
    expect(sha256('abc')).toBe(sha256('abc'))
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256('abc')).not.toBe(sha256('abd'))
  })
})
