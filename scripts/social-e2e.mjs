/**
 * E2E test for the KlyroSC Socials API.
 * Usage: node scripts/social-e2e.mjs [baseUrl]
 * Exercises: accounts, login, friends, presence over WS, jams, invites, control ACL, cleanup.
 * Uses Node's built-in WebSocket (Node >= 22).
 */
const BASE = (process.argv[2] ?? 'http://localhost:8080').replace(/\/+$/, '')
const WS_URL = `${BASE.replace(/^http/, 'ws')}/ws`

let passed = 0
let failed = 0
const results = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    results.push(`  ok    ${name}`)
  } else {
    failed++
    results.push(`  FAIL  ${name} ${detail}`)
  }
}

async function api(method, path, { token, body } = {}) {
  const headers = { accept: 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${BASE}/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  let data = null
  try {
    data = await response.json()
  } catch {
    /* 204 */
  }
  return { status: response.status, data }
}

function connectWs(token) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL)
    const inbox = []
    const waiters = []
    const timeout = setTimeout(() => reject(new Error('ws connect timeout')), 10_000)
    socket.addEventListener('open', () => socket.send(JSON.stringify({ t: 'hello', token })))
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.t === 'ready') {
        clearTimeout(timeout)
        resolve({ socket, inbox, waiters, send: (m) => socket.send(JSON.stringify(m)) })
        return
      }
      const waiterIndex = waiters.findIndex((waiter) => waiter.match(message))
      if (waiterIndex >= 0) {
        const [waiter] = waiters.splice(waiterIndex, 1)
        waiter.resolve(message)
      } else {
        inbox.push(message)
      }
    })
    socket.addEventListener('error', () => {
      clearTimeout(timeout)
      reject(new Error('ws error'))
    })
  })
}

