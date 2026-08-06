import { type IncomingMessage } from 'node:http'
import type { WebSocket, WebSocketServer } from 'ws'
import { areFriends, friendIdsOf, pool } from './db.js'
import { sha256 } from './security.js'
import { type Hub } from './hub.js'
import { type JamService } from './jams.js'
import { isJamTrackRef, isListeningInfo, isPresenceStatus, type SocialUser } from './types.js'

const HELLO_TIMEOUT_MS = 10_000
const PING_INTERVAL_MS = 30_000

interface Services {
  hub: Hub
  jams: JamService
}

async function authenticate(token: unknown): Promise<SocialUser | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null
  const result = await pool.query<{ user_id: string; name: string; public_id: string; avatar: string | null }>(
    `SELECT s.user_id, u.name, u.public_id, u.avatar FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)]
  )
  const row = result.rows[0]
  return row
    ? { id: row.user_id, name: row.name, publicId: Number(row.public_id), avatar: row.avatar }
    : null
}

const UUID_RE = /^[0-9a-f-]{36}$/i
const MAX_CT = 12_000
const MESSAGES_KEPT_PER_PAIR = 500

export function attachWebSocket(wss: WebSocketServer, services: Services): void {
  const { hub, jams } = services

  wss.on('connection', (socket: WebSocket, _req: IncomingMessage) => {
    let user: SocialUser | null = null
    let alive = true

    const helloTimer = setTimeout(() => {
      if (!user) socket.close(4001, 'hello timeout')
    }, HELLO_TIMEOUT_MS)

    socket.on('pong', () => {
      alive = true
    })
    const pinger = setInterval(() => {
      if (!alive) {
        socket.terminate()
        return
      }
      alive = false
      try {
        socket.ping()
      } catch {
        /* closing */
      }
    }, PING_INTERVAL_MS)

    socket.on('message', (raw) => {
      void (async () => {
        let message: Record<string, unknown>
        try {
          const text = typeof raw === 'string' ? raw : raw.toString('utf8')
          if (text.length > 32_000) return
          message = JSON.parse(text) as Record<string, unknown>
        } catch {
          return
        }
        if (typeof message?.t !== 'string') return

        if (!user) {
          if (message.t !== 'hello') {
            socket.close(4001, 'hello required')
            return
          }
          const authed = await authenticate(message.token)
          if (!authed) {
            socket.close(4001, 'unauthorized')
            return
          }
          user = authed
          clearTimeout(helloTimer)
          const friends = await friendIdsOf(user.id)
          hub.connect(user, socket, friends)
          jams.memberOnline(user.id)
          socket.send(JSON.stringify({ t: 'ready', serverNow: Date.now() }))
          return
        }

        if (!hub.allowMessage(user.id)) return

        switch (message.t) {
          case 'ping':
            socket.send(
              JSON.stringify({ t: 'pong', sent: typeof message.sent === 'number' ? message.sent : 0, serverNow: Date.now() })
            )
            break
          case 'presence': {
            if (isPresenceStatus(message.status)) hub.setStatus(user.id, message.status)
            const listening = message.listening
            if (listening === null) hub.setListening(user.id, null)
            else if (isListeningInfo(listening)) hub.setListening(user.id, listening)
            break
          }
          case 'chat:read': {
            const peer = message.peer
            const upTo = message.upTo
            if (typeof peer !== 'string' || !UUID_RE.test(peer)) break
            if (typeof upTo !== 'number' || !Number.isInteger(upTo) || upTo <= 0) break
            if (!(await areFriends(user.id, peer))) break
            await pool.query(
              `INSERT INTO chat_reads(user_id, peer_id, last_read_id, updated_at) VALUES ($1, $2, $3, now())
               ON CONFLICT (user_id, peer_id)
               DO UPDATE SET last_read_id = GREATEST(chat_reads.last_read_id, EXCLUDED.last_read_id), updated_at = now()`,
              [user.id, peer, upTo]
            )
            hub.send(peer, { t: 'chat:read', from: user.id, upTo })
            break
          }
          case 'jam:playback': {
            const payload = message.playback as Record<string, unknown> | undefined
            if (!payload || typeof payload !== 'object') break
            const track = payload.track
            if (track !== null && !isJamTrackRef(track)) break
            if (typeof payload.playing !== 'boolean' || typeof payload.position !== 'number') break
            if (!Number.isFinite(payload.position) || payload.position < 0) break
            jams.updatePlayback(user.id, {
              track: track === null ? null : track,
              playing: payload.playing,
              position: payload.position
            })
            break
          }
          case 'jam:queue': {
            const queue = message.queue
            if (!Array.isArray(queue) || queue.length > 60) break
            const refs = queue.filter(isJamTrackRef)
            if (refs.length !== queue.length) break
            jams.updateQueue(user.id, refs)
            break
          }
          case 'jam:heartbeat':
            jams.heartbeat(user.id)
            break
          case 'chat:send': {
            const to = message.to
            const iv = message.iv
            const ct = message.ct
            const tempId = typeof message.tempId === 'string' ? message.tempId.slice(0, 40) : ''
            if (typeof to !== 'string' || !UUID_RE.test(to)) break
            if (typeof iv !== 'string' || iv.length < 12 || iv.length > 32) break
            if (typeof ct !== 'string' || ct.length < 4 || ct.length > MAX_CT) break
            if (!/^[A-Za-z0-9+/=]+$/.test(iv) || !/^[A-Za-z0-9+/=]+$/.test(ct)) break
            if (!hub.allowChat(user.id)) {
              socket.send(JSON.stringify({ t: 'chat:rejected', tempId, to, code: 'rate_limited' }))
              break
            }
            if (!(await areFriends(user.id, to))) break
            const inserted = await pool.query<{ id: string; created_at: string }>(
              'INSERT INTO messages(from_id, to_id, iv, ct) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
              [user.id, to, iv, ct]
            )
            const row = inserted.rows[0]
            if (!row) break
            const at = new Date(row.created_at).getTime()
            const id = Number(row.id)
            hub.send(to, { t: 'chat:msg', from: user.id, id, iv, ct, at })
            socket.send(JSON.stringify({ t: 'chat:sent', tempId, to, id, at }))
            // occasionally trim the pair history so storage stays bounded
            if (id % 20 === 0) {
              void pool.query(
                `DELETE FROM messages WHERE ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))
                 AND id NOT IN (
                   SELECT id FROM messages
                   WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)
                   ORDER BY id DESC LIMIT ${MESSAGES_KEPT_PER_PAIR}
                 )`,
                [user.id, to]
              )
            }
            break
          }
          case 'chat:typing': {
            const to = message.to
            if (typeof to !== 'string' || !UUID_RE.test(to)) break
            if (!(await areFriends(user.id, to))) break
            hub.send(to, { t: 'chat:typing', from: user.id })
            break
          }
          case 'jam:chat': {
            const text = typeof message.text === 'string' ? message.text.trim() : ''
            if (text.length === 0 || text.length > 500) break
            if (!hub.allowChat(user.id)) {
              socket.send(JSON.stringify({ t: 'chat:rejected', code: 'rate_limited' }))
              break
            }
            jams.addChat(user.id, user.name, text)
            break
          }
          default:
            break
        }
      })().catch((error) => console.error('ws message failed', error))
    })

    socket.on('close', () => {
      clearTimeout(helloTimer)
      clearInterval(pinger)
      if (user) {
        hub.disconnect(user.id, socket)
        // hub no longer tracks them → owner-offline grace may start
        if (!hub.isOnline(user.id)) jams.memberOffline(user.id)
      }
    })
    socket.on('error', () => {
      /* close handler does the cleanup */
    })
  })
}
