import { session } from 'electron'
import { logger } from './logger'

const log = logger.scope('adblock')

const BLOCKED_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adswizz.com',
  'audio.thisisdax.com',
  'scorecardresearch.com',
  'moatads.com',
  'adsafeprotected.com',
  'amazon-adsystem.com',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'quantserve.com',
  'quantcount.com',
  'branch.io',
  'appsflyer.com',
  'adjust.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'mouseflow.com',
  'bugsnag.com',
  'comscore.com',
  'chartbeat.com',
  'permutive.com',
  'liveramp.com',
  'id5-sync.com',
  'adnxs.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'smartadserver.com',
  'teads.tv',
  'ads-twitter.com',
  'analytics.tiktok.com'
]

let enabled = true
let blockedCount = 0

const isBlockedHost = (hostname: string): boolean => {
  for (const blocked of BLOCKED_HOSTS) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) return true
  }
  return false
}

export function setAdBlockEnabled(value: boolean): void {
  enabled = value
  log.info(`ad blocker ${value ? 'enabled' : 'disabled'}`)
}

export function initAdBlock(initialEnabled: boolean): void {
  enabled = initialEnabled
  // never touch the sc-auth login partition: blocking page scripts there trips
  // SoundCloud's DataDome ("JavaScript disabled") and breaks sign-in
  const sessions = [session.defaultSession]
  for (const ses of sessions) {
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (!enabled) {
        callback({})
        return
      }
      try {
        const { hostname } = new URL(details.url)
        if (isBlockedHost(hostname)) {
          blockedCount++
          if (blockedCount % 25 === 1) log.info(`blocked ${blockedCount} ad/tracker requests so far`)
          callback({ cancel: true })
          return
        }
      } catch {
        /* non-standard url */
      }
      callback({})
    })
  }
  log.info(`ad blocker initialized (${initialEnabled ? 'on' : 'off'}, ${BLOCKED_HOSTS.length} host rules)`)
}
