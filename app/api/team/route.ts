import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    const members = await prisma.teamMember.findMany({
      include: {
        assignments: { include: { project: true } },
        timeEntries: { where: { date: { gte: weekStart } } },
      },
      orderBy: { name: 'asc' },
    })

    const result = members.map((m) => ({
      ...m,
      hoursThisWeek: m.timeEntries.reduce((s, e) => s + e.hours, 0),
    }))

    return NextResponse.json({ team: result })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!body.role?.trim()) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }
    if (body.dailyRate !== undefined && body.dailyRate !== null && body.dailyRate !== '' && (isNaN(Number(body.dailyRate)) || Number(body.dailyRate) < 0)) {
      return NextResponse.json({ error: 'Daily rate must be a non-negative number' }, { status: 400 })
    }
    const member = await prisma.teamMember.create({
      data: {
        name: body.name.trim(),
        role: body.role.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        avatarColor: body.avatarColor || '#2563eb',
        dailyRate: body.dailyRate ? Number(body.dailyRate) : 0,
        onSite: body.onSite || false,
      },
    })
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}
