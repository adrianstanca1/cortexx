import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ISO 8601 week number — week containing Thursday is week 1
function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    const weekParam = searchParams.get('week')
    const yearParam = searchParams.get('year')

    const nowIso = isoWeek(new Date())
    const currentWeek = weekParam ? parseInt(weekParam) : nowIso.week
    const currentYear = yearParam ? parseInt(yearParam) : nowIso.year

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
      return NextResponse.json({ error: 'Hours must be a positive number' }, { status: 400 })
    }
    if (Number(body.hours) > 24) {
      return NextResponse.json({ error: 'Hours cannot exceed 24 per entry' }, { status: 400 })
    }
    const date = new Date(body.date)
    const { week, year } = isoWeek(date)
    const entry = await prisma.timeEntry.create({
      data: {
        memberId: body.memberId,
        projectId: body.projectId || null,
        date,
        hours: Number(body.hours),
        week: body.week ?? week,
        year: body.year ?? year,
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
