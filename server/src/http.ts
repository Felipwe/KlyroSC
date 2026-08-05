import { type NextFunction, type Request, type Response, Router } from 'express'
import rateLimit from 'express-rate-limit'
import { areFriends, friendIdsOf, orderPair, pool } from './db.js'
import { generateAccountNumber, generateSessionToken, isAccountNumber, sha256 } from './security.js'
import { randomName } from './names.js'
import { type Hub } from './hub.js'
import { JAM_MAX_MEMBERS, type JamService } from './jams.js'
import { isValidAvatar, type SocialUser } from './types.js'

const SESSION_DAYS = 180

declare module 'express-serve-static-core' {
  interface Request {
    user?: SocialUser
    tokenHash?: string
  }
}

interface Services {
  hub: Hub
  jams: JamService
}

const fail = (res: Response, status: number, error: string): void => {
  res.status(status).json({ error })
}

export function authMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (token.length < 20 || token.length > 128) {
      fail(res, 401, 'unauthorized')
      return
    }
    const tokenHash = sha256(token)
    try {
      const result = await pool.query<{ user_id: string; name: string; public_id: string; avatar: string | null }>(
        `SELECT s.user_id, u.name, u.public_id, u.avatar FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [tokenHash]
      )
      const row = result.rows[0]
      if (!row) {
        fail(res, 401, 'unauthorized')
        return
      }
      req.user = { id: row.user_id, name: row.name, publicId: Number(row.public_id), avatar: row.avatar }
      req.tokenHash = tokenHash
      // sliding renewal, cheap no-op most of the time
      void pool.query(
        `UPDATE sessions SET expires_at = now() + interval '${SESSION_DAYS} days'
         WHERE token_hash = $1 AND expires_at < now() + interval '${SESSION_DAYS - 30} days'`,
        [tokenHash]
      )
      void pool.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [row.user_id])
      next()
    } catch (error) {
      console.error('auth middleware failed', error)
      fail(res, 500, 'internal')
    }
  }
}

async function buildState(me: SocialUser, services: Services): Promise<Record<string, unknown>> {
  const { hub, jams } = services
  const userId = me.id
  const friendsResult = await pool.query<{
    id: string
    name: string
    public_id: string
    pubkey: string | null
    avatar: string | null
    created_at: string
  }>(
    `SELECT u.id, u.name, u.public_id, u.pubkey, u.avatar, f.created_at FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
     WHERE f.user_a = $1 OR f.user_b = $1
     ORDER BY u.name`,
    [userId]
  )
  const requestsResult = await pool.query<{
    id: string
    from_id: string
    to_id: string
    from_name: string
    to_name: string
    from_public: string
    to_public: string
    from_avatar: string | null
    to_avatar: string | null
    created_at: string
  }>(
    `SELECT r.id, r.from_id, r.to_id, uf.name AS from_name, ut.name AS to_name,
            uf.public_id AS from_public, ut.public_id AS to_public,
            uf.avatar AS from_avatar, ut.avatar AS to_avatar, r.created_at
     FROM friend_requests r
     JOIN users uf ON uf.id = r.from_id
     JOIN users ut ON ut.id = r.to_id
     WHERE r.from_id = $1 OR r.to_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  )

  const resolveUser = (id: string): SocialUser | null => hub.userOf(id) ?? null
  const resolveOrDb = async (id: string): Promise<SocialUser> => {
    const online = hub.userOf(id)
    if (online) return online
    const row = (
      await pool.query<{ id: string; name: string; public_id: string; avatar: string | null }>(
        'SELECT id, name, public_id, avatar FROM users WHERE id = $1',
        [id]
      )
    ).rows[0]
    return row
      ? { id: row.id, name: row.name, publicId: Number(row.public_id), avatar: row.avatar }
      : { id, name: 'Unknown', publicId: 0, avatar: null }
  }

  const jam = jams.jamOf(userId)
  let jamDto: Record<string, unknown> | null = null
  if (jam) {
    const dto = jams.toDto(jam, resolveUser)
    // fill names of offline members from the database
    dto.members = await Promise.all(
      dto.members.map(async (member) =>
        member.name === 'Unknown' ? { ...(await resolveOrDb(member.id)), owner: member.owner } : member
      )
    )
    jamDto = dto as unknown as Record<string, unknown>
  }

  const invites = await Promise.all(
    jams.invitesFor(userId).map(async (invite) => {
      const dto = jams.inviteToDto(invite, resolveUser)
      if (dto.from.name === 'Unknown') dto.from = await resolveOrDb(invite.fromId)
      return dto
    })
  )

  return {
    user: me,
    friends: friendsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      publicId: Number(row.public_id),
      avatar: row.avatar,
      chatKey: row.pubkey,
      since: row.created_at,
      presence: hub.presenceOf(row.id)
    })),
    requests: requestsResult.rows.map((row) => ({
      id: row.id,
      user:
        row.from_id === userId
          ? { id: row.to_id, name: row.to_name, publicId: Number(row.to_public), avatar: row.to_avatar }
          : { id: row.from_id, name: row.from_name, publicId: Number(row.from_public), avatar: row.from_avatar },
      direction: row.from_id === userId ? 'out' : 'in',
      createdAt: row.created_at
    })),
    invites,
    jam: jamDto,
    serverNow: Date.now()
  }
}

