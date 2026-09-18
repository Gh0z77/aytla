/**
 * ISO-8601 week id ('2026-W38', Monday start), the same algorithm the apps use
 * in src/core/time.ts. Kept as a separate copy so the server has no imports
 * outside its own package; server/test/time.test.ts pins the behaviour.
 */
const pad = (n: number) => (n < 10 ? `0${n}` : String(n))

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
