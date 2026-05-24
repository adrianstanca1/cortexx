import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

/**
 * Site diary — aggregates a single day's activity for a project from
 * existing data: TimeEntry (hours on site), Activity (audit feed),
 * Snag (raised that day), Document (photos / RAMS uploaded that day).
 * No new model — pure aggregation over what /capture / /check-in /
 * /snags / /photos already write.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const dateParam = searchParams.get('date') // YYYY-MM-DD
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const day = dateParam ? new Date(dateParam) : new Date()
    if (isNaN(day.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, address: true, postcode: true, onSiteCount: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const [timeEntries, activities, snagsRaised, snagsClosed, documents] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { projectId, date: { gte: day, lt: next } },
        include: { member: { select: { id: true, name: true, role: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.activity.findMany({
        where: { projectId, createdAt: { gte: day, lt: next } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.snag.findMany({
        where: { projectId, createdAt: { gte: day, lt: next } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.snag.findMany({
        where: { projectId, closedAt: { gte: day, lt: next } },
        orderBy: { closedAt: 'asc' },
      }),
      prisma.document.findMany({
        where: { projectId, createdAt: { gte: day, lt: next } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
    ])

    const hoursTotal = timeEntries.reduce((s, e) => s + e.hours, 0)
    const peopleOnSite = new Set(timeEntries.map(e => e.memberId)).size
    const photos = documents.filter(d => d.type === 'photo')
    const otherDocs = documents.filter(d => d.type !== 'photo')

    return NextResponse.json({
      project,
      date: day.toISOString().slice(0, 10),
      summary: {
        hoursTotal,
        peopleOnSite,
        snagsRaised: snagsRaised.length,
        snagsClosed: snagsClosed.length,
        photosTaken: photos.length,
        documentsFiled: otherDocs.length,
        activityEvents: activities.length,
      },
      timeEntries,
      activities,
      snagsRaised,
      snagsClosed,
      photos,
      documents: otherDocs,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch site diary' }, { status: 500 })
  }
}