export function createRouter(services: Services): Router {
  const { hub, jams } = services
  const router = Router()
  const auth = authMiddleware()

  const createAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited' }
  })
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited' }
  })
  const socialWriteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited' }
  })

  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction): void => {
      fn(req, res).catch(next)
    }

  //  account 
  router.post(
    '/account',
    createAccountLimiter,
    wrap(async (_req, res) => {
      let name = ''
      let accountNumber = ''
      let userId = ''
      let publicId = 0
      for (let attempt = 0; attempt < 40; attempt++) {
        name = randomName()
        accountNumber = generateAccountNumber()
        try {
          const result = await pool.query<{ id: string; public_id: string }>(
            'INSERT INTO users(name, account_hash) VALUES ($1, $2) RETURNING id, public_id',
            [name, sha256(accountNumber)]
          )
          userId = result.rows[0]?.id ?? ''
          publicId = Number(result.rows[0]?.public_id ?? 0)
          break
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code !== '23505') throw error // retry only on unique collisions
        }
      }
      if (!userId) {
        fail(res, 503, 'name_pool_exhausted')
        return
      }
      const token = generateSessionToken()
      await pool.query(
        `INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
        [sha256(token), userId]
      )
      res.status(201).json({ user: { id: userId, name, publicId, avatar: null }, accountNumber, token })
    })
  )

  router.post(
    '/auth/login',
    loginLimiter,
    wrap(async (req, res) => {
      const number = (req.body as Record<string, unknown> | undefined)?.accountNumber
      if (!isAccountNumber(number)) {
        fail(res, 400, 'invalid_account')
        return
      }
      const result = await pool.query<{ id: string; name: string; public_id: string; avatar: string | null }>(
        'SELECT id, name, public_id, avatar FROM users WHERE account_hash = $1',
        [sha256(number)]
      )
      const row = result.rows[0]
      if (!row) {
        fail(res, 401, 'invalid_account')
        return
      }
      const token = generateSessionToken()
      await pool.query(
        `INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
        [sha256(token), row.id]
      )
      res.json({
        user: { id: row.id, name: row.name, publicId: Number(row.public_id), avatar: row.avatar },
        token
      })
    })
  )

  router.post(
    '/auth/logout',
    auth,
    wrap(async (req, res) => {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [req.tokenHash])
      res.status(204).end()
    })
  )

  router.delete(
    '/account',
    auth,
    wrap(async (req, res) => {
      const me = req.user!
      const friends = await friendIdsOf(me.id)
      jams.forgetUser(me.id)
      await pool.query('DELETE FROM users WHERE id = $1', [me.id])
      for (const friendId of friends) {
        hub.unlinkFriends(me.id, friendId)
        hub.send(friendId, { t: 'sync' })
      }
      res.status(204).end()
    })
  )

  //  state 
  router.get(
    '/state',
    auth,
    wrap(async (req, res) => {
      res.json(await buildState(req.user!, services))
    })
  )

  router.post(
    '/avatar',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const avatar = (req.body as Record<string, unknown> | undefined)?.avatar
      if (avatar !== null && !isValidAvatar(avatar)) {
        fail(res, 400, 'invalid_avatar')
        return
      }
      await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, me.id])
      hub.setAvatar(me.id, avatar as string | null)
      for (const friendId of await friendIdsOf(me.id)) hub.send(friendId, { t: 'sync' })
      res.json({ result: 'updated' })
    })
  )

  //  e2e chat keys 
  router.post(
    '/keys',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const key = (req.body as Record<string, unknown> | undefined)?.publicKey
      if (typeof key !== 'string' || key.length < 40 || key.length > 60 || !/^[A-Za-z0-9+/=]+$/.test(key)) {
        fail(res, 400, 'invalid_key')
        return
      }
      await pool.query('UPDATE users SET pubkey = $1 WHERE id = $2', [key, req.user!.id])
      // friends may need the fresh key to talk to us
      for (const friendId of await friendIdsOf(req.user!.id)) hub.send(friendId, { t: 'sync' })
      res.json({ result: 'updated' })
    })
  )

  //  chat history (ciphertext only  server cannot read it) 
  router.get(
    '/chat/:friendId',
    auth,
    wrap(async (req, res) => {
      const me = req.user!
      const friendId = String(req.params.friendId ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(friendId)) {
        fail(res, 400, 'invalid_user')
        return
      }
      if (!(await areFriends(me.id, friendId))) {
        fail(res, 403, 'not_friends')
        return
      }
      const beforeRaw = Number(req.query.before ?? 0)
      const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? beforeRaw : Number.MAX_SAFE_INTEGER
      const rows = await pool.query<{
        id: string
        from_id: string
        iv: string
        ct: string
        created_at: string
      }>(
        `SELECT id, from_id, iv, ct, created_at FROM messages
         WHERE ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)) AND id < $3
         ORDER BY id DESC LIMIT 60`,
        [me.id, friendId, before]
      )
      res.json({
        messages: rows.rows
          .map((row) => ({
            id: Number(row.id),
            fromId: row.from_id,
            iv: row.iv,
            ct: row.ct,
            at: new Date(row.created_at).getTime()
          }))
          .reverse()
      })
    })
  )

  //  friends 
  router.post(
    '/friends/requests',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const rawId = (req.body as Record<string, unknown> | undefined)?.publicId
      const publicId = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : NaN
      if (!Number.isInteger(publicId) || publicId < 1 || publicId > Number.MAX_SAFE_INTEGER) {
        fail(res, 400, 'invalid_id')
        return
      }
      const target = (
        await pool.query<{ id: string; name: string }>('SELECT id, name FROM users WHERE public_id = $1', [publicId])
      ).rows[0]
      if (!target) {
        fail(res, 404, 'user_not_found')
        return
      }
      if (target.id === me.id) {
        fail(res, 400, 'cannot_add_self')
        return
      }
      if (await areFriends(me.id, target.id)) {
        fail(res, 409, 'already_friends')
        return
      }
      const reverse = (
        await pool.query<{ id: string }>('SELECT id FROM friend_requests WHERE from_id = $1 AND to_id = $2', [
          target.id,
          me.id
        ])
      ).rows[0]
      if (reverse) {
        // they already asked us  accept instead of duplicating
        const [a, b] = orderPair(me.id, target.id)
        await pool.query('BEGIN')
        try {
          await pool.query('DELETE FROM friend_requests WHERE id = $1', [reverse.id])
          await pool.query('INSERT INTO friendships(user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [a, b])
          await pool.query('COMMIT')
        } catch (error) {
          await pool.query('ROLLBACK')
          throw error
        }
        hub.linkFriends(me.id, target.id)
        hub.sendMany([me.id, target.id], { t: 'sync' })
        res.status(200).json({ result: 'accepted_existing' })
        return
      }
      try {
        await pool.query('INSERT INTO friend_requests(from_id, to_id) VALUES ($1, $2)', [me.id, target.id])
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          fail(res, 409, 'already_requested')
          return
        }
        throw error
      }
      hub.sendMany([me.id, target.id], { t: 'sync' })
      res.status(201).json({ result: 'requested' })
    })
  )

  router.post(
    '/friends/requests/:id/accept',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const request = (
        await pool.query<{ id: string; from_id: string; to_id: string }>(
          'SELECT id, from_id, to_id FROM friend_requests WHERE id = $1 AND to_id = $2',
          [req.params.id, me.id]
        )
      ).rows[0]
      if (!request) {
        fail(res, 404, 'request_not_found')
        return
      }
      const [a, b] = orderPair(request.from_id, request.to_id)
      await pool.query('BEGIN')
      try {
        await pool.query('DELETE FROM friend_requests WHERE id = $1', [request.id])
        await pool.query('INSERT INTO friendships(user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [a, b])
        await pool.query('COMMIT')
      } catch (error) {
        await pool.query('ROLLBACK')
        throw error
      }
      hub.linkFriends(request.from_id, request.to_id)
      hub.sendMany([request.from_id, request.to_id], { t: 'sync' })
      res.json({ result: 'accepted' })
    })
  )

  router.post(
    '/friends/requests/:id/decline',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      // decline incoming or cancel outgoing
      const request = (
        await pool.query<{ from_id: string; to_id: string }>(
          'DELETE FROM friend_requests WHERE id = $1 AND (to_id = $2 OR from_id = $2) RETURNING from_id, to_id',
          [req.params.id, me.id]
        )
      ).rows[0]
      if (!request) {
        fail(res, 404, 'request_not_found')
        return
      }
      hub.sendMany([request.from_id, request.to_id], { t: 'sync' })
      res.status(204).end()
    })
  )

  router.delete(
    '/friends/:userId',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const other = String(req.params.userId ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(other)) {
        fail(res, 400, 'invalid_user')
        return
      }
      const [a, b] = orderPair(me.id, other)
      const result = await pool.query('DELETE FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b])
      if ((result.rowCount ?? 0) === 0) {
        fail(res, 404, 'not_friends')
        return
      }
      hub.unlinkFriends(me.id, other)
      hub.sendMany([me.id, other], { t: 'sync' })
      res.status(204).end()
    })
  )

  //  jams 
  router.post(
    '/jams',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      jams.create(req.user!.id)
      res.status(201).json(await buildState(req.user!, services))
    })
  )

  router.post(
    '/jams/current/invites',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const target = (req.body as Record<string, unknown> | undefined)?.userId
      if (typeof target !== 'string' || !/^[0-9a-f-]{36}$/i.test(target)) {
        fail(res, 400, 'invalid_user')
        return
      }
      if (!(await areFriends(me.id, target))) {
        fail(res, 403, 'not_friends')
        return
      }
      if (!hub.isOnline(target)) {
        fail(res, 409, 'friend_offline')
        return
      }
      const result = jams.invite(me.id, target)
      if (!result.ok) {
        fail(res, 409, result.error)
        return
      }
      res.status(201).json({ result: 'invited', capacity: JAM_MAX_MEMBERS })
    })
  )

  router.post(
    '/invites/:id/accept',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const result = jams.acceptInvite(me.id, String(req.params.id ?? ''))
      if (!result.ok) {
        fail(res, 409, result.error)
        return
      }
      res.json(await buildState(me, services))
    })
  )

  router.post(
    '/invites/:id/decline',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      jams.declineInvite(me.id, String(req.params.id ?? ''))
      res.status(204).end()
    })
  )

  router.post(
    '/jams/current/leave',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      jams.leave(req.user!.id)
      res.status(204).end()
    })
  )

  router.post(
    '/jams/current/end',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const jam = jams.jamOf(me.id)
      if (!jam) {
        fail(res, 404, 'not_in_jam')
        return
      }
      if (jam.ownerId !== me.id) {
        fail(res, 403, 'owner_only')
        return
      }
      jams.end(jam.id)
      res.status(204).end()
    })
  )

  router.patch(
    '/jams/current',
    auth,
    socialWriteLimiter,
    wrap(async (req, res) => {
      const me = req.user!
      const allow = (req.body as Record<string, unknown> | undefined)?.allowGuestControl
      if (typeof allow !== 'boolean') {
        fail(res, 400, 'invalid_payload')
        return
      }
      if (!jams.setGuestControl(me.id, allow)) {
        fail(res, 403, 'owner_only')
        return
      }
      res.json({ result: 'updated' })
    })
  )

  return router
}
