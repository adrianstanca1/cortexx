import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Public, token-gated read-only view of a single project for clients.
 *
 * NO auth — the share token IS the auth. Only returns data that's safe
 * for a client to see: name, address, progress, budget vs spent (not
 * margin), open snag count (not titles), public-safe activity summary,
 * photo previews.
 *
 * Bypassed by middleware (see middleware.ts isPublic /api/client-view/).
 */
export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ token: string }> }) {
  const params = await paramsP
  const token = String(params.token || '').trim()
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }
  try {
    const project = await prisma.project.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        name: true,
        address: true,
        postcode: true,
        status: true,
        progress: true,
        clientName: true,
        budget: true,
        spent: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!project || project.budget < 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [openSnags, photoDocs, recentActivity] = await Promise.all([
      prisma.snag.count({ where: { projectId: project.id, status: { not: 'closed' } } }),
      prisma.document.findMany({
        where: { projectId: project.id, type: 'photo', url: { not: null } },
        select: { id: true, name: true, url: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.activity.findMany({
        where: { projectId: project.id, iconType: { in: ['check', 'camera', 'doc'] } },
        select: { id: true, action: true, createdAt: true, iconType: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    return NextResponse.json({
      project,
      stats: {
        openSnags,
        photoCount: photoDocs.length,
      },
      photos: photoDocs,
      activity: recentActivity,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }
}
