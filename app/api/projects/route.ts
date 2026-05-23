import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 100

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(req.url)
    const take = Math.min(parseInt(searchParams.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)
    const include = searchParams.get('include') // 'archived' to include, 'only-archived' to show only archived
    const where = include === 'archived' ? {} : include === 'only-archived' ? { archivedAt: { not: null } } : { archivedAt: null }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: { select: { tasks: true, assignments: true } },
          assignments: { include: { member: true }, take: 8 },
        },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
      }),
      prisma.project.count({ where }),
    ])
    return NextResponse.json({ projects, total, hasMore: skip + projects.length < total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }
    if (!body.postcode?.trim()) {
      return NextResponse.json({ error: 'Postcode is required' }, { status: 400 })
    }
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
    }
    if (body.budget !== undefined && (isNaN(Number(body.budget)) || Number(body.budget) < 0)) {
      return NextResponse.json({ error: 'Budget must be a non-negative number' }, { status: 400 })
    }
    if (body.progress !== undefined && (isNaN(Number(body.progress)) || Number(body.progress) < 0 || Number(body.progress) > 100)) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 })
    }
    const project = await prisma.project.create({
      data: {
        name: body.name.trim(),
        address: body.address?.trim() || '',
        postcode: body.postcode?.trim() || '',
        status: body.status || 'active',
        progress: body.progress || 0,
        clientName: body.clientName?.trim() || '',
        budget: body.budget || 0,
        spent: body.spent || 0,
        lat: body.lat || 51.5,
        lng: body.lng || -0.1,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    })
    // Log activity (non-blocking)
    prisma.activity.create({
      data: {
        projectId: project.id,
        actorName: actorName(auth),
        actorType: 'human',
        action: `created project ${project.name}`,
        iconType: 'pin',
      },
    }).catch(() => {})
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
