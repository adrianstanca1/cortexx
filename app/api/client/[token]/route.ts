import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// PUBLIC endpoint — no auth. Resolves a project by its share token and
// returns a read-only snapshot for the client portal. The token has 256
// bits of entropy so brute force is impractical; we still take a defensive
// posture: only return what's safe to show externally.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const token = (params.token || '').trim()
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const project = await prisma.project.findFirst({
      where: { clientToken: token, clientViewEnabled: true, archivedAt: null },
      select: {
        id: true,
        name: true,
        address: true,
        postcode: true,
        clientName: true,
        status: true,
        progress: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [photos, openSnags, milestones, invoices] = await Promise.all([
      prisma.document.findMany({
        where: { projectId: project.id, type: 'photo' },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, name: true, url: true, createdAt: true },
      }),
      prisma.snag.count({ where: { projectId: project.id, status: { not: 'closed' } } }),
      prisma.milestone.findMany({
        where: { projectId: project.id, plannedEnd: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
        orderBy: { plannedStart: 'asc' },
        take: 12,
        select: { id: true, title: true, plannedStart: true, plannedEnd: true, status: true },
      }),
      prisma.invoice.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, number: true, amount: true, status: true, dueDate: true, createdAt: true },
      }),
    ])

    return NextResponse.json({
      project,
      photos,
      openSnagCount: openSnags,
      milestones,
      invoices,
    })
  } catch (error) {
    console.error('[client/:token] GET failed:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
