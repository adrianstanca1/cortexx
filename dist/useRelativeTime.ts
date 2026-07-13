'use client'

import { useEffect, useState } from 'react'

/**
 * Return a live-updating relative label such as "2m ago", "1h ago", "3d ago".
 * Updates every 30 seconds so the label stays fresh while the tab is open.
 * SSR-safe: returns the initial label on first render.
 */
export function useRelativeTime(isoDate: string): string {
  const compute = (from: number): string => {
    const ms = from - new Date(isoDate).getTime()
    if (Number.isNaN(ms)) return ''
    const mins = Math.max(0, Math.round(ms / 60000))
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.round(mins / 60)}h`
    return `${Math.round(mins / 1440)}d`
  }

  const [label, setLabel] = useState(() => compute(Date.now()))

  useEffect(() => {
    setLabel(compute(Date.now()))
    const id = setInterval(() => setLabel(compute(Date.now())), 30000)
    return () => clearInterval(id)
  }, [isoDate])

  return label
}

/**
 * Format a timestamp as "2m ago · 14:32" for hover titles / full dates.
 */
export function formatAbsolute(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
