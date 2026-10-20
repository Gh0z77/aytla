import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Db } from './db.ts'

/**
 * Accounts: scrypt password hashes and opaque bearer tokens.
 * Tokens are random, stored only as SHA-256 hashes (a leaked database cannot
 * be replayed), expire after 90 days and are revoked on logout.
 *
 * Telegram and Google (Clerk) accounts have no password: their hash column
 * holds a marker (`telegram$`, `clerk$`) that never verifies, and `provider`
 * is derived from it so the API can say how the learner signed up.
 */

const SCRYPT_KEYLEN = 64
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

export type Provider = 'email' | 'telegram' | 'google'

export interface User {
  id: number
  email: string
  name: string
  guide: string
  tier: number
  /** how the learner signed up; a password login never opens a Telegram or Google account */
  provider: Provider
}

/** the provider column, derived from the hash scheme (`u` is the users alias) */
const providerSql = (alias: string) => `CASE WHEN ${alias}.password_hash = 'telegram$' THEN 'telegram' WHEN ${alias}.password_hash = 'clerk$' THEN 'google' ELSE 'email' END AS provider`
export const USER_COLUMNS = `u.id, u.email, u.name, u.guide, u.tier, ${providerSql('u')}`

/** Telegram and Clerk accounts carry an internal key instead of an email; it is never shown */
export const isPlaceholderEmail = (email: string): boolean => email.startsWith('tg:') || email.startsWith('clerk:')

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function issueToken(db: Db, userId: number, now: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', hashToken(token), userId, now, now + TOKEN_TTL_MS)
  return token
}

export async function revokeToken(db: Db, token: string): Promise<void> {
  await db.run('DELETE FROM sessions WHERE token_hash = ?', hashToken(token))
}

export async function userForToken(db: Db, token: string, now: number): Promise<User | null> {
  const row = await db.get<User>(
    `SELECT ${USER_COLUMNS}
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    hashToken(token),
    now
  )
  return row ? { ...row, id: Number(row.id) } : null
}

export async function findUserByEmail(db: Db, email: string): Promise<(User & { password_hash: string }) | null> {
  const row = await db.get<User & { password_hash: string }>(`SELECT ${USER_COLUMNS}, u.password_hash FROM users u WHERE u.email = ?`, email)
  return row ? { ...row, id: Number(row.id) } : null
}

export async function createUser(db: Db, email: string, password: string, name: string, now: number): Promise<User> {
  const row = await db.get<{ id: number }>('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?) RETURNING id', email, hashPassword(password), name, now)
  return { id: Number(row?.id), email, name, guide: 'everest', tier: 0, provider: 'email' }
}

/** Google (and any other Clerk) sign-in: the account is keyed by the Clerk user id, never by the email the client reports. */
export async function findOrCreateClerkUser(db: Db, clerkId: string, email: string, name: string, now: number): Promise<User> {
  const existing = await db.get<User>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.clerk_id = ?`, clerkId)
  if (existing) return { ...existing, id: Number(existing.id) }
  // the email is for display only; if another account already owns it, this one shows none (no silent account linking)
  const taken = email ? await findUserByEmail(db, email) : null
  const shown = email && !taken ? email : `clerk:${clerkId}`
  const clean = cleanName(name)
  const row = await db.get<{ id: number }>('INSERT INTO users (email, password_hash, name, clerk_id, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id', shown, 'clerk$', clean, clerkId, now)
  return { id: Number(row?.id), email: shown, name: clean, guide: 'everest', tier: 0, provider: 'google' }
}

// -- input rules --------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 200
}

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 24) : ''
}

// -- brute-force protection ----------------------------------------------------

/** Fixed-window attempt counter, kept in memory (one process). */
export class AttemptLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()
  private readonly max: number
  private readonly windowMs: number

  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
  }

  /** Returns false when the key has used up its attempts for the current window. */
  allow(key: string, now: number): boolean {
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    entry.count += 1
    return entry.count <= this.max
  }

  reset(key: string): void {
    this.hits.delete(key)
  }
}
