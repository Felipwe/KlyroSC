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
`

const MESSAGE_TTL_DAYS = 30

export async function initDb(): Promise<void> {
  await pool.query(SCHEMA)
  const sweep = (): void => {
    pool
      .query(`DELETE FROM messages WHERE created_at < now() - interval '${MESSAGE_TTL_DAYS} days'`)
      .catch((error) => console.error('message sweep failed', error))
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
