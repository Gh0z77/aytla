import { courseFor } from '../content/course'
import type { Course, TargetLang } from '../core/types'
import { useApp } from './store'

/** The course the learner is on: the authored content in their target language. */
export const targetOf = (profile: { target?: TargetLang }): TargetLang => profile.target ?? 'en'

export function useTarget(): TargetLang {
  return useApp((s) => s.user.profile.target ?? 'en')
}

export function useCourse(): Course {
  return courseFor(useTarget())
}

export const currentCourse = (): Course => courseFor(targetOf(useApp.getState().user.profile))
