import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireCronAuth } from '@/lib/cron'
import { bypassTenancy } from '@/lib/tenancy'
import { sendPush } from '@/lib/push'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000
const HORIZON_DAYS = 14

type ExpiryItem = {
  organizationId: string
  kind: 'permit' | 'rams' | 'certification' | 'document'
  title: string
  expiresAt: Date
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'expiry-warnings' })
}

export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  try {
    return await bypassTenancy(() => runExpiryScan())
  } catch (error) {
    reportError(error, { context: 'cron.expiry-warnings' })
    return NextResponse.json({ error: 'Expiry warning scan failed' }, { status: 500 })
  }
}

async function runExpiryScan() {
  const now = new Date()
  const horizon = new Date(now.getTime() + HORIZON_DAYS * DAY_MS)

  const [permits, rams, certifications, documents] = await Promise.all([
    prisma.permit.findMany({
      where: { organizationId: { not: null }, status: { notIn: ['cancelled', 'expired'] }, validTo: { gte: now, lte: horizon } },
      select: { organizationId: true, title: true, validTo: true },
    }),
    prisma.rams.findMany({
      where: { organizationId: { not: null }, status: { notIn: ['expired', 'archived'] }, reviewBy: { gte: now, lte: horizon } },
      select: { organizationId: true, title: true, reviewBy: true },
    }),
    prisma.certification.findMany({
      where: { organizationId: { not: null }, expiryDate: { gte: now, lte: horizon } },
      select: { organizationId: true, holderName: true, type: true, expiryDate: true },
    }),
    prisma.document.findMany({
      where: { organizationId: { not: null }, expiresAt: { gte: now, lte: horizon } },
      select: { organizationId: true, name: true, expiresAt: true },
    }),
  ])

  const items: ExpiryItem[] = [
    ...permits.flatMap(row => row.organizationId && row.validTo ? [{ organizationId: row.organizationId, kind: 'permit' as const, title: row.title, expiresAt: row.validTo }] : []),
    ...rams.flatMap(row => row.organizationId && row.reviewBy ? [{ organizationId: row.organizationId, kind: 'rams' as const, title: row.title, expiresAt: row.reviewBy }] : []),
    ...certifications.flatMap(row => row.organizationId && row.expiryDate ? [{ organizationId: row.organizationId, kind: 'certification' as const, title: `${row.holderName} · ${row.type}`, expiresAt: row.expiryDate }] : []),
    ...documents.flatMap(row => row.organizationId && row.expiresAt ? [{ organizationId: row.organizationId, kind: 'document' as const, title: row.name, expiresAt: row.expiresAt }] : []),
  ]

  const grouped = new Map<string, ExpiryItem[]>()
  for (const item of items) {
    const bucket = grouped.get(item.organizationId)
    if (bucket) bucket.push(item)
    else grouped.set(item.organizationId, [item])
  }

  let usersTargeted = 0
  let delivered = 0
  let pruned = 0
  let skipped = 0

  for (const [organizationId, bucket] of grouped) {
    const memberships = await prisma.userOrganization.findMany({
      where: { organizationId },
      select: { userId: true },
    })
    const earliest = bucket.reduce((min, item) => item.expiresAt < min ? item.expiresAt : min, bucket[0].expiresAt)
    const days = Math.max(0, Math.ceil((earliest.getTime() - now.getTime()) / DAY_MS))
    const counts = bucket.reduce<Record<string, number>>((acc, item) => {
      acc[item.kind] = (acc[item.kind] || 0) + 1
      return acc
    }, {})
    const detail = Object.entries(counts).map(([kind, count]) => `${count} ${kind}`).join(' · ')

    for (const membership of memberships) {
      usersTargeted += 1
      const result = await sendPush({
        userId: membership.userId,
        category: 'safety',
        payload: {
          title: `${bucket.length} compliance item${bucket.length === 1 ? '' : 's'} expiring`,
          body: `${detail}. Earliest due in ${days} day${days === 1 ? '' : 's'}.`,
          url: '/documents',
          tag: `expiry-${organizationId}-${now.toISOString().slice(0, 10)}`,
        },
      })
      delivered += result.delivered
      pruned += result.pruned
      if (result.skipped) skipped += 1
    }
  }

  return NextResponse.json({
    horizonDays: HORIZON_DAYS,
    expiring: items.length,
    organizations: grouped.size,
    usersTargeted,
    delivered,
    pruned,
    skipped,
    byType: {
      permits: permits.length,
      rams: rams.length,
      certifications: certifications.length,
      documents: documents.length,
    },
  })
}
