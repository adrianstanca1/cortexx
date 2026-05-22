import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    const week = searchParams.get('week')
    const year = searchParams.get('year')

    const now = new Date()
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000)
    const currentWeek = week ? parseInt(week) : Math.ceil((dayOfYear + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)
    const currentYear = year ? parseInt(year) : now.getFullYear()

    const entries = await prisma.timeEntry.findMany({
      where: {
        ...(memberId && { memberId }),
        week: currentWeek,
        year: currentYear,
      },
      include: { member: true, project: true },
      orderBy: { date: 'asc' },
    })

    // Group by member for timesheet view
    const byMember: Record<string, { member: typeof entries[0]['member'], entries: typeof entries, totalHours: number, approved: boolean }> = {}
    for (const entry of entries) {
      if (!byMember[entry.memberId]) {
        byMember[entry.memberId] = { member: entry.member, entries: [], totalHours: 0, approved: true }
      }
      byMember[entry.memberId].entries.push(entry)
      byMember[entry.memberId].totalHours += entry.hours
      if (!entry.approved) byMember[entry.memberId].approved = false
    }

    return NextResponse.json({ entries, byMember: Object.values(byMember), week: currentWeek, year: currentYear })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }
    if (!body.date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }
    if (body.hours === undefined || body.hours === null || isNaN(Number(body.hours)) || Number(body.hours) <= 0) {
      return NextResponse.json({ error: 'Valid positive hours value is required' }, { status: 400 })
    }
    const date = new Date(body.date)
    // ISO week number calculation
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000)
    const week = body.week ?? Math.ceil((dayOfYear + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7)
    const entry = await prisma.timeEntry.create({
      data: {
        memberId: body.memberId,
        projectId: body.projectId || null,
        date,
        hours: Number(body.hours),
        week,
        year: date.getFullYear(),
        approved: body.approved ?? false,
      },
      include: { member: true, project: true },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
  }
}
