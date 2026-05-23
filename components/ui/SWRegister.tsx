'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker in production only.
 * The SW handles offline fallback + caches static assets.
 * Dev mode is skipped so HMR isn't blocked by stale cached chunks.
 */
export default function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failures are non-critical */
    })
  }, [])

  return null
}
