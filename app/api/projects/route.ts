import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: { select: { tasks: true, assignments: true } },
        assignments: {
          include: { member: true },
          take: 8,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ projects })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
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
        actorName: 'You',
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
