import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const activities = await prisma.activity.findMany({
      include: { project: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json(activities)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.actorName || !body.action) {
      return NextResponse.json({ error: 'actorName and action are required' }, { status: 400 })
    }
    const activity = await prisma.activity.create({
      data: {
        projectId: body.projectId || null,
        actorName: body.actorName,
        actorType: body.actorType || 'human',
        action: body.action,
        detail: body.detail || null,
        iconType: body.iconType || 'check',
      },
      include: { project: true },
    })
    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}
