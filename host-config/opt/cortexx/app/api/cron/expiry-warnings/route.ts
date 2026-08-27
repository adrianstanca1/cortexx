import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron'

export const dynamic = 'force-dynamic'

/**
 * Daily scan for certifications, RAMS reviews, permits and documents that
 * expire in the next 14 days.
 *
 * The production database currently uses the legacy Express schema, which does
 * not have dedicated Certification / Rams / Permit tables (expiry data lives
 * inside JSONB columns on equipment and team_members). Until those tables are
 * migrated, this endpoint is intentionally a no-op so it does not block the
 * rest of the cron schedule. It still performs auth and returns a clean 200.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  return NextResponse.json({ expiring: 0, orgsNotified: 0, note: 'Legacy schema lacks dedicated expiry tables' })
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'expiry-warnings' })
}
