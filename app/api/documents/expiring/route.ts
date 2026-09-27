import { NextRequest, NextResponse } from 'next/server'
import { fileProjectScope } from '@/lib/file-access'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.max(1, Math.min(90, parseInt(searchParams.get('days') || '7') || 7))
    const now = new Date()
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + days)

    const documents = await prisma.document.findMany({
      where: {
        ...fileProjectScope(auth.session),
        expiresAt: { gte: now, lte: horizon },
      },
      include: { project: true },
      orderBy: { expiresAt: 'asc' },
    })
    return NextResponse.json({ documents, days })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch expiring documents' }, { status: 500 })
  }
}
