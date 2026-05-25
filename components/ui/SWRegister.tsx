'use client'

import { useEffect, useState } from 'react'

/**
 * Registers the service worker in production only.
 *
 * When a new SW version is waiting (skipWaiting hasn't claimed clients
 * because there's an active client), we show a small "update available"
 * toast that, on click, calls skipWaiting + reloads. This prevents the
 * "I'm seeing old code on production" class of bug.
 *
 * Dev mode is skipped so HMR isn't blocked by stale cached chunks.
 */
export default function SWRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let mounted = true
    // The 30-min update-poll interval was previously cleared by a
    // `return () => clearInterval` INSIDE the .then() callback — that
    // return value is the promise's resolved value, NOT the useEffect
    // cleanup. The interval was leaking across re-mounts / strict-mode
    // double-mount. Hoist the handle out so the effect cleanup can
    // see it.
    let updateInterval: ReturnType<typeof setInterval> | null = null
    navigator.serviceWorker.register('/sw.js').then(reg => {
      if (!mounted) return

      // If there's already a waiting worker, show prompt
      if (reg.waiting) setWaiting(reg.waiting)

      // Listen for new versions being found
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version installed but an old one is still controlling
            setWaiting(newWorker)
          }
        })
      })

      // Check for updates every 30 min
      updateInterval = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)
    }).catch(() => {
      /* registration failures are non-critical */
    })

    // When the new SW takes over, reload once so the user gets fresh code
    let didReload = false
    const onController = () => {
      if (didReload) return
      didReload = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)

    return () => {
      mounted = false
      if (updateInterval) clearInterval(updateInterval)
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
    }
  }, [])

  if (!waiting) return null

  const apply = () => {
    waiting.postMessage({ type: 'SKIP_WAITING' })
    // controllerchange handler will reload
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
        zIndex: 140,
        background: '#0c1a2e',
        border: '1px solid rgba(245,158,11,0.4)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ flex: 1, fontFamily: 'var(--font-system)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef3fa' }}>New version available</div>
        <div style={{ fontSize: 11, color: '#8ea8c5', marginTop: 2 }}>Reload to get the latest Cortexx</div>
      </div>
      <button
        onClick={apply}
        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        Reload
      </button>
    </div>
  )
}
