import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        tasks: { include: { assignee: true }, orderBy: { dueDate: 'asc' } },
        assignments: { include: { member: true } },
        invoices: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { tasks: true, assignments: true } },
      },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ project })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
    }
    if (body.budget !== undefined && (isNaN(Number(body.budget)) || Number(body.budget) < 0)) {
      return NextResponse.json({ error: 'Budget must be a non-negative number' }, { status: 400 })
    }
    if (body.progress !== undefined && (isNaN(Number(body.progress)) || Number(body.progress) < 0 || Number(body.progress) > 100)) {
      return NextResponse.json({ error: 'Progress must be between 0 and 100' }, { status: 400 })
    }
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.postcode !== undefined && { postcode: body.postcode }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.progress !== undefined && { progress: body.progress }),
        ...(body.clientName !== undefined && { clientName: body.clientName }),
        ...(body.budget !== undefined && { budget: body.budget }),
        ...(body.spent !== undefined && { spent: body.spent }),
        ...(body.onSiteCount !== undefined && { onSiteCount: body.onSiteCount }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      },
    })
    return NextResponse.json(project)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.project.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
