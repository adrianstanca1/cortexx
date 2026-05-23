'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { DashboardData } from './types'

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track the latest activity timestamp seen — used to debounce SSE-triggered refetches
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(() => {
    fetch('/api/dashboard')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load dashboard data')
        return r.json()
      })
      .then(d => { setData(d); setError(null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Debounced refetch — coalesce bursts of SSE events into a single API call
  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(fetchData, 800)
  }, [fetchData])

  useEffect(() => {
    fetchData()
    // Refetch when tab regains focus
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', onVisibility)
    // Background poll every 30s while tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData()
    }, 30000)

    // Subscribe to SSE — refetch whenever new activity hits the server.
    // This is what makes ALL 12 dashboard variants live, not just the ones
    // that render an activity list.
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const connect = () => {
      try {
        es = new EventSource('/api/events/stream')
        es.addEventListener('activity', () => refetchSoon())
        es.onerror = () => {
          es?.close()
          reconnectTimer = setTimeout(connect, 5000)
        }
      } catch { /* ignore */ }
    }
    connect()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
      if (refetchTimer.current) clearTimeout(refetchTimer.current)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [fetchData, refetchSoon])

  return { data, loading, error, refetch: fetchData }
}
