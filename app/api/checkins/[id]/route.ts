import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { runWithOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const limited = await enforceRateLimit(req, 'write', auth.userId)
  if (limited) return limited
  const params = await paramsP
  return runWithOrg({ organizationId: auth.orgId, userId: auth.userId ?? null, role: auth.role }, async () => {
    try {
      const body = await req.json()
      const existing = await prisma.siteCheckIn.findUnique({
        where: { id: params.id },
        select: { id: true, memberId: true, projectId: true, checkedOutAt: true, member: { select: { name: true } } },
      })
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (existing.checkedOutAt) return NextResponse.json({ error: 'Already checked out' }, { status: 409 })
      const lat = body.latitude !== undefined && body.latitude !== null ? Number(body.latitude) : null
      const lng = body.longitude !== undefined && body.longitude !== null ? Number(body.longitude) : null

      const updated = await prisma.$transaction(async tx => {
        const ci = await tx.siteCheckIn.update({
          where: { id: params.id },
          data: { checkedOutAt: new Date(), latitudeOut: lat !== null && !isNaN(lat) ? lat : null, longitudeOut: lng !== null && !isNaN(lng) ? lng : null },
          include: { member: { select: { id: true, name: true, role: true, avatarColor: true } }, project: { select: { id: true, name: true } } },
        })
        const remaining = await tx.siteCheckIn.count({ where: { memberId: existing.memberId, checkedOutAt: null } })
        if (remaining === 0) await tx.teamMember.update({ where: { id: existing.memberId }, data: { onSite: false } })
        await tx.project.update({ where: { id: existing.projectId }, data: { onSiteCount: { decrement: 1 } } })
        return ci
      })
      prisma.activity.create({
        data: { projectId: existing.projectId, actorName: actorName(auth.session), actorType: 'human', action: `checked out: ${existing.member?.name || 'member'}`, iconType: 'check' },
      }).catch(() => {})
      return NextResponse.json(updated)
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to check out' }, { status: 500 })
    }
  })
}

export async function DELETE(_req: NextRequest, { params: paramsP }: RouteParams) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const params = await paramsP
  return runWithOrg({ organizationId: auth.orgId, userId: auth.userId ?? null, role: auth.role }, async () => {
    try {
      const existing = await prisma.siteCheckIn.findUnique({ where: { id: params.id }, select: { memberId: true, projectId: true, checkedOutAt: true } })
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      await prisma.$transaction(async tx => {
        await tx.siteCheckIn.delete({ where: { id: params.id } })
        if (!existing.checkedOutAt) {
          const remaining = await tx.siteCheckIn.count({ where: { memberId: existing.memberId, checkedOutAt: null } })
          if (remaining === 0) await tx.teamMember.update({ where: { id: existing.memberId }, data: { onSite: false } })
          await tx.project.update({ where: { id: existing.projectId }, data: { onSiteCount: { decrement: 1 } } })
        }
      })
      return NextResponse.json({ success: true })
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
  })
}
