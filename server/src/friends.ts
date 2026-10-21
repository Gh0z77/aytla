import { USER_COLUMNS, type User } from './auth.ts'
import type { Db } from './db.ts'

/**
 * Friends: learners add each other by friend code (the same code that invites
 * people), so nobody can look up strangers by email. A friend is anyone you
 * added or who added you; the list shows this week's XP, so it works like a
 * private league.
 */

export interface Friend {
  id: number
  name: string
  guide: string
  weeklyXp: number
  /** the friend added you (true) or you added them */
  addedYou: boolean
}

export async function listFriends(db: Db, userId: number, week: string): Promise<Friend[]> {
  const rows = await db.all<User & { weekly_xp: number | null; added_you: number }>(
    `SELECT ${USER_COLUMNS}, e.xp AS weekly_xp, CASE WHEN f.user_id = ? THEN 0 ELSE 1 END AS added_you
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
       LEFT JOIN league_entries e ON e.user_id = u.id AND e.week_id = ?
      WHERE f.user_id = ? OR f.friend_id = ?
      ORDER BY e.xp DESC NULLS LAST, u.name ASC`,
    userId,
    userId,
    week,
    userId,
    userId
  )
  const seen = new Set<number>()
  const out: Friend[] = []
  for (const r of rows) {
    const id = Number(r.id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: r.name, guide: r.guide, weeklyXp: Number(r.weekly_xp ?? 0), addedYou: Number(r.added_you) === 1 })
  }
  return out
}

export type AddOutcome = 'added' | 'already' | 'self' | 'unknown'

export async function addFriend(db: Db, userId: number, code: string, now: number): Promise<AddOutcome> {
  const other = await db.get<{ id: number }>('SELECT id FROM users WHERE ref_code = ?', code.trim().toUpperCase())
  if (!other) return 'unknown'
  const friendId = Number(other.id)
  if (friendId === userId) return 'self'
  const existing = await db.get('SELECT 1 AS one FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', userId, friendId, friendId, userId)
  if (existing) return 'already'
  await db.run('INSERT INTO friends (user_id, friend_id, created_at) VALUES (?, ?, ?)', userId, friendId, now)
  return 'added'
}

export async function removeFriend(db: Db, userId: number, friendId: number): Promise<void> {
  await db.run('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', userId, friendId, friendId, userId)
}
