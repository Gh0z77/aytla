import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native'
import type { CharacterId } from '../core/types'

/** The six approved EVEREST guides (transparent cut-outs copied from EVEREST/assets/brand/characters). */
const SOURCES: Record<CharacterId, ImageSourcePropType> = {
  everest: require('../../assets/characters/everest.png'),
  lumi: require('../../assets/characters/lumi.png'),
  pix: require('../../assets/characters/pix.png'),
  nubi: require('../../assets/characters/nubi.png'),
  rocky: require('../../assets/characters/rocky.png'),
  aero: require('../../assets/characters/aero.png'),
}

export const GUIDES: Array<{ id: CharacterId; name: string }> = [
  { id: 'everest', name: 'Everest' },
  { id: 'lumi', name: 'Lumi' },
  { id: 'pix', name: 'Pix' },
  { id: 'nubi', name: 'Nubi' },
  { id: 'rocky', name: 'Rocky' },
  { id: 'aero', name: 'Aero' },
]

interface Props {
  id: CharacterId
  size?: number
  style?: StyleProp<ImageStyle>
}

export function Mascot({ id, size = 96, style }: Props) {
  return <Image source={SOURCES[id]} style={[{ width: size, height: size }, style]} resizeMode="contain" accessibilityIgnoresInvertColors />
}
