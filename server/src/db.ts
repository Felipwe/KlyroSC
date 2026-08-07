import pg from 'pg'

const { Pool } = pg

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

// Railway's internal network needs no TLS; the public proxy uses a self-signed chain.
const needsSsl = !url.includes('railway.internal') && !url.includes('localhost') && !url.includes('127.0.0.1')

export const pool = new Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined
})

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id BIGINT GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  account_hash TEXT NOT NULL UNIQUE,
  pubkey TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id BIGINT GENERATED ALWAYS AS IDENTITY;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pubkey TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stats JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_idx ON users(public_id);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_id, to_id),
  CHECK (from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_to_idx ON friend_requests(to_id);
CREATE TABLE IF NOT EXISTS friendships (
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE INDEX IF NOT EXISTS friendships_b_idx ON friendships(user_b);
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  iv TEXT NOT NULL,
  ct TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages(LEAST(from_id, to_id), GREATEST(from_id, to_id), id DESC);
CREATE TABLE IF NOT EXISTS jams (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allow_guest_control BOOLEAN NOT NULL DEFAULT false,
  playback JSONB NOT NULL,
  queue JSONB NOT NULL DEFAULT '[]',
  chat JSONB NOT NULL DEFAULT '[]',
  chat_counter BIGINT NOT NULL DEFAULT 0,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jam_members (
  jam_id UUID NOT NULL REFERENCES jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (jam_id, user_id)
);
CREATE TABLE IF NOT EXISTS chat_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id)
);
`

const MESSAGE_TTL_DAYS = 30
/** accounts idle beyond this are removed automatically (cascades sessions, friends, messages) */
const INACTIVE_ACCOUNT_DAYS = 180

export async function initDb(): Promise<void> {
  await pool.query(SCHEMA)
  const sweep = (): void => {
    pool
      .query(`DELETE FROM messages WHERE created_at < now() - interval '${MESSAGE_TTL_DAYS} days'`)
      .catch((error) => console.error('message sweep failed', error))
    pool
      .query(`DELETE FROM users WHERE last_seen_at < now() - interval '${INACTIVE_ACCOUNT_DAYS} days'`)
      .then((result) => {
        if ((result.rowCount ?? 0) > 0) console.log(`removed ${result.rowCount} inactive account(s)`)
      })
      .catch((error) => console.error('inactive account sweep failed', error))
  }
  sweep()
  setInterval(sweep, 6 * 60 * 60 * 1000).unref()
}

export interface UserRow {
  id: string
  name: string
}

/** Orders the pair so (a,b) always satisfies the a<b constraint. */
export const orderPair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x])

export async function friendIdsOf(userId: string): Promise<string[]> {
  const result = await pool.query<{ friend_id: string }>(
    `SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS friend_id
     FROM friendships WHERE user_a = $1 OR user_b = $1`,
    [userId]
  )
  return result.rows.map((row) => row.friend_id)
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const [x, y] = orderPair(a, b)
  const result = await pool.query('SELECT 1 FROM friendships WHERE user_a = $1 AND user_b = $2', [x, y])
  return (result.rowCount ?? 0) > 0
}

import { type JamPersistence, type PersistedJamRow } from './jams.js'

/** Write-through store so jams survive server restarts/deploys. */
export const jamPersistence: JamPersistence = {
  async loadAll(): Promise<PersistedJamRow[]> {
    const jams = await pool.query<{
      id: string
      owner_id: string
      allow_guest_control: boolean
      playback: unknown
      queue: unknown
      chat: unknown
      chat_counter: string
      last_activity: string
    }>('SELECT * FROM jams')
    const members = await pool.query<{ jam_id: string; user_id: string; joined_at: string }>(
      'SELECT jam_id, user_id, joined_at FROM jam_members'
    )
    return jams.rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      allowGuestControl: row.allow_guest_control,
      playback: row.playback as PersistedJamRow['playback'],
      queue: (row.queue ?? []) as PersistedJamRow['queue'],
      chat: (row.chat ?? []) as PersistedJamRow['chat'],
      chatCounter: Number(row.chat_counter),
      lastActivity: new Date(row.last_activity).getTime(),
      members: members.rows
        .filter((member) => member.jam_id === row.id)
        .map((member) => ({ userId: member.user_id, joinedAt: new Date(member.joined_at).getTime() }))
    }))
  },
  save(row: PersistedJamRow): void {
    void (async () => {
      await pool.query(
        `INSERT INTO jams(id, owner_id, allow_guest_control, playback, queue, chat, chat_counter, last_activity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0))
         ON CONFLICT (id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           allow_guest_control = EXCLUDED.allow_guest_control,
           playback = EXCLUDED.playback,
           queue = EXCLUDED.queue,
           chat = EXCLUDED.chat,
           chat_counter = EXCLUDED.chat_counter,
           last_activity = EXCLUDED.last_activity`,
        [
          row.id,
          row.ownerId,
          row.allowGuestControl,
          JSON.stringify(row.playback),
          JSON.stringify(row.queue),
          JSON.stringify(row.chat),
          row.chatCounter,
          row.lastActivity
        ]
      )
      await pool.query('DELETE FROM jam_members WHERE jam_id = $1', [row.id])
      for (const member of row.members) {
        await pool.query(
          'INSERT INTO jam_members(jam_id, user_id, joined_at) VALUES ($1, $2, to_timestamp($3 / 1000.0)) ON CONFLICT DO NOTHING',
          [row.id, member.userId, member.joinedAt]
        )
      }
    })().catch((error) => console.error('jam persist failed', error))
  },
  remove(jamId: string): void {
    void pool.query('DELETE FROM jams WHERE id = $1', [jamId]).catch((error) =>
      console.error('jam remove failed', error)
    )
  }
}
