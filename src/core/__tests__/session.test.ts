import { describe, expect, it } from 'vitest'
import { answer, currentExercise, dropKinds, isFinished, sessionProgress, skip, startSession, toResult } from '../session'
import type { Exercise } from '../types'

const typeEx = (n: number): Exercise => ({ kind: 'type', id: `e${n}`, itemId: `s${n}`, prompt: 'p', answers: ['a'], audio: 'a' })
const matchEx: Exercise = { kind: 'match', id: 'm', pairs: [{ id: 'w1', en: 'a', native: 'b' }, { id: 'w2', en: 'c', native: 'd' }, { id: 'w3', en: 'e', native: 'f' }] }
const listenEx: Exercise = { kind: 'listen', id: 'l', itemId: 's9', mode: 'type', audio: 'a', tokens: [], answers: ['a'], translation: 't' }

describe('session', () => {
  it('walks through exercises in order and finishes', () => {
    let s = startSession('lesson', 'u01-l1', [typeEx(1), typeEx(2)], 1000)
    expect(currentExercise(s)?.id).toBe('e1')
    s = answer(s, true)
    expect(currentExercise(s)?.id).toBe('e2')
    expect(sessionProgress(s)).toBe(0.5)
    s = answer(s, true)
    expect(isFinished(s)).toBe(true)
    expect(currentExercise(s)).toBeNull()
    expect(sessionProgress(s)).toBe(1)
  })

  it('re-queues a wrong answer at the end and never moves progress backwards', () => {
    let s = startSession('lesson', 'u01-l1', [typeEx(1), typeEx(2)], 0)
    s = answer(s, false)
    expect(s.mistakes).toBe(1)
    expect(sessionProgress(s)).toBe(0)
    expect(currentExercise(s)?.id).toBe('e2')
    s = answer(s, true)
    expect(currentExercise(s)?.id).toBe('e1')
    s = answer(s, true)
    expect(isFinished(s)).toBe(true)
  })

  it('tracks combo and resets it on a mistake', () => {
    let s = startSession('lesson', null, [typeEx(1), typeEx(2), typeEx(3), typeEx(4)], 0)
    s = answer(answer(s, true), true)
    expect(s.combo).toBe(2)
    s = answer(s, false)
    expect(s.combo).toBe(0)
    expect(s.maxCombo).toBe(2)
  })

  it('records only the first attempt per item', () => {
    let s = startSession('lesson', 'x', [typeEx(1)], 0)
    s = answer(s, false)
    s = answer(s, true)
    const result = toResult(s, 5000)
    expect(result.items).toEqual([{ itemId: 's1', correct: false }])
    expect(result.mistakes).toBe(1)
    expect(result.total).toBe(1)
    expect(result.seconds).toBe(5)
  })

  it('lets a match exercise report which pairs were missed', () => {
    let s = startSession('lesson', 'x', [matchEx], 0)
    s = answer(s, false, ['w2'])
    expect(s.missed).toEqual(['w2'])
    expect(s.firstAttempts).toEqual({ w1: true, w2: false, w3: true })
  })

  it('skips without penalty and can drop kinds mid-lesson', () => {
    let s = startSession('lesson', 'x', [typeEx(1), listenEx, typeEx(2)], 0)
    s = dropKinds(s, ['listen'])
    expect(s.queue.length).toBe(2)
    expect(s.cleared).toBe(1)
    s = skip(s)
    expect(s.mistakes).toBe(0)
    expect(currentExercise(s)?.id).toBe('e2')
  })
})
