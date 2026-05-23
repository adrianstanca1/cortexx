import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {}

  // Database
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true, ms: Date.now() - dbStart }
  } catch (e) {
    checks.database = { ok: false, ms: Date.now() - dbStart, error: e instanceof Error ? e.message : 'unknown' }
  }

  // App
  checks.app = { ok: true, ms: Date.now() - start }

  const allOk = Object.values(checks).every(c => c.ok)
  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks,
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
