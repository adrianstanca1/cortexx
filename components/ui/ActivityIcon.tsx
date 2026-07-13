'use client'

import {
  IcCheck,
  IcCamera,
  IcSpark,
  IcPin,
  IcReceipt,
  IcTruck,
  IcDoc,
  IcAlert,
  IcWrench,
  IcTrash,
  IcHardhat,
  IcClock,
  IcFlag,
} from './Icons'

interface ActivityIconProps {
  iconType?: string | null
  size?: number
  color?: string
}

/**
 * Map activity iconType values to rendered icons. Falls back to a generic
 * clock icon for unknown types so the UI never renders nothing.
 */
export default function ActivityIcon({ iconType, size = 14, color }: ActivityIconProps) {
  const c = color || '#8ea8c5'
  switch (iconType) {
    case 'check':
      return <IcCheck size={size} color={c} />
    case 'camera':
      return <IcCamera size={size} color={c} />
    case 'spark':
      return <IcSpark size={size} color={c} />
    case 'pin':
      return <IcPin size={size} color={c} />
    case 'receipt':
      return <IcReceipt size={size} color={c} />
    case 'truck':
      return <IcTruck size={size} color={c} />
    case 'doc':
      return <IcDoc size={size} color={c} />
    case 'alert':
      return <IcAlert size={size} color={c} />
    case 'wrench':
      return <IcWrench size={size} color={c} />
    case 'trash':
      return <IcTrash size={size} color={c} />
    case 'hardhat':
      return <IcHardhat size={size} color={c} />
    case 'flag':
      return <IcFlag size={size} color={c} />
    default:
      return <IcClock size={size} color={c} />
  }
}
