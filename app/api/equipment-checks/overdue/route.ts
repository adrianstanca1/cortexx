import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { equipmentCheckScope } from '../route'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth

  try {
    const now = new Date()
    const checks = await prisma.equipmentCheck.findMany({
      where: {
        ...equipmentCheckScope(auth.session),
        nextDueAt: { lt: now },
      },
      include: {
        project: { select: { id: true, name: true } },
        equipment: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
    return NextResponse.json({ checks })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch overdue checks' }, { status: 500 })
  }
}
