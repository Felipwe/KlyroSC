const API = 'https://ws.audioscrobbler.com/2.0/'

let ctx = null
let session = null
let authPolling = null
let current = null
let playedSeconds = 0
let lastProgress = 0
let scrobbled = false

function sig(params, secret) {
  const keys = Object.keys(params).sort()
  let base = ''
  for (const key of keys) base += key + params[key]
  return ctx.md5(base + secret)
}

async function call(method, params, config, signed) {
  const all = { method, api_key: config.apiKey, ...params }
  if (signed) all.api_sig = sig(all, config.apiSecret)
  all.format = 'json'
  const body = new URLSearchParams(all).toString()
  const res = await ctx.fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const data = await res.json()
  if (data.error) throw new Error('last.fm error ' + data.error + ': ' + (data.message || ''))
  return data
}

function loadSession() {
  const stored = ctx.storage.get()
  if (stored && stored.sessionKey) session = stored
}

async function connect(config) {
  if (!config.apiKey || !config.apiSecret) {
    ctx.toast('Last.fm: fill in the API key and shared secret first')
    ctx.updateConfig({ connect: false })
    return
  }
  const tokenRes = await call('auth.getToken', {}, config, true)
  const token = tokenRes.token
  ctx.openExternal('https://www.last.fm/api/auth/?api_key=' + config.apiKey + '&token=' + token)
  ctx.toast('Last.fm: authorize KlyroSC in your browser')
  let attempts = 0
  authPolling = ctx.setInterval(async () => {
    attempts++
    if (attempts > 24) {
      ctx.clearInterval(authPolling)
      authPolling = null
      ctx.updateConfig({ connect: false })
      return
    }
    try {
      const res = await call('auth.getSession', { token }, config, true)
      ctx.clearInterval(authPolling)
      authPolling = null
      session = { sessionKey: res.session.key, username: res.session.name }
      ctx.storage.set(session)
      ctx.toast('Last.fm: connected as ' + res.session.name)
    } catch (error) {
      /* keep polling until authorized */
    }
  }, 5000)
}

async function nowPlaying(track, config) {
  if (!session) return
  await call(
    'track.updateNowPlaying',
    { artist: track.artist, track: track.title, duration: String(track.duration || 0), sk: session.sessionKey },
    config,
    true
  )
}

async function scrobble(track, config) {
  if (!session || scrobbled) return
  scrobbled = true
  await call(
    'track.scrobble',
    {
      artist: track.artist,
      track: track.title,
      timestamp: String(Math.floor(Date.now() / 1000) - Math.floor(playedSeconds)),
      duration: String(track.duration || 0),
      sk: session.sessionKey
    },
    config,
    true
  )
  ctx.log('scrobbled: ' + track.artist + ' - ' + track.title)
}

function shouldScrobble(track) {
  if (!track || track.duration < 30) return false
  return playedSeconds >= Math.min(240, track.duration / 2)
}

module.exports = {
  activate(klyro) {
    ctx = klyro
    loadSession()
    const config = klyro.getConfig()
    if (config.connect && !session) connect(config).catch((e) => klyro.log('connect failed: ' + e.message))

    klyro.onConfigChange((next) => {
      if (next.connect && !session) connect(next).catch((e) => klyro.log('connect failed: ' + e.message))
      if (!next.connect && authPolling) {
        klyro.clearInterval(authPolling)
        authPolling = null
      }
    })

    klyro.player.onTrack((track) => {
      const cfg = klyro.getConfig()
      if (current && shouldScrobble(current)) scrobble(current, cfg).catch((e) => klyro.log(e.message))
      current = track
      playedSeconds = 0
      lastProgress = 0
      scrobbled = false
      if (track && session) nowPlaying(track, cfg).catch((e) => klyro.log(e.message))
    })

    klyro.player.onProgress((position) => {
      if (!current) return
      const delta = position - lastProgress
      if (delta > 0 && delta < 30) playedSeconds += delta
      lastProgress = position
      if (shouldScrobble(current)) scrobble(current, klyro.getConfig()).catch((e) => klyro.log(e.message))
    })
  },
  deactivate() {
    if (authPolling && ctx) ctx.clearInterval(authPolling)
    authPolling = null
    current = null
  }
}
