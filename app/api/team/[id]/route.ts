import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const member = await prisma.teamMember.findUnique({
      where: { id: params.id },
      include: {
        assignments: { include: { project: true } },
        timeEntries: { orderBy: { date: 'desc' }, take: 20 },
      },
    })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ member })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch team member' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    if (body.dailyRate !== undefined && (isNaN(Number(body.dailyRate)) || Number(body.dailyRate) < 0)) {
      return NextResponse.json({ error: 'Daily rate must be a non-negative number' }, { status: 400 })
    }
    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    if (body.role !== undefined && !body.role?.trim()) {
      return NextResponse.json({ error: 'Role cannot be empty' }, { status: 400 })
    }
    const member = await prisma.teamMember.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.role !== undefined && { role: body.role.trim() }),
        ...(body.email !== undefined && { email: body.email?.trim() || null }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.avatarColor !== undefined && { avatarColor: body.avatarColor }),
        ...(body.dailyRate !== undefined && { dailyRate: Number(body.dailyRate) }),
        ...(body.onSite !== undefined && { onSite: body.onSite }),
      },
    })
    return NextResponse.json(member)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.teamMember.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
  }
}
