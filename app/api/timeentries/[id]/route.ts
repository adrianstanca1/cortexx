import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.hours !== undefined) {
      const h = Number(body.hours)
      if (isNaN(h) || h <= 0 || h > 24) {
        return NextResponse.json({ error: 'Hours must be > 0 and ≤ 24' }, { status: 400 })
      }
    }
    const entry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: {
        ...(body.hours !== undefined && { hours: Number(body.hours) }),
        ...(body.approved !== undefined && { approved: body.approved }),
        ...(body.projectId !== undefined && { projectId: body.projectId }),
      },
      include: { member: true, project: true },
    })
    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.timeEntry.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }
}
