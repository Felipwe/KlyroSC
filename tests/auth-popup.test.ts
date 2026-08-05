import { describe, expect, it } from 'vitest'
import { isTrustedAuthPopupUrl } from '../src/shared/utils/auth-popup'

describe('isTrustedAuthPopupUrl', () => {
  it('allows the blank bootstrap window used by social OAuth', () => {
    expect(isTrustedAuthPopupUrl('about:blank')).toBe(true)
  })

  it('allows SoundCloud and its supported identity providers', () => {
    const allowed = [
      'https://secure.soundcloud.com/connect/google',
      'https://accounts.google.com/o/oauth2/v2/auth',
      'https://static-login.googleusercontent.com/page',
      'https://www.facebook.com/v20.0/dialog/oauth',
      'https://appleid.apple.com/auth/authorize',
      'https://idmsa.apple.com/appleauth/auth'
    ]
    for (const url of allowed) expect(isTrustedAuthPopupUrl(url), url).toBe(true)
  })

  it('blocks untrusted, malformed and insecure popup targets', () => {
    const blocked = [
      '',
      'about:srcdoc',
      'javascript:alert(1)',
      'http://accounts.google.com/o/oauth2/auth',
      'https://google.com.evil.example/login',
      'https://soundcloud.com.evil.example/login',
      'https://example.com/phishing'
    ]
    for (const url of blocked) expect(isTrustedAuthPopupUrl(url), url).toBe(false)
  })
})
