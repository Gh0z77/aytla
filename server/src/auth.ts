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
  /** Pro until this time (ms), null = never had it */
  pro_until: number | null
  /** the friend / invite code, assigned on first use */
  ref_code: string | null
}

/** the provider column, derived from the hash scheme (`u` is the users alias) */
const providerSql = (alias: string) => `CASE WHEN ${alias}.password_hash = 'telegram$' THEN 'telegram' WHEN ${alias}.password_hash = 'clerk$' THEN 'google' ELSE 'email' END AS provider`
export const USER_COLUMNS = `u.id, u.email, u.name, u.guide, u.tier, u.pro_until, u.ref_code, ${providerSql('u')}`

/** eight characters without look-alikes: the friend and invite code */
export function newRefCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}

export const isPro = (u: Pick<User, 'pro_until'>, now: number): boolean => u.pro_until !== null && Number(u.pro_until) > now

/** older accounts have no code yet: give them one the first time it is needed */
export async function ensureRefCode(db: Db, user: User): Promise<User> {
  if (user.ref_code) return user
  for (let i = 0; i < 5; i++) {
    const code = newRefCode()
    const taken = await db.get('SELECT 1 AS one FROM users WHERE ref_code = ?', code)
    if (taken) continue
    await db.run('UPDATE users SET ref_code = ? WHERE id = ?', code, user.id)
    return { ...user, ref_code: code }
  }
  return user
}

export const PRO_DAY_MS = 24 * 60 * 60 * 1000

/** extend Pro by `days` from now, or from the current end when it is still running */
export async function grantPro(db: Db, userId: number, days: number, now: number): Promise<number> {
  const row = await db.get<{ pro_until: number | null }>('SELECT pro_until FROM users WHERE id = ?', userId)
  const from = Math.max(now, Number(row?.pro_until ?? 0))
  const until = from + days * PRO_DAY_MS
  await db.run('UPDATE users SET pro_until = ? WHERE id = ?', until, userId)
  return until
}

export const REFERRAL_DAYS = 7
export const REFERRAL_CAP = 10

/** a new account arrived through someone's invite: both get a week of Pro (the inviter for the first ten invites) */
export async function applyReferral(db: Db, newUser: User, code: string | null | undefined, now: number): Promise<boolean> {
  if (!code || typeof code !== 'string') return false
  const inviter = await db.get<{ id: number }>('SELECT id FROM users WHERE ref_code = ?', code.trim().toUpperCase())
  if (!inviter || Number(inviter.id) === newUser.id) return false
  await db.run('UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL', inviter.id, newUser.id)
  const count = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?', inviter.id)
  await grantPro(db, newUser.id, REFERRAL_DAYS, now)
  if (Number(count?.n ?? 0) <= REFERRAL_CAP) await grantPro(db, Number(inviter.id), REFERRAL_DAYS, now)
  return true
}

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
  const code = newRefCode()
  const row = await db.get<{ id: number }>('INSERT INTO users (email, password_hash, name, created_at, ref_code) VALUES (?, ?, ?, ?, ?) RETURNING id', email, hashPassword(password), name, now, code)
  return { id: Number(row?.id), email, name, guide: 'everest', tier: 0, provider: 'email', pro_until: null, ref_code: code }
}

/** Google (and any other Clerk) sign-in: the account is keyed by the Clerk user id, never by the email the client reports. */
export async function findOrCreateClerkUser(db: Db, clerkId: string, email: string, name: string, now: number): Promise<User> {
  const existing = await db.get<User>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.clerk_id = ?`, clerkId)
  if (existing) return { ...existing, id: Number(existing.id) }
  // the email is for display only; if another account already owns it, this one shows none (no silent account linking)
  const taken = email ? await findUserByEmail(db, email) : null
  const shown = email && !taken ? email : `clerk:${clerkId}`
  const clean = cleanName(name)
  const code = newRefCode()
  const row = await db.get<{ id: number }>('INSERT INTO users (email, password_hash, name, clerk_id, created_at, ref_code) VALUES (?, ?, ?, ?, ?, ?) RETURNING id', shown, 'clerk$', clean, clerkId, now, code)
  return { id: Number(row?.id), email: shown, name: clean, guide: 'everest', tier: 0, provider: 'google', pro_until: null, ref_code: code }
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
