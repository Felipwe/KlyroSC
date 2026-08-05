const AUTH_HOST_SUFFIXES = [
  'soundcloud.com',
  'google.com',
  'googleusercontent.com',
  'gstatic.com',
  'facebook.com',
  'fbcdn.net',
  'apple.com',
  'icloud.com'
] as const

const matchesHost = (hostname: string, suffix: string): boolean =>
  hostname === suffix || hostname.endsWith(`.${suffix}`)

/** Allows only the providers offered by SoundCloud's sign-in screen. */
export function isTrustedAuthPopupUrl(raw: string): boolean {
  if (raw === 'about:blank') return true
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    const hostname = url.hostname.toLowerCase()
    return AUTH_HOST_SUFFIXES.some((suffix) => matchesHost(hostname, suffix))
  } catch {
    return false
  }
}
