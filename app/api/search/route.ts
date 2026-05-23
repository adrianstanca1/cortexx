import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const q = String(new URL(req.url).searchParams.get('q') || '').trim()
    if (q.length < 2) {
      return NextResponse.json({ projects: [], tasks: [], team: [], invoices: [], total: 0 })
    }

    const contains = { contains: q, mode: 'insensitive' as const }
    const [projects, tasks, team, invoices] = await Promise.all([
      prisma.project.findMany({
        where: {
          OR: [
            { name: contains },
            { clientName: contains },
            { postcode: contains },
            { address: contains },
          ],
        },
        select: { id: true, name: true, status: true, clientName: true, postcode: true, progress: true },
        take: 10,
      }),
      prisma.task.findMany({
        where: {
          OR: [
            { title: contains },
            { description: contains },
          ],
        },
        include: { project: { select: { name: true } }, assignee: { select: { name: true } } },
        take: 10,
      }),
      prisma.teamMember.findMany({
        where: {
          OR: [
            { name: contains },
            { role: contains },
            { email: contains },
          ],
        },
        select: { id: true, name: true, role: true, avatarColor: true, onSite: true },
        take: 10,
      }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { number: contains },
            { clientName: contains },
          ],
        },
        select: { id: true, number: true, clientName: true, amount: true, status: true, projectId: true, project: { select: { name: true } } },
        take: 10,
      }),
    ])

    return NextResponse.json({
      projects,
      tasks,
      team,
      invoices,
      total: projects.length + tasks.length + team.length + invoices.length,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
