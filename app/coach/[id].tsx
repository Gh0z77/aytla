import { useLocalSearchParams } from 'expo-router'
import { CoachChatScreen } from '../../src/features/coach/CoachChatScreen'

export default function CoachChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const scenarioId = Array.isArray(id) ? (id[0] ?? 'free') : (id ?? 'free')
  return <CoachChatScreen key={scenarioId} scenarioId={scenarioId} />
}
