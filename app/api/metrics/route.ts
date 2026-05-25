import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const VITAL_NAMES = new Set(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'])

/**
 * Core Web Vitals beacon. Reports are public (no auth) — they may fire
 * after sign-out, before sign-in, on the public marketing page, etc.
 * Rate-limited per IP so a malicious page can't flood the sink.
 *
 * Body: { name: string, value: number, id: string, rating?: 'good' | 'needs-improvement' | 'poor', url?: string }
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'write')
  if (limited) return limited
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name : ''
    if (!VITAL_NAMES.has(name)) {
      return NextResponse.json({ error: 'Unknown metric' }, { status: 400 })
    }
    const value = typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : null
    if (value === null) return NextResponse.json({ error: 'Missing value' }, { status: 400 })
    const id = typeof body.id === 'string' ? body.id.slice(0, 64) : ''
    const rating = typeof body.rating === 'string' ? body.rating.slice(0, 32) : null
    const url = typeof body.url === 'string' ? body.url.slice(0, 200) : null
    const ua = req.headers.get('user-agent')?.slice(0, 120) || null

    // For v1.0 — log to stdout (pm2 → journal). pm2 logs ship to the
    // PUBLIC vps-exec-logs branch, so we strip the URL down to the
    // pathname (no query / hash that might carry customer-name slugs,
    // search terms, etc.) and drop the user-agent string entirely
    // (it doesn't change with content but does narrow fingerprinting).
    const pathOnly = url ? (() => { try { return new URL(url, 'https://x').pathname.slice(0, 120) } catch { return '' } })() : null
    console.log('[web-vitals]', JSON.stringify({
      name, value: Math.round(value * 100) / 100, id, rating, path: pathOnly,
      at: new Date().toISOString(),
    }))
    // Ua intentionally NOT logged — see comment above.
    void ua

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to record' }, { status: 500 })
  }
}
