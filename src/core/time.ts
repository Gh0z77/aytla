/**
 * Day and week arithmetic in the learner's local time zone.
 * Day keys are 'YYYY-MM-DD'; week ids are ISO weeks 'YYYY-Www' (Monday start).
 */

const pad = (n: number) => (n < 10 ? `0${n}` : String(n))

export function dayKey(now: number | Date): string {
  const d = typeof now === 'number' ? new Date(now) : now
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function addDays(key: string, days: number): string {
  const d = parseDay(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000)
}

/** ISO-8601 week id, e.g. '2026-W38'. */
export function weekId(now: number | Date): string {
  const src = typeof now === 'number' ? new Date(now) : now
  const d = new Date(src.getFullYear(), src.getMonth(), src.getDate(), 12)
  const weekday = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - weekday + 3) // Thursday of this ISO week
  const isoYear = d.getFullYear()
  const jan4 = new Date(isoYear, 0, 4, 12)
  const jan4Weekday = (jan4.getDay() + 6) % 7
  const week1Thursday = new Date(isoYear, 0, 4 - jan4Weekday + 3, 12)
  const week = 1 + Math.round((d.getTime() - week1Thursday.getTime()) / (7 * 86_400_000))
  return `${isoYear}-W${pad(week)}`
}

/** The last `count` day keys ending today, oldest first. */
export function lastDays(now: number | Date, count: number): string[] {
  const today = dayKey(now)
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(addDays(today, -i))
  return out
}
