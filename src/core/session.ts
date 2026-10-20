import type { Exercise, LessonResult, SessionKind } from './types'

/**
 * Lesson session state machine (pure, immutable updates).
 *
 * - Exercises are answered in queue order.
 * - A wrong answer costs a heart (handled by the caller) and the exercise is
 *   re-queued at the end, so every lesson ends with everything answered right.
 * - Progress = exercises cleared / total, so it never moves backwards.
 */
export interface SessionState {
  kind: SessionKind
  lessonId: string | null
  exercises: Exercise[]
  /** indices into `exercises` still to be answered; [0] is the current one */
  queue: number[]
  cleared: number
  mistakes: number
  /** item ids answered wrong at least once */
  missed: string[]
  /** first-attempt outcome per item id */
  firstAttempts: Record<string, boolean>
  combo: number
  maxCombo: number
  startedAt: number
}

export function startSession(kind: SessionKind, lessonId: string | null, exercises: Exercise[], now: number): SessionState {
  return {
    kind,
    lessonId,
    exercises,
    queue: exercises.map((_, i) => i),
    cleared: 0,
    mistakes: 0,
    missed: [],
    firstAttempts: {},
    combo: 0,
    maxCombo: 0,
    startedAt: now,
  }
}

export function currentExercise(state: SessionState): Exercise | null {
  const index = state.queue[0]
  return index === undefined ? null : (state.exercises[index] ?? null)
}

export function isFinished(state: SessionState): boolean {
  return state.queue.length === 0
}

export function sessionProgress(state: SessionState): number {
  return state.exercises.length === 0 ? 1 : state.cleared / state.exercises.length
}

function itemIdsOf(ex: Exercise): string[] {
  return ex.kind === 'match' ? ex.pairs.map((p) => p.id) : [ex.itemId]
}

/**
 * Record the outcome of the current exercise.
 *
 * `wrongItemIds` lets a match exercise report exactly which pairs were missed.
 * A match is always finished by the learner (every pair ends up matched), so it
 * is recorded as cleared (`correct = true`) while its slipped pairs still count
 * as weak items for spaced repetition.
 */
export function answer(state: SessionState, correct: boolean, wrongItemIds?: readonly string[]): SessionState {
  const index = state.queue[0]
  if (index === undefined) return state
  const ex = state.exercises[index]
  if (!ex) return state

  const rest = state.queue.slice(1)
  const firstAttempts = { ...state.firstAttempts }
  const wrong = new Set(wrongItemIds ?? (correct ? [] : itemIdsOf(ex)))
  itemIdsOf(ex).forEach((id) => {
    if (!(id in firstAttempts)) firstAttempts[id] = !wrong.has(id)
  })
  const missed = [...state.missed]
  wrong.forEach((id) => !missed.includes(id) && missed.push(id))

  if (correct) {
    const combo = wrong.size === 0 ? state.combo + 1 : 0
    return { ...state, queue: rest, cleared: state.cleared + 1, missed, firstAttempts, combo, maxCombo: Math.max(state.maxCombo, combo) }
  }
  return { ...state, queue: [...rest, index], mistakes: state.mistakes + 1, missed, firstAttempts, combo: 0 }
}

/** Drop the current exercise without penalty ("can't listen / speak now"). */
export function skip(state: SessionState): SessionState {
  if (state.queue.length === 0) return state
  return { ...state, queue: state.queue.slice(1), cleared: state.cleared + 1 }
}

/** Drop every remaining exercise of the given kinds (learner turned listening or speaking off mid-lesson). */
export function dropKinds(state: SessionState, kinds: ReadonlyArray<Exercise['kind']>): SessionState {
  const [head, ...tail] = state.queue
  if (head === undefined) return state
  const keep = tail.filter((i) => !kinds.includes((state.exercises[i] as Exercise).kind))
  const dropped = tail.length - keep.length
  return { ...state, queue: [head, ...keep], cleared: state.cleared + dropped }
}

export function toResult(state: SessionState, now: number): LessonResult {
  return {
    sessionKind: state.kind,
    lessonId: state.lessonId,
    items: Object.entries(state.firstAttempts).map(([itemId, correct]) => ({ itemId, correct })),
    total: state.exercises.length,
    mistakes: state.mistakes,
    maxCombo: state.maxCombo,
    seconds: Math.max(1, Math.round((now - state.startedAt) / 1000)),
    // skipped speaking rounds leave no first attempt behind, so they are not counted
    spoken: state.exercises.filter((ex) => (ex.kind === 'say' || ex.kind === 'speak') && ex.itemId in state.firstAttempts).length,
  }
}
