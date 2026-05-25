import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireCronAuth } from '@/lib/cron'
import { sendPush } from '@/lib/push'
import { bypassTenancy } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

/**
 * Daily scan for things that are about to expire in the next 14 days:
 * training certifications, RAMS reviews, permits valid-to.
 *
 * Each expiring item drives a single workspace-wide push so the team
 * notices without spamming once per device. UI links into the relevant
 * /training or /rams page.
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied
  return bypassTenancy(() => runExpiryScan())
}

async function runExpiryScan() {
  const now = new Date()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 14)

  const [certs, rams, permits] = await Promise.all([
    prisma.certification.findMany({
      where: { expiryDate: { gte: now, lte: horizon } },
      select: { id: true, type: true, expiryDate: true, member: { select: { name: true } } },
    }),
    prisma.rams.findMany({
      where: { reviewBy: { gte: now, lte: horizon } },
      select: { id: true, title: true, reviewBy: true },
    }),
    prisma.permit.findMany({
      where: { status: 'active', validTo: { gte: now, lte: horizon } },
      select: { id: true, type: true, validTo: true },
    }),
  ])

  const total = certs.length + rams.length + permits.length
  if (total === 0) {
    return NextResponse.json({ expiring: 0 })
  }

  // Headline notification — clicking lands on whichever module has the
  // most expiring items so the user can act immediately.
  const target =
    certs.length >= rams.length && certs.length >= permits.length ? '/training'
      : rams.length >= permits.length ? '/rams'
        : '/permits'

  const segs: string[] = []
  if (certs.length) segs.push(`${certs.length} cert${certs.length === 1 ? '' : 's'}`)
  if (rams.length) segs.push(`${rams.length} RAMS`)
  if (permits.length) segs.push(`${permits.length} permit${permits.length === 1 ? '' : 's'}`)

  sendPush({
    category: 'safety',
    payload: {
      title: '⏳ Expiring in the next 14 days',
      body: segs.join(' · '),
      url: target,
      tag: 'expiry-daily',
    },
  }).catch(() => {})

  return NextResponse.json({
    expiring: total,
    breakdown: { certifications: certs.length, rams: rams.length, permits: permits.length },
  })
}
