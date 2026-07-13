import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  try {
    const now = new Date()
    const checks = await prisma.equipmentCheck.findMany({
      where: {
        nextDueAt: { lt: now },
        status: { not: 'passed' },
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
