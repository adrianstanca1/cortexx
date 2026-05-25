import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * Schedule — read-only aggregation. Returns tasks with dueDates across
 * active projects, joined with project metadata, ready for a Gantt-style
 * UI. The week window is computed server-side: start/end inclusive in
 * ISO yyyy-mm-dd. Default: this week + next 7 weeks.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const fromParam = searchParams.get('from')
    const weeksParam = searchParams.get('weeks')

    const now = new Date()
    // Snap to start of this week (Monday)
    const start = fromParam ? new Date(fromParam) : new Date(now)
    if (isNaN(start.getTime())) return NextResponse.json({ error: 'Invalid from date' }, { status: 400 })
    const day = start.getDay() || 7
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (day - 1))
    const weeks = Math.max(1, Math.min(26, parseInt(weeksParam || '8') || 8))
    const end = new Date(start)
    end.setDate(end.getDate() + weeks * 7)

    const [tasks, projects] = await Promise.all([
      prisma.task.findMany({
        where: {
          dueDate: { gte: start, lt: end },
          ...(projectId && { projectId }),
        },
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: [{ projectId: 'asc' }, { dueDate: 'asc' }],
      }),
      prisma.project.findMany({
        where: { status: 'active', archivedAt: null },
        select: { id: true, name: true, status: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const totalsByProject: Record<string, number> = {}
    for (const t of tasks) {
      const key = t.projectId || '_unassigned'
      totalsByProject[key] = (totalsByProject[key] || 0) + 1
    }

    return NextResponse.json({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      weeks,
      tasks,
      projects,
      totalsByProject,
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
