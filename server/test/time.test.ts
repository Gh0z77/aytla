import { describe, expect, it } from 'vitest'
import { weekId } from '../src/time.ts'

// the same cases as src/core/__tests__/progress.test.ts, so the two copies cannot drift apart unnoticed
describe('weekId', () => {
  it('computes ISO weeks, including the year boundary', () => {
    expect(weekId(new Date(2026, 8, 14))).toBe('2026-W38')
    expect(weekId(new Date(2026, 8, 13))).toBe('2026-W37')
    expect(weekId(new Date(2027, 0, 1))).toBe('2026-W53')
    expect(weekId(new Date(2027, 0, 4))).toBe('2027-W01')
  })
})
