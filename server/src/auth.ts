import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Db } from './db.ts'

/**
 * Accounts: scrypt password hashes and opaque bearer tokens.
 * Tokens are random, stored only as SHA-256 hashes (a leaked database cannot
 * be replayed), expire after 90 days and are revoked on logout.
 */

const SCRYPT_KEYLEN = 64
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface User {
  id: number
  email: string
  name: string
  guide: string
  tier: number
}

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

export function issueToken(db: Db, userId: number, now: number): string {
  const token = randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hashToken(token), userId, now, now + TOKEN_TTL_MS)
  return token
}

export function revokeToken(db: Db, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export function userForToken(db: Db, token: string, now: number): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.guide, u.tier
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(hashToken(token), now) as User | undefined
  return row ?? null
}

export function findUserByEmail(db: Db, email: string): (User & { password_hash: string }) | null {
  const row = db.prepare('SELECT id, email, name, guide, tier, password_hash FROM users WHERE email = ?').get(email) as (User & { password_hash: string }) | undefined
  return row ?? null
}

export function createUser(db: Db, email: string, password: string, name: string, now: number): User {
  const result = db.prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)').run(email, hashPassword(password), name, now)
  return { id: Number(result.lastInsertRowid), email, name, guide: 'everest', tier: 0 }
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
