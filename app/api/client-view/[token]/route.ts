import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { bypassTenancy } from '@/lib/tenancy'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * Public, token-gated read-only view of a single project for clients.
 *
 * NO auth — the share token IS the auth. Only returns data that's safe
 * for a client to see: name, address, progress, budget vs spent (not
 * margin), open snag count (not titles), public-safe activity summary,
 * photo previews.
 *
 * Bypassed by the edge proxy (see proxy.ts isPublic /api/client-view/).
 *
 * Wrapped in bypassTenancy() because the share token deliberately
 * grants cross-tenant read access (the project's org may differ from
 * any signed-in viewer's active org — usually no viewer signed in at all).
 */
export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ token: string }> }) {
  const params = await paramsP
  const token = String(params.token || '').trim()
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }
  return bypassTenancy(() => fetchClientView(token))
}

async function fetchClientView(token: string): Promise<NextResponse> {
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
        shareTokenExpiresAt: true,
      },
    })
    if (!project || project.budget < 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    // Time-boxed link enforcement: explicit 410 so the client UI can
    // show a friendly "this link has expired" state instead of a 404.
    if (project.shareTokenExpiresAt && project.shareTokenExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This share link has expired', code: 'EXPIRED' }, { status: 410 })
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
    reportError(error)
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 })
  }
}
