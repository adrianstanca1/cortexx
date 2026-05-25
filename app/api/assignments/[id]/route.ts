import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const assignment = await prisma.assignment.update({
      where: { id: params.id },
      data: {
        ...(body.onSite !== undefined && { onSite: body.onSite }),
        ...(body.role !== undefined && { role: body.role }),
      },
      include: { member: true },
    })
    return NextResponse.json(assignment)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const existing = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: { member: { select: { name: true } } },
    })
    await prisma.assignment.delete({ where: { id: params.id } })
    auditLog({
      action: 'assignment.delete',
      resourceType: 'Assignment',
      resourceId: params.id,
      ...requestMeta(req),
    })
    if (existing) {
      prisma.activity.create({
        data: {
          projectId: existing.projectId,
          actorName: actorName(auth),
          actorType: 'human',
          action: `unassigned ${existing.member.name} from project`,
          iconType: 'hardhat',
        },
      }).catch(() => {})
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 })
  }
}
