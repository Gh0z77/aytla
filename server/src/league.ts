import type { Db } from './db.ts'

/**
 * Weekly leagues. Learners who earn XP in a week are grouped into cohorts of
 * up to 30 within their tier. When a learner first shows up in a new week, last
 * week's cohort is settled for them: the top 7 move up a tier, the bottom 5 of
 * a reasonably full cohort move down.
 */

export const TIERS = ['Chick', 'Fledgling', 'Songbird', 'Falcon', 'Eagle'] as const
export const COHORT_SIZE = 30
export const PROMOTE_TOP = 7
export const DEMOTE_BOTTOM = 5
/** demotion only applies when the cohort was big enough for "bottom 5" to mean something */
export const MIN_COHORT_FOR_DEMOTION = 12
/** sanity cap: nobody earns more than this in a week by playing lessons */
export const MAX_WEEKLY_XP = 50_000

export interface LeagueRow {
  rank: number
  userId: number
  name: string
  guide: string
  xp: number
  me: boolean
}

export interface LeagueView {
  weekId: string
  tier: number
  tierName: string
  joined: boolean
  promoteTop: number
  demoteBottom: number
  entries: LeagueRow[]
}

interface Entry {
  week_id: string
  user_id: number
  tier: number
  cohort: number
  xp: number
}

function rankedCohort(db: Db, week: string, tier: number, cohort: number): Array<{ user_id: number; name: string; guide: string; xp: number }> {
  return db
    .prepare(
      `SELECT e.user_id, u.name, u.guide, e.xp
         FROM league_entries e JOIN users u ON u.id = e.user_id
        WHERE e.week_id = ? AND e.tier = ? AND e.cohort = ?
        ORDER BY e.xp DESC, e.user_id ASC`
    )
    .all(week, tier, cohort) as Array<{ user_id: number; name: string; guide: string; xp: number }>
}

/** Apply last week's result to the learner's tier. Returns the tier to play in now. */
export function settleTier(db: Db, userId: number, currentWeek: string): number {
  const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(userId) as { tier: number } | undefined
  let tier = user?.tier ?? 0
  const last = db.prepare('SELECT week_id, user_id, tier, cohort, xp FROM league_entries WHERE user_id = ? AND week_id < ? ORDER BY week_id DESC LIMIT 1').get(userId, currentWeek) as
    | Entry
    | undefined
  if (!last) return tier

  const cohort = rankedCohort(db, last.week_id, last.tier, last.cohort)
  const rank = cohort.findIndex((r) => r.user_id === userId) + 1
  if (rank >= 1 && rank <= PROMOTE_TOP && last.xp > 0) tier = Math.min(TIERS.length - 1, last.tier + 1)
  else if (cohort.length >= MIN_COHORT_FOR_DEMOTION && rank > cohort.length - DEMOTE_BOTTOM) tier = Math.max(0, last.tier - 1)
  else tier = last.tier

  db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, userId)
  return tier
}

function joinCohort(db: Db, week: string, tier: number): number {
  const open = db
    .prepare(
      `SELECT cohort, COUNT(*) AS members FROM league_entries
        WHERE week_id = ? AND tier = ?
        GROUP BY cohort HAVING members < ?
        ORDER BY cohort DESC LIMIT 1`
    )
    .get(week, tier, COHORT_SIZE) as { cohort: number } | undefined
  if (open) return open.cohort
  const max = db.prepare('SELECT MAX(cohort) AS c FROM league_entries WHERE week_id = ? AND tier = ?').get(week, tier) as { c: number | null }
  return (max.c ?? 0) + 1
}

/** Record the learner's XP for the week (idempotent: the value only ever grows). Call inside a transaction. */
export function recordWeeklyXp(db: Db, userId: number, week: string, weeklyXp: number): void {
  const xp = Math.max(0, Math.min(MAX_WEEKLY_XP, Math.floor(weeklyXp)))
  if (xp <= 0) return
  const existing = db.prepare('SELECT xp FROM league_entries WHERE week_id = ? AND user_id = ?').get(week, userId) as { xp: number } | undefined
  if (existing) {
    if (xp > existing.xp) db.prepare('UPDATE league_entries SET xp = ? WHERE week_id = ? AND user_id = ?').run(xp, week, userId)
    return
  }
  const tier = settleTier(db, userId, week)
  const cohort = joinCohort(db, week, tier)
  db.prepare('INSERT INTO league_entries (week_id, user_id, tier, cohort, xp) VALUES (?, ?, ?, ?, ?)').run(week, userId, tier, cohort, xp)
}

export function leagueView(db: Db, userId: number, week: string): LeagueView {
  const entry = db.prepare('SELECT week_id, user_id, tier, cohort, xp FROM league_entries WHERE week_id = ? AND user_id = ?').get(week, userId) as Entry | undefined
  if (!entry) {
    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(userId) as { tier: number } | undefined
    const tier = user?.tier ?? 0
    return { weekId: week, tier, tierName: TIERS[tier] ?? TIERS[0], joined: false, promoteTop: PROMOTE_TOP, demoteBottom: DEMOTE_BOTTOM, entries: [] }
  }
  const entries = rankedCohort(db, week, entry.tier, entry.cohort).map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    name: r.name,
    guide: r.guide,
    xp: r.xp,
    me: r.user_id === userId,
  }))
  return { weekId: week, tier: entry.tier, tierName: TIERS[entry.tier] ?? TIERS[0], joined: true, promoteTop: PROMOTE_TOP, demoteBottom: DEMOTE_BOTTOM, entries }
}
