'use client'

import { useEffect } from 'react'

/**
 * Reports Core Web Vitals to /api/metrics. Samples at the rate set via
 * NEXT_PUBLIC_VITALS_SAMPLE_RATE (default 0.1 = 10% of sessions). Use
 * sendBeacon when available so the report survives unload.
 *
 * Mount once at the root layout. SSR-safe (effect only runs on client).
 */
export default function WebVitalsReporter() {
  useEffect(() => {
    const sampleRate = parseFloat(process.env.NEXT_PUBLIC_VITALS_SAMPLE_RATE || '0.1')
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) return
    if (Math.random() > sampleRate) return

    let cancelled = false

    import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      if (cancelled) return
      type Metric = { name: string; value: number; id: string; rating?: string }
      const report = (metric: Metric) => {
        const body = JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          rating: metric.rating,
          url: typeof location !== 'undefined' ? location.pathname : undefined,
        })
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const blob = new Blob([body], { type: 'application/json' })
            navigator.sendBeacon('/api/metrics', blob)
            return
          }
        } catch { /* fall through */ }
        fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {})
      }
      onCLS(report)
      onFCP(report)
      onINP(report)
      onLCP(report)
      onTTFB(report)
    }).catch(() => { /* web-vitals not installed — silent */ })

    return () => { cancelled = true }
  }, [])

  return null
}
