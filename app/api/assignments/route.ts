import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const assignments = await prisma.assignment.findMany({
      where: { ...(projectId && { projectId }) },
      include: { member: true, project: true },
    })
    return NextResponse.json({ assignments })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json()
    if (!body.projectId || !body.memberId) {
      return NextResponse.json({ error: 'projectId and memberId required' }, { status: 400 })
    }
    const role = body.role ? String(body.role).trim().slice(0, 50) : null
    // Skip findUnique-then-create and let the @@unique constraint do
    // the duplicate-check atomically. The prior pattern had a TOCTOU
    // race: two concurrent POSTs both passed the existence check, the
    // second create() threw P2002 caught as a generic 500.
    try {
      const assignment = await prisma.assignment.create({
        data: {
          projectId: body.projectId,
          memberId: body.memberId,
          role: role || null,
          onSite: body.onSite ?? false,
        },
        include: { member: true, project: true },
      })
      return NextResponse.json(assignment, { status: 201 })
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'P2002') {
        return NextResponse.json({ error: 'Already assigned' }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}
