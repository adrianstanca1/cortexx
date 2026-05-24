'use client'

import { useEffect, useState } from 'react'
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

  // Reseed when `initial` reference changes (e.g. after refetch). The React 19
  // idiom: detect the change during render against a sentinel state and adjust.
  const initialKey = `${initial.length}|${initial[0]?.id || ''}`
  const [prevKey, setPrevKey] = useState(initialKey)
  if (prevKey !== initialKey) {
    setPrevKey(initialKey)
    setActivities(initial)
  }

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
            // Dedup against current state inside the updater so we don't need
            // a parallel ref (which React 19 flags if written during render).
            setActivities(prev => {
              const seen = new Set(prev.map(a => a.id))
              const fresh = incoming.filter(a => !seen.has(a.id))
              if (fresh.length === 0) return prev
              return [...fresh.reverse(), ...prev].slice(0, 50)
            })
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
