'use client'

import { useEffect, useRef, useState } from 'react'
import type { Activity } from './types'

interface State {
  activities: Activity[]
  connected: boolean
  error: string | null
}

/**
 * Subscribe to /api/events/stream and prepend new activities as they arrive.
 * `initial` seeds the list (e.g. from useDashboardData).
 */
export function useRealtimeActivity(initial: Activity[] = []): State {
  const [activities, setActivities] = useState<Activity[]>(initial)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seenIds = useRef<Set<string>>(new Set(initial.map(a => a.id)))

  // Reseed when `initial` reference changes (e.g. after refetch)
  useEffect(() => {
    setActivities(initial)
    seenIds.current = new Set(initial.map(a => a.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.length, initial[0]?.id])

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      try {
        es = new EventSource('/api/events/stream')
        es.addEventListener('ready', () => { setConnected(true); setError(null) })

        es.addEventListener('activity', (e: MessageEvent) => {
          try {
            const incoming = JSON.parse(e.data) as Activity[]
            const fresh = incoming.filter(a => !seenIds.current.has(a.id))
            if (fresh.length === 0) return
            fresh.forEach(a => seenIds.current.add(a.id))
            setActivities(prev => [...fresh.reverse(), ...prev].slice(0, 50))
          } catch {}
        })

        es.onerror = () => {
          setConnected(false)
          setError('Reconnecting…')
          es?.close()
          // Backoff reconnect after 3s
          reconnectTimer = setTimeout(connect, 3000)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect')
      }
    }

    connect()
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [])

  return { activities, connected, error }
}
