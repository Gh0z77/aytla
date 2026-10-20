import { DatabaseSync } from 'node:sqlite'

/**
 * SQLite through Node's built-in driver: no native add-on to compile, one file
 * to back up. Swap for Postgres when one machine is no longer enough; all SQL
 * lives in this folder and uses nothing SQLite-specific beyond UPSERT.
 */
export type Db = DatabaseSync

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  guide         TEXT NOT NULL DEFAULT 'everest',
  tier          INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS states (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS league_entries (
  week_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier    INTEGER NOT NULL,
  cohort  INTEGER NOT NULL,
  xp      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week_id, user_id)
);
CREATE INDEX IF NOT EXISTS league_cohort ON league_entries(week_id, tier, cohort);

CREATE TABLE IF NOT EXISTS coach_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS telegram_logins (
  code          TEXT PRIMARY KEY,
  secret_hash   TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'uz',
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  telegram_id   INTEGER,
  telegram_name TEXT,
  confirmed     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS telegram_reminders (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
`

/** Open (and migrate) the database. Pass ':memory:' in tests. */
export function openDb(file: string): Db {
  const db = new DatabaseSync(file)
  db.exec(SCHEMA)
  // databases created before Telegram sign-in: SQLite cannot add a UNIQUE column, so add the column and index it
  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
  if (!columns.some((c) => c.name === 'telegram_id')) db.exec('ALTER TABLE users ADD COLUMN telegram_id INTEGER')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_telegram ON users(telegram_id) WHERE telegram_id IS NOT NULL')
  return db
}

/** Run `fn` inside a transaction; rolls back if it throws. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
