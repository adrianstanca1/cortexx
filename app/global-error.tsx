'use client'

/**
 * Root-level error boundary. Catches errors in the root layout itself
 * (which `app/error.tsx` can't, because that one renders INSIDE the
 * root layout). Has to declare its own <html> / <body> since at this
 * point in the tree the root layout has failed and Next won't render
 * one for us.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */
import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: window.location.href,
          digest: error.digest,
          scope: 'global',
        }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: '#06101e', margin: 0, minHeight: '100dvh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, color: '#ef4444', fontWeight: 700 }}>!</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', margin: 0 }}>Application error</h1>
          <p style={{ fontSize: 13, color: '#8ea8c5', textAlign: 'center', maxWidth: 360, margin: 0 }}>
            Something failed at the root of the application. We&rsquo;ve been notified and will look into it.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: '#52749a', fontFamily: 'ui-monospace, monospace', margin: 0 }}>
              ref: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={reset}
              style={{ background: '#f59e0b', color: '#06101e', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{ background: 'transparent', color: '#8ea8c5', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
            >
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
