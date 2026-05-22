import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.assignment.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 })
  }
}
