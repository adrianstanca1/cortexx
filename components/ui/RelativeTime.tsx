'use client'

import { useRelativeTime, formatAbsolute } from '@/lib/useRelativeTime'

interface RelativeTimeProps {
  date: string
}

/**
 * Live-updating relative timestamp with a tooltip showing the absolute date.
 */
export default function RelativeTime({ date }: RelativeTimeProps) {
  const label = useRelativeTime(date)
  return (
    <span title={formatAbsolute(date)} style={{ whiteSpace: 'nowrap' }}>
      {label} ago
    </span>
  )
}
