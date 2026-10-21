import { DatabaseSync } from 'node:sqlite'
import postgres from 'postgres'

/**
 * One small async database interface with two backends:
 *
 * - SQLite through Node's built-in driver for development and tests
 *   (`openDb(':memory:')` or a file path): nothing to install, one file.
 * - Postgres (Supabase in production) when the target is a `postgres://` URL.
 *
 * SQL is written once with `?` placeholders; the Postgres backend rewrites
 * them to `$1…$n`. Timestamps are milliseconds in BIGINT/INTEGER columns and
 * come back as JS numbers in both backends.
 */
export interface Db {
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>
  run(sql: string, ...params: unknown[]): Promise<void>
  /** run `fn` inside a transaction; rolls back if it throws. Use the `tx` handed to `fn`, not the outer db. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): Promise<void>
}

const SCHEMA = (pg: boolean) => `
CREATE TABLE IF NOT EXISTS users (
  id            ${pg ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  guide         TEXT NOT NULL DEFAULT 'everest',
  tier          INTEGER NOT NULL DEFAULT 0,
  created_at    BIGINT NOT NULL,
  telegram_id   TEXT,
  clerk_id      TEXT,
  pro_until     BIGINT,
  ref_code      TEXT,
  referred_by   BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS users_telegram ON users(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_clerk ON users(clerk_id) WHERE clerk_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS states (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS league_entries (
  week_id TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier    INTEGER NOT NULL,
  cohort  INTEGER NOT NULL,
  xp      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week_id, user_id)
);
CREATE INDEX IF NOT EXISTS league_cohort ON league_entries(week_id, tier, cohort);

CREATE TABLE IF NOT EXISTS coach_usage (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS telegram_logins (
  code          TEXT PRIMARY KEY,
  secret_hash   TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'uz',
  created_at    BIGINT NOT NULL,
  expires_at    BIGINT NOT NULL,
  telegram_id   TEXT,
  telegram_name TEXT,
  confirmed     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS telegram_reminders (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS events (
  id          ${pg ? "BIGSERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT"},
  anon        TEXT NOT NULL,
  user_id     BIGINT,
  name        TEXT NOT NULL,
  props       TEXT NOT NULL DEFAULT '{}',
  ts          BIGINT NOT NULL,
  received_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);

CREATE TABLE IF NOT EXISTS client_errors (
  id          ${pg ? "BIGSERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT"},
  anon        TEXT NOT NULL,
  user_id     BIGINT,
  message     TEXT NOT NULL,
  stack       TEXT NOT NULL DEFAULT '',
  platform    TEXT NOT NULL DEFAULT '',
  version     TEXT NOT NULL DEFAULT '',
  received_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS pro_interest (
  email      TEXT PRIMARY KEY,
  lang       TEXT NOT NULL DEFAULT 'uz',
  created_at BIGINT NOT NULL
);
`

// -- SQLite --------------------------------------------------------------------

class SqliteDb implements Db {
  private readonly db: DatabaseSync
  constructor(db: DatabaseSync) {
    this.db = db
  }
  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return (this.db.prepare(sql).get(...(params as never[])) as T | undefined) ?? undefined
  }
  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[]
  }
  async run(sql: string, ...params: unknown[]): Promise<void> {
    this.db.prepare(sql).run(...(params as never[]))
  }
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const out = await fn(this)
      this.db.exec('COMMIT')
      return out
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }
  async close(): Promise<void> {
    this.db.close()
  }
  migrate(): void {
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.db.exec(SCHEMA(false))
    // databases created before a column existed: SQLite cannot add a UNIQUE column, so add it and index it
    const columns = (this.db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => c.name)
    for (const column of ['telegram_id', 'clerk_id', 'ref_code']) if (!columns.includes(column)) this.db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`)
    for (const column of ['pro_until', 'referred_by']) if (!columns.includes(column)) this.db.exec(`ALTER TABLE users ADD COLUMN ${column} BIGINT`)
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_ref ON users(ref_code) WHERE ref_code IS NOT NULL')
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_telegram ON users(telegram_id) WHERE telegram_id IS NOT NULL')
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_clerk ON users(clerk_id) WHERE clerk_id IS NOT NULL')
  }
}

// -- Postgres ------------------------------------------------------------------

type Sql = ReturnType<typeof postgres>

/** `?` → `$1, $2, …` (no `?` ever appears inside our SQL string literals). */
const numbered = (sql: string) => {
  let i = 0
  return sql.replace(/\?/g, () => `$${++i}`)
}

class PostgresDb implements Db {
  private readonly sql: Sql
  constructor(sql: Sql) {
    this.sql = sql
  }
  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const rows = await this.sql.unsafe(numbered(sql), params as never[])
    return (rows[0] as T | undefined) ?? undefined
  }
  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (await this.sql.unsafe(numbered(sql), params as never[])) as unknown as T[]
  }
  async run(sql: string, ...params: unknown[]): Promise<void> {
    await this.sql.unsafe(numbered(sql), params as never[])
  }
  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return (await this.sql.begin((tx) => fn(new PostgresDb(tx as unknown as Sql)))) as T
  }
  async close(): Promise<void> {
    await this.sql.end()
  }
  async migrate(): Promise<void> {
    for (const statement of SCHEMA(true).split(';').map((s) => s.trim()).filter(Boolean)) await this.sql.unsafe(statement)
    await this.sql.unsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id TEXT')
    await this.sql.unsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT')
    await this.sql.unsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS ref_code TEXT')
    await this.sql.unsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_until BIGINT')
    await this.sql.unsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT')
    await this.sql.unsafe('CREATE UNIQUE INDEX IF NOT EXISTS users_ref ON users(ref_code) WHERE ref_code IS NOT NULL')
  }
}

/** Open (and migrate) the database: ':memory:' or a file path for SQLite, a postgres:// URL for Postgres. */
export async function openDb(target: string): Promise<Db> {
  if (/^postgres(ql)?:\/\//.test(target)) {
    const sql = postgres(target, {
      ssl: 'require',
      max: 5,
      // "already exists, skipping" from the idempotent migration is not worth a log line
      onnotice: () => undefined,
      // int8 (BIGINT, COUNT) as JS numbers: our values are millisecond timestamps and counts, far below 2^53
      types: { bigint: { to: 20, from: [20], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) } },
    })
    const db = new PostgresDb(sql)
    await db.migrate()
    return db
  }
  const db = new SqliteDb(new DatabaseSync(target))
  db.migrate()
  return db
}
