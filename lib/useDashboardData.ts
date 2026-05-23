'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DashboardData } from './types'

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    fetch('/api/dashboard')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load dashboard data')
        return r.json()
      })
      .then(d => { setData(d); setError(null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchData()
    // Refetch when tab regains focus (user returns from another tab/app)
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchData() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
