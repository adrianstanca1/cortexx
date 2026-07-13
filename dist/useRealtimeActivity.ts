'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Activity } from './types'
import { subscribe } from './broadcast'

interface State {
  activities: Activity[]
  connected: boolean
  error: string | null
}

/**
 * Subscribe to /api/events/stream and prepend new activities as they arrive.
 * Also listens on BroadcastChannel so same-origin sibling tabs can push new
 * activities instantly, without waiting for the SSE round-trip.
 * `initial` seeds the list (e.g. from useDashboardData).
 */
export function useRealtimeActivity(initial: Activity[] = []): State {
  const [activities, setActivities] = useState<Activity[]>(initial)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connectedRef = useRef(false)
  useEffect(() => { connectedRef.current = connected }, [connected])

  // Reseed when `initial` reference changes (e.g. after refetch). We hash all
  // IDs so any content/order change is detected, not just length/first-ID.
  const initialKey = initial.map(a => a.id).join(',')
  const [prevKey, setPrevKey] = useState(initialKey)
  useEffect(() => {
    if (prevKey === initialKey) return
    setPrevKey(initialKey)
    setActivities(initial)
  }, [initialKey, initial, prevKey, setPrevKey])

  // Prepend a fresh activity if we haven't seen it yet. Wrapped in useCallback
  // so it can be shared between SSE and BroadcastChannel paths.
  const prepend = useCallback((incoming: Activity | Activity[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming]
    setActivities(prev => {
      const seen = new Set(prev.map(a => a.id))
      const fresh = list.filter(a => a && a.id && !seen.has(a.id))
      if (fresh.length === 0) return prev
      return [...fresh.reverse(), ...prev].slice(0, 50)
    })
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let aborted = false

    const baseDelay = 3000
    const maxDelay = 30000
    // Full jitter: wait a random portion of the exponential backoff window.
    const backoff = () => {
      const cap = Math.min(baseDelay * 2 ** attempt, maxDelay)
      attempt++
      return Math.floor(Math.random() * cap)
    }

    const connect = () => {
      if (aborted || typeof EventSource === 'undefined') return
      try {
        es = new EventSource('/api/events/stream')

        es.addEventListener('ready', () => {
          attempt = 0
          setConnected(true)
          setError(null)
        })

        es.addEventListener('activity', (e: MessageEvent) => {
          try {
            const incoming = JSON.parse(e.data) as Activity[]
            prepend(incoming)
          } catch {}
        })

        es.onerror = () => {
          setConnected(false)
          setError('Reconnecting…')
          es?.close()
          if (aborted) return
          const delay = backoff()
          reconnectTimer = setTimeout(connect, delay)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect')
      }
    }

    // Cross-tab fast path: sibling tabs broadcast new activities immediately.
    const unsubBroadcast = subscribe(msg => {
      if (msg.type === 'activity:new' && msg.activity) {
        prepend(msg.activity)
      }
    })

    // Pause/resume SSE when the tab is hidden/visible to save queries and
    // reconnect promptly when the user returns.
    const onVisibility = () => {
      if (document.hidden) return
      // If currently disconnected, retry immediately with reset backoff.
      if (!connectedRef.current && !aborted) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        attempt = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    connect()

    return () => {
      aborted = true
      unsubBroadcast()
      document.removeEventListener('visibilitychange', onVisibility)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [prepend])

  return { activities, connected, error }
}
