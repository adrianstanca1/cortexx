'use client'

import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}

/**
 * Simple shimmering skeleton placeholder for loading states.
 */
export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <div
      className={styles.skeleton}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  )
}
