import { NextResponse } from 'next/server'
import { statfs } from 'node:fs/promises'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Check {
  ok: boolean
  ms?: number
  error?: string
  free_gb?: number
  rss_mb?: number
}

export async function GET() {
  const start = Date.now()
  const checks: Record<string, Check> = {}

  // Database
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true, ms: Date.now() - dbStart }
  } catch (e) {
    checks.database = { ok: false, ms: Date.now() - dbStart, error: e instanceof Error ? e.message : 'unknown' }
  }

  // Disk space (where the app runs)
  try {
    const stats = await statfs(process.cwd())
    const freeBytes = Number(stats.bavail) * Number(stats.bsize)
    const freeGb = freeBytes / 1024 ** 3
    checks.disk = { ok: freeGb > 1, free_gb: Math.round(freeGb * 100) / 100 }
  } catch {
    checks.disk = { ok: true } // best-effort; don't fail health on disk-stat unavailable
  }

  // Memory (process RSS)
  const mem = process.memoryUsage()
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10
  checks.memory = { ok: rssMb < 1024, rss_mb: rssMb }

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