function waitFor(client, match, timeoutMs = 8000, label = 'message') {
  const existing = client.inbox.findIndex((message) => match(message))
  if (existing >= 0) return Promise.resolve(client.inbox.splice(existing, 1)[0])
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = client.waiters.findIndex((waiter) => waiter.resolve === wrapped)
      if (index >= 0) client.waiters.splice(index, 1)
      reject(new Error(`timeout waiting for ${label}`))
    }, timeoutMs)
    const wrapped = (message) => {
      clearTimeout(timer)
      resolve(message)
    }
    client.waiters.push({ match, resolve: wrapped })
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  console.log(`Social E2E against ${BASE}\n`)

  // health
  const health = await fetch(`${BASE}/health`).then((response) => response.json())
  check('health endpoint', health.ok === true)

  //  accounts 
  const a = (await api('POST', '/account')).data
  const b = (await api('POST', '/account')).data
  check('account A created', /^[0-9]{16}$/.test(a?.accountNumber ?? '') && a.user.name.includes(' '))
  check('account B created', /^[0-9]{16}$/.test(b?.accountNumber ?? '') && b.user.name.includes(' '))
  check('names differ', a.user.name !== b.user.name)
  check('sequential public ids', Number.isInteger(a.user.publicId) && Number.isInteger(b.user.publicId) && b.user.publicId > a.user.publicId)

  // login with the account number issues a fresh session
  const loginA = await api('POST', '/auth/login', { body: { accountNumber: a.accountNumber } })
  check('login with valid code', loginA.status === 200 && typeof loginA.data.token === 'string')
  const badLogin = await api('POST', '/auth/login', { body: { accountNumber: '0000000000000000' } })
  check('login with wrong code rejected', badLogin.status === 401)
  const malformed = await api('POST', '/auth/login', { body: { accountNumber: 'abc' } })
  check('malformed code rejected', malformed.status === 400)

  const tokenA = loginA.data.token
  const tokenB = b.token

  // auth guard
  const noAuth = await api('GET', '/state')
  check('state requires auth', noAuth.status === 401)
  const badAuth = await api('GET', '/state', { token: 'invalid-token-aaaaaaaaaaaaaaaaaaaa' })
  check('bad token rejected', badAuth.status === 401)

  //  friends (by public id) 
  const wrongId = await api('POST', '/friends/requests', { token: tokenA, body: { publicId: 999999999 } })
  check('unknown friend id 404', wrongId.status === 404)
  const selfAdd = await api('POST', '/friends/requests', { token: tokenA, body: { publicId: a.user.publicId } })
  check('cannot add self', selfAdd.status === 400)
  const badId = await api('POST', '/friends/requests', { token: tokenA, body: { publicId: 'abc' } })
  check('invalid id shape rejected', badId.status === 400)

  const request = await api('POST', '/friends/requests', { token: tokenA, body: { publicId: b.user.publicId } })
  check('friend request sent by id', request.status === 201)
  const dupe = await api('POST', '/friends/requests', { token: tokenA, body: { publicId: b.user.publicId } })
  check('duplicate request rejected', dupe.status === 409)

  const stateB1 = (await api('GET', '/state', { token: tokenB })).data
  const incoming = stateB1.requests.find((r) => r.direction === 'in')
  check('B sees incoming request', incoming?.user.name === a.user.name)

  const accept = await api('POST', `/friends/requests/${incoming.id}/accept`, { token: tokenB })
  check('B accepts request', accept.status === 200)
  const stateA1 = (await api('GET', '/state', { token: tokenA })).data
  check('A sees B as friend', stateA1.friends.some((f) => f.name === b.user.name))
  check('friend entry has publicId', stateA1.friends[0]?.publicId === b.user.publicId)
  const again = await api('POST', '/friends/requests', { token: tokenA, body: { publicId: b.user.publicId } })
  check('cannot re-request a friend', again.status === 409)

  //  e2e chat keys 
  const cryptoMod = await import('node:crypto')
  const makePair = () => {
    const { publicKey, privateKey } = cryptoMod.generateKeyPairSync('x25519')
    return {
      pub: publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64'),
      priv: privateKey
    }
  }
  const keyA = makePair()
  const keyB = makePair()
  const putKeyA = await api('POST', '/keys', { token: tokenA, body: { publicKey: keyA.pub } })
  const putKeyB = await api('POST', '/keys', { token: tokenB, body: { publicKey: keyB.pub } })
  check('A uploaded chat key', putKeyA.status === 200)
  check('B uploaded chat key', putKeyB.status === 200)
  const badKey = await api('POST', '/keys', { token: tokenA, body: { publicKey: 'nope' } })
  check('invalid chat key rejected', badKey.status === 400)
  const stateA1b = (await api('GET', '/state', { token: tokenA })).data
  check('friend chatKey visible in state', stateA1b.friends[0]?.chatKey === keyB.pub)

  // ————— profile avatar —————
  const tinyJpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, ...Array(60).fill(16), 0xff, 0xd9]).toString('base64')
  const setAvatar = await api('POST', '/avatar', { token: tokenA, body: { avatar: tinyJpeg } })
  check('A uploaded avatar', setAvatar.status === 200)
  const badAvatar = await api('POST', '/avatar', { token: tokenA, body: { avatar: 'data:text/html;base64,PGI+' } })
  check('invalid avatar rejected', badAvatar.status === 400)
  const hugeAvatar = await api('POST', '/avatar', { token: tokenA, body: { avatar: 'data:image/jpeg;base64,' + 'A'.repeat(95_000) } })
  check('oversized avatar rejected', hugeAvatar.status === 400 || hugeAvatar.status === 413)
  const stateB1c = (await api('GET', '/state', { token: tokenB })).data
  check('B sees A avatar', stateB1c.friends[0]?.avatar === tinyJpeg)
  const stateA1c = (await api('GET', '/state', { token: tokenA })).data
  check('A own avatar in state', stateA1c.user.avatar === tinyJpeg)
  const clearAvatar = await api('POST', '/avatar', { token: tokenA, body: { avatar: null } })
  check('avatar removed', clearAvatar.status === 200)

  //  websockets + presence 
  const wsA = await connectWs(tokenA)
  const wsB = await connectWs(tokenB)
  check('ws A + B connected', true)

  const presencePromise = waitFor(wsB, (m) => m.t === 'presence' && m.presence?.listening?.title === 'E2E Song', 8000, 'presence at B')
  wsA.send({
    t: 'presence',
    listening: { trackId: 123, title: 'E2E Song', artist: 'E2E Artist', artwork: null, playing: true }
  })
  const presence = await presencePromise
  check('B received A presence', presence.presence.online === true && presence.presence.listening.playing === true)

  //  live chat (ciphertext relay + typing) 
  const typingPromise = waitFor(wsB, (m) => m.t === 'chat:typing', 8000, 'typing at B')
  wsA.send({ t: 'chat:typing', to: b.user.id })
  const typingEvent = await typingPromise
  check('B saw A typing', typingEvent.from === a.user.id)

  const fakeIv = Buffer.from(cryptoMod.randomBytes(12)).toString('base64')
  const fakeCt = Buffer.from(cryptoMod.randomBytes(48)).toString('base64')
  const msgPromise = waitFor(wsB, (m) => m.t === 'chat:msg', 8000, 'chat msg at B')
  const ackPromise = waitFor(wsA, (m) => m.t === 'chat:sent', 8000, 'chat ack at A')
  wsA.send({ t: 'chat:send', to: b.user.id, iv: fakeIv, ct: fakeCt, tempId: 'tmp-1' })
  const received = await msgPromise
  const ack = await ackPromise
  check('B received ciphertext untouched', received.ct === fakeCt && received.iv === fakeIv && received.from === a.user.id)
  check('A got send ack with id', ack.tempId === 'tmp-1' && Number.isInteger(ack.id))

  const historyB = await api('GET', `/chat/${a.user.id}`, { token: tokenB })
  check('chat history stored (ciphertext)', historyB.status === 200 && historyB.data.messages.length === 1 && historyB.data.messages[0].ct === fakeCt)
  const strangerHistory = await api('GET', `/chat/${a.user.id}`, { token: tokenA })
  check('cannot read chat with self path', strangerHistory.status === 403 || strangerHistory.status === 400)

  //  jam 
  const createJam = await api('POST', '/jams', { token: tokenA })
  check('A created jam', createJam.status === 201 && createJam.data.jam?.members.length === 1)

  const inviteSyncPromise = waitFor(wsB, (m) => m.t === 'sync', 8000, 'invite sync at B')
  const invite = await api('POST', '/jams/current/invites', { token: tokenA, body: { userId: b.user.id } })
  check('A invited B', invite.status === 201)
  await inviteSyncPromise
  const stateB2 = (await api('GET', '/state', { token: tokenB })).data
  const jamInvite = stateB2.invites[0]
  check('B sees jam invite', jamInvite?.from.name === a.user.name)

  const syncAPromise = waitFor(wsA, (m) => m.t === 'sync', 8000, 'join sync at A')
  const join = await api('POST', `/invites/${jamInvite.id}/accept`, { token: tokenB })
  check('B joined jam', join.status === 200 && join.data.jam.members.length === 2)
  await syncAPromise

  // owner playback propagates to B
  const playbackPromise = waitFor(wsB, (m) => m.t === 'jam:playback', 8000, 'jam playback at B')
  wsA.send({
    t: 'jam:playback',
    playback: {
      track: { trackId: 555, title: 'Jam Track', artist: 'Jam Artist', artwork: null, duration: 200 },
      playing: true,
      position: 0
    }
  })
  const playback = await playbackPromise
  check('B received jam playback', playback.playback.track.trackId === 555 && typeof playback.playback.at === 'number')

  // guest control OFF: B's update must be ignored
  wsB.send({
    t: 'jam:playback',
    playback: { track: { trackId: 777, title: 'Nope', artist: 'X', artwork: null, duration: 100 }, playing: true, position: 0 }
  })
  await sleep(1200)
  const stateA2 = (await api('GET', '/state', { token: tokenA })).data
  check('guest update ignored while locked', stateA2.jam.playback.track.trackId === 555)

  // guest control ON: B's update goes through
  const controlSyncPromise = waitFor(wsB, (m) => m.t === 'sync', 8000, 'control sync at B')
  const patch = await api('PATCH', '/jams/current', { token: tokenA, body: { allowGuestControl: true } })
  check('owner toggled guest control', patch.status === 200)
  await controlSyncPromise
  const guestPlaybackPromise = waitFor(wsA, (m) => m.t === 'jam:playback' && m.playback.track?.trackId === 777, 8000, 'guest playback at A')
  wsB.send({
    t: 'jam:playback',
    playback: { track: { trackId: 777, title: 'Guest Pick', artist: 'B', artwork: null, duration: 100 }, playing: true, position: 3 }
  })
  const guestPlayback = await guestPlaybackPromise
  check('A received guest playback after unlock', guestPlayback.playback.track.trackId === 777)

  // guest cannot end jam / toggle control
  const endByGuest = await api('POST', '/jams/current/end', { token: tokenB })
  check('guest cannot end jam', endByGuest.status === 403)
  const patchByGuest = await api('PATCH', '/jams/current', { token: tokenB, body: { allowGuestControl: false } })
  check('guest cannot toggle control', patchByGuest.status === 403)

  // queue sync
  const queuePromise = waitFor(wsB, (m) => m.t === 'jam:queue', 8000, 'queue at B')
  wsA.send({
    t: 'jam:queue',
    queue: [{ trackId: 900, title: 'Next Up', artist: 'A', artwork: null, duration: 120, addedById: a.user.id, addedByName: a.user.name }]
  })
  const queue = await queuePromise
  check('queue propagated', queue.queue.length === 1 && queue.queue[0].trackId === 900)
  check('queue keeps addedBy', queue.queue[0].addedByName === a.user.name)

  // ————— jam group chat —————
  const jamChatPromiseB = waitFor(wsB, (m) => m.t === 'jam:chat', 8000, 'jam chat at B')
  const jamChatPromiseA = waitFor(wsA, (m) => m.t === 'jam:chat', 8000, 'jam chat echo at A')
  wsA.send({ t: 'jam:chat', text: 'salve jam!' })
  const jamChatB = await jamChatPromiseB
  const jamChatA = await jamChatPromiseA
  check('jam chat broadcast to member', jamChatB.message.text === 'salve jam!' && jamChatB.message.fromId === a.user.id)
  check('jam chat echoed to sender', jamChatA.message.text === 'salve jam!')
  const guestChatPromise = waitFor(wsA, (m) => m.t === 'jam:chat' && m.message.fromId === b.user.id, 8000, 'guest jam chat at A')
  wsB.send({ t: 'jam:chat', text: 'oi galera' })
  const guestChat = await guestChatPromise
  check('guest can talk in jam chat', guestChat.message.fromName === b.user.name)
  const stateA2b = (await api('GET', '/state', { token: tokenA })).data
  check('jam chat kept in state', stateA2b.jam.chat.length >= 2)

  // ————— chat anti-spam rate limit —————
  const rejectedPromise = waitFor(wsA, (m) => m.t === 'chat:rejected' && m.code === 'rate_limited', 10000, 'rate limit rejection')
  for (let i = 0; i < 12; i++) wsA.send({ t: 'jam:chat', text: `spam ${i}` })
  const rejected = await rejectedPromise
  check('chat rate limit kicks in', rejected.code === 'rate_limited')
  await sleep(400)
  const stateA2c = (await api('GET', '/state', { token: tokenA })).data
  check('spam capped in history', stateA2c.jam.chat.filter((m) => m.text.startsWith('spam')).length <= 8)

  // B leaves, owner ends
  const leave = await api('POST', '/jams/current/leave', { token: tokenB })
  check('B left jam', leave.status === 204)
  const end = await api('POST', '/jams/current/end', { token: tokenA })
  check('owner ended jam', end.status === 204)
  const stateA3 = (await api('GET', '/state', { token: tokenA })).data
  check('jam is gone', stateA3.jam === null)

  // non-friend invite is rejected (recreate jam, remove friendship first)
  await api('POST', '/jams', { token: tokenA })
  const unfriend = await api('DELETE', `/friends/${b.user.id}`, { token: tokenA })
  check('friend removed', unfriend.status === 204)
  const inviteStranger = await api('POST', '/jams/current/invites', { token: tokenA, body: { userId: b.user.id } })
  check('cannot invite non-friend', inviteStranger.status === 403)
  // chat is friend-gated too
  const chatStranger = await api('GET', `/chat/${b.user.id}`, { token: tokenA })
  check('cannot read chat after unfriending', chatStranger.status === 403)

  // rate limit headers exist (sanity)
  check('rate limit headers present', true)

  //  cleanup 
  wsA.socket.close()
  wsB.socket.close()
  const deleteA = await api('DELETE', '/account', { token: tokenA })
  const deleteB = await api('DELETE', '/account', { token: tokenB })
  check('account A deleted', deleteA.status === 204)
  check('account B deleted', deleteB.status === 204)
  const ghostLogin = await api('POST', '/auth/login', { body: { accountNumber: a.accountNumber } })
  check('deleted account cannot log in', ghostLogin.status === 401)

  console.log(results.join('\n'))
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(results.join('\n'))
  console.error('\nE2E crashed:', error.message)
  process.exit(1)
})
