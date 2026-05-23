import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Strip control characters and limit length to prevent storage abuse
function sanitize(s: string, maxLen = 500): string {
  return String(s).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen)
}

export async function GET() {
  try {
    const activities = await prisma.activity.findMany({
      include: { project: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ activities })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.actorName?.trim() || !body.action?.trim()) {
      return NextResponse.json({ error: 'actorName and action are required' }, { status: 400 })
    }
    const activity = await prisma.activity.create({
      data: {
        projectId: body.projectId || null,
        actorName: sanitize(body.actorName, 100),
        actorType: body.actorType || 'human',
        action: sanitize(body.action, 200),
        detail: body.detail ? sanitize(body.detail) : null,
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
