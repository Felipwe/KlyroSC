import { createServer } from 'node:http'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { WebSocketServer } from 'ws'
import { initDb, pool } from './db.js'
import { Hub } from './hub.js'
import { JamService, type JamEvent } from './jams.js'
import { createRouter } from './http.js'
import { attachWebSocket } from './ws.js'

const PORT = Number(process.env.PORT ?? 8080)

async function main(): Promise<void> {
  await initDb()

  const hub = new Hub()
  const jams = new JamService((event: JamEvent) => {
    switch (event.kind) {
      case 'sync':
        hub.sendMany(event.userIds, { t: 'sync' })
        break
      case 'playback':
        hub.sendMany(event.userIds, { t: 'jam:playback', playback: event.playback })
        break
      case 'queue':
        hub.sendMany(event.userIds, { t: 'jam:queue', queue: event.queue })
        break
      case 'invite':
        hub.sendMany([event.invite.toId], { t: 'sync' })
        break
      case 'ended':
        hub.sendMany(event.userIds, { t: 'jam:ended', jamId: event.jamId })
        break
    }
  })

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // Railway edge proxy
  app.use(helmet())
  app.use(express.json({ limit: '128kb' })) // avatars travel as small data urls
  app.use(
    rateLimit({
      windowMs: 5 * 60 * 1000,
      limit: 400,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'rate_limited' }
    })
  )

  app.get('/health', (_req, res) => {
    pool
      .query('SELECT 1')
      .then(() => res.json({ ok: true }))
      .catch(() => res.status(503).json({ ok: false }))
  })

  app.use('/v1', createRouter({ hub, jams }))

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('unhandled route error', error)
    if (!res.headersSent) res.status(500).json({ error: 'internal' })
  })

  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })
  attachWebSocket(wss, { hub, jams })

  server.listen(PORT, () => {
    console.log(`klyrosc-social listening on :${PORT}`)
  })

  const shutdown = (): void => {
    console.log('shutting down')
    server.close(() => {
      void pool.end().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(0), 5_000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  console.error('fatal startup error', error)
  process.exit(1)
})
