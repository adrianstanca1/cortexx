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
 * Iterates per-org so each tenant gets a push describing ONLY its own
 * expiring items. The previous version summed counts across every org
 * and blasted ONE push (no userId scope) to every push subscription
 * globally — a cross-tenant data leak (org A learning about org B's
 * existence) and useless (the count never matched either org's view).
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

  // Step 1: pull everything expiring in the horizon window, scoped by org.
  // We select organizationId on each row so we can bucket by tenant below.
  const [certs, rams, permits, documents] = await Promise.all([
    prisma.certification.findMany({
      where: { expiryDate: { gte: now, lte: horizon } },
      select: { id: true, organizationId: true },
    }),
    prisma.rams.findMany({
      where: { reviewBy: { gte: now, lte: horizon } },
      select: { id: true, organizationId: true },
    }),
    prisma.permit.findMany({
      where: { status: 'active', validTo: { gte: now, lte: horizon } },
      select: { id: true, organizationId: true },
    }),
    prisma.document.findMany({
      where: { expiresAt: { gte: now, lte: horizon } },
      select: { id: true, organizationId: true },
    }),
  ])

  const total = certs.length + rams.length + permits.length + documents.length
  if (total === 0) {
    return NextResponse.json({ expiring: 0, orgsNotified: 0 })
  }

  // Step 2: bucket per-org so each tenant gets its own count.
  type OrgBucket = { certs: number; rams: number; permits: number; documents: number }
  const byOrg = new Map<string, OrgBucket>()
  const ensure = (id: string | null): OrgBucket | null => {
    if (!id) return null
    let b = byOrg.get(id)
    if (!b) { b = { certs: 0, rams: 0, permits: 0, documents: 0 }; byOrg.set(id, b) }
    return b
  }
  for (const c of certs) ensure(c.organizationId)!.certs++
  for (const r of rams) ensure(r.organizationId)!.rams++
  for (const p of permits) ensure(p.organizationId)!.permits++
  for (const d of documents) ensure(d.organizationId)!.documents++

  // Step 3: one push-per-org, scoped to the org's users. sendPush honours
  // the 'safety' preference per user, so opted-out users still don't see it.
  let orgsNotified = 0
  await Promise.all(
    Array.from(byOrg.entries()).map(async ([orgId, bucket]) => {
      const counts = [
        { key: 'certs', count: bucket.certs, labelSingular: 'cert', labelPlural: 'certs', target: '/training' },
        { key: 'rams', count: bucket.rams, labelSingular: 'RAMS', labelPlural: 'RAMS', target: '/rams' },
        { key: 'permits', count: bucket.permits, labelSingular: 'permit', labelPlural: 'permits', target: '/permits' },
        { key: 'documents', count: bucket.documents, labelSingular: 'document', labelPlural: 'documents', target: '/documents' },
      ]
      const dominant = counts.reduce((a, c) => (c.count > a.count ? c : a), counts[0])
      const segs: string[] = []
      if (bucket.certs) segs.push(`${bucket.certs} cert${bucket.certs === 1 ? '' : 's'}`)
      if (bucket.rams) segs.push(`${bucket.rams} RAMS`)
      if (bucket.permits) segs.push(`${bucket.permits} permit${bucket.permits === 1 ? '' : 's'}`)
      if (bucket.documents) segs.push(`${bucket.documents} document${bucket.documents === 1 ? '' : 's'}`)

      const orgUsers = await prisma.userOrganization.findMany({
        where: { organizationId: orgId },
        select: { userId: true },
      })
      await Promise.all(
        orgUsers.map(({ userId }) =>
          sendPush({
            userId,
            category: 'safety',
            payload: {
              title: '⏳ Expiring in the next 14 days',
              body: segs.join(' · '),
              url: dominant.target,
              tag: `expiry-daily-${orgId}`,
            },
          }).catch(() => {}),
        ),
      )
      orgsNotified++
    }),
  )

  return NextResponse.json({
    expiring: total,
    orgsNotified,
    breakdown: { certifications: certs.length, rams: rams.length, permits: permits.length, documents: documents.length },
  })
}
