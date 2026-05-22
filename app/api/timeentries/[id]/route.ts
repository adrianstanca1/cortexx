import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const entry = await prisma.timeEntry.update({
      where: { id: params.id },
      data: {
        ...(body.hours !== undefined && { hours: body.hours }),
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
  try {
    await prisma.timeEntry.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
  }
}
