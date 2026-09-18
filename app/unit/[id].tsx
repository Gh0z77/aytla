import { useLocalSearchParams } from 'expo-router'
import { UnitScreen } from '../../src/features/unit/UnitScreen'

export default function UnitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <UnitScreen unitId={Array.isArray(id) ? (id[0] ?? '') : (id ?? '')} />
}
