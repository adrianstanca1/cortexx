'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to backend (best-effort)
    if (typeof window !== 'undefined') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: window.location.href,
        }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [error])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 28, color: '#ef4444' }}>!</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-system)', fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.02em' }}>
        Something went wrong
      </h1>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', textAlign: 'center', maxWidth: 320 }}>
        {error.message || 'An unexpected error occurred. The team has been notified.'}
      </p>
      <button
        onClick={reset}
        style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
      >
        Try again
      </button>
      <a href="/dashboard" style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a', textDecoration: 'none' }}>
        Go to dashboard →
      </a>
    </div>
  )
}
