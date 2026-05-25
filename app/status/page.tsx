'use client'

/**
 * Public-ish status page. /api/health is the underlying source of truth
 * — this page polls it every 30s and renders a friendly green/red/grey
 * board. Anyone can reach this page; the only data shown is whether
 * each subsystem is reachable (no PII).
 *
 * Linked from /support and added as an SLA-style trust signal.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IcChevL, IcCheck, IcAlert } from '@/components/ui/Icons'

interface HealthCheck {
  ok: boolean
  ms?: number
  error?: string
  free_gb?: number
  rss_mb?: number
}

interface HealthResponse {
  status: 'ok' | 'degraded'
  checks: Record<string, HealthCheck>
  ts: string
}

const CHECK_LABEL: Record<string, string> = {
  database: 'Database',
  disk: 'Disk',
  memory: 'Memory',
  app: 'Application',
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' })
      const d = await r.json()
      setHealth(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach status endpoint')
    } finally {
      setLoading(false)
      setLastFetched(new Date())
    }
  }

  useEffect(() => {
    fetchHealth()
    const i = setInterval(() => {
      if (document.visibilityState === 'visible') fetchHealth()
    }, 30000)
    return () => clearInterval(i)
  }, [])

  const overall = error ? 'unreachable' : health?.status || 'unknown'

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', padding: '20px 20px 100px', fontFamily: 'var(--font-system)' }}>
      <Link href="/support" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
        <IcChevL size={18} color="#52749a" />
        <span style={{ fontSize: 13, color: '#52749a' }}>Support</span>
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', margin: 0 }}>
        System status
      </h1>
      <p style={{ fontSize: 13, color: '#8ea8c5', margin: '4px 0 24px' }}>
        Live health of Cortex AI, sync, and database — auto-refreshes every 30s.
        {lastFetched && <> Last checked {lastFetched.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.</>}
      </p>

      <div
        style={{
          background: overall === 'ok' ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.04))' :
                       overall === 'degraded' ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.04))' :
                       'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.04))',
          border: '0.5px solid ' + (overall === 'ok' ? 'rgba(16,185,129,0.3)' :
                                      overall === 'degraded' ? 'rgba(245,158,11,0.3)' :
                                      'rgba(239,68,68,0.3)'),
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: overall === 'ok' ? '#10b981' : overall === 'degraded' ? '#f59e0b' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {overall === 'ok' ? <IcCheck size={24} color="#06101e" /> : <IcAlert size={24} color="#06101e" />}
        </div>
        <div>
          <div style={{ fontSize: 18, color: '#eef3fa', fontWeight: 700 }}>
            {overall === 'ok' && 'All systems operational'}
            {overall === 'degraded' && 'Degraded service'}
            {overall === 'unreachable' && 'Status endpoint unreachable'}
            {overall === 'unknown' && (loading ? 'Checking…' : 'Unknown')}
          </div>
          <div style={{ fontSize: 12, color: '#8ea8c5', marginTop: 2 }}>
            {error || (health && `${Object.values(health.checks).filter(c => c.ok).length} of ${Object.keys(health.checks).length} checks passing`)}
          </div>
        </div>
      </div>

      {health && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(health.checks).map(([key, c]) => (
            <li
              key={key}
              style={{
                background: '#152641',
                borderRadius: 12,
                padding: '14px 16px',
                border: '0.5px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: c.ok ? '#10b981' : '#ef4444',
                  flexShrink: 0,
                  boxShadow: c.ok ? '0 0 6px #10b98166' : '0 0 6px #ef444466',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#eef3fa', fontWeight: 600 }}>
                  {CHECK_LABEL[key] || key}
                </div>
                <div style={{ fontSize: 11, color: '#8ea8c5', marginTop: 2 }}>
                  {c.ok ? 'Operational' : c.error || 'Failed'}
                  {typeof c.ms === 'number' && ` · ${c.ms}ms`}
                  {typeof c.free_gb === 'number' && ` · ${c.free_gb}GB free`}
                  {typeof c.rss_mb === 'number' && ` · ${c.rss_mb}MB RSS`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 11, color: '#52749a', marginTop: 20, textAlign: 'center' }}>
        Subscribe to incident updates via your account&rsquo;s push notifications (enable in Settings).
      </p>
    </div>
  )
}
