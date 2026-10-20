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

type Ranked = { user_id: number; name: string; guide: string; xp: number }

function rankedCohort(db: Db, week: string, tier: number, cohort: number): Promise<Ranked[]> {
  return db.all<Ranked>(
    `SELECT e.user_id, u.name, u.guide, e.xp
       FROM league_entries e JOIN users u ON u.id = e.user_id
      WHERE e.week_id = ? AND e.tier = ? AND e.cohort = ?
      ORDER BY e.xp DESC, e.user_id ASC`,
    week,
    tier,
    cohort
  )
}

/** Apply last week's result to the learner's tier. Returns the tier to play in now. */
export async function settleTier(db: Db, userId: number, currentWeek: string): Promise<number> {
  const user = await db.get<{ tier: number }>('SELECT tier FROM users WHERE id = ?', userId)
  let tier = user?.tier ?? 0
  const last = await db.get<Entry>('SELECT week_id, user_id, tier, cohort, xp FROM league_entries WHERE user_id = ? AND week_id < ? ORDER BY week_id DESC LIMIT 1', userId, currentWeek)
  if (!last) return tier

  const cohort = await rankedCohort(db, last.week_id, last.tier, last.cohort)
  const rank = cohort.findIndex((r) => Number(r.user_id) === Number(userId)) + 1
  if (rank >= 1 && rank <= PROMOTE_TOP && last.xp > 0) tier = Math.min(TIERS.length - 1, last.tier + 1)
  else if (cohort.length >= MIN_COHORT_FOR_DEMOTION && rank > cohort.length - DEMOTE_BOTTOM) tier = Math.max(0, last.tier - 1)
  else tier = last.tier

  await db.run('UPDATE users SET tier = ? WHERE id = ?', tier, userId)
  return tier
}

async function joinCohort(db: Db, week: string, tier: number): Promise<number> {
  const open = await db.get<{ cohort: number }>(
    `SELECT cohort FROM league_entries
      WHERE week_id = ? AND tier = ?
      GROUP BY cohort HAVING COUNT(*) < ?
      ORDER BY cohort DESC LIMIT 1`,
    week,
    tier,
    COHORT_SIZE
  )
  if (open) return Number(open.cohort)
  const max = await db.get<{ c: number | null }>('SELECT MAX(cohort) AS c FROM league_entries WHERE week_id = ? AND tier = ?', week, tier)
  return Number(max?.c ?? 0) + 1
}

/** Record the learner's XP for the week (idempotent: the value only ever grows). Call inside a transaction. */
export async function recordWeeklyXp(db: Db, userId: number, week: string, weeklyXp: number): Promise<void> {
  const xp = Math.max(0, Math.min(MAX_WEEKLY_XP, Math.floor(weeklyXp)))
  if (xp <= 0) return
  const existing = await db.get<{ xp: number }>('SELECT xp FROM league_entries WHERE week_id = ? AND user_id = ?', week, userId)
  if (existing) {
    if (xp > existing.xp) await db.run('UPDATE league_entries SET xp = ? WHERE week_id = ? AND user_id = ?', xp, week, userId)
    return
  }
  const tier = await settleTier(db, userId, week)
  const cohort = await joinCohort(db, week, tier)
  await db.run('INSERT INTO league_entries (week_id, user_id, tier, cohort, xp) VALUES (?, ?, ?, ?, ?)', week, userId, tier, cohort, xp)
}

export async function leagueView(db: Db, userId: number, week: string): Promise<LeagueView> {
  const entry = await db.get<Entry>('SELECT week_id, user_id, tier, cohort, xp FROM league_entries WHERE week_id = ? AND user_id = ?', week, userId)
  if (!entry) {
    const user = await db.get<{ tier: number }>('SELECT tier FROM users WHERE id = ?', userId)
    const tier = user?.tier ?? 0
    return { weekId: week, tier, tierName: TIERS[tier] ?? TIERS[0], joined: false, promoteTop: PROMOTE_TOP, demoteBottom: DEMOTE_BOTTOM, entries: [] }
  }
  const entries = (await rankedCohort(db, week, entry.tier, entry.cohort)).map((r, i) => ({
    rank: i + 1,
    userId: Number(r.user_id),
    name: r.name,
    guide: r.guide,
    xp: r.xp,
    me: Number(r.user_id) === Number(userId),
  }))
  return { weekId: week, tier: entry.tier, tierName: TIERS[entry.tier] ?? TIERS[0], joined: true, promoteTop: PROMOTE_TOP, demoteBottom: DEMOTE_BOTTOM, entries }
}
