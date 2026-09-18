import { useLocalSearchParams } from 'expo-router'
import { LessonPlayer } from '../../src/features/lesson/LessonPlayer'

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const lessonId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '')
  // keyed so that going from a lesson straight into practice starts a fresh session
  return <LessonPlayer key={lessonId} lessonId={lessonId} />
}
