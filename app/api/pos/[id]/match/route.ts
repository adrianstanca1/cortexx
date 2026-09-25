import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { purchaseOrderMatch } from '@/lib/procurement-match-server'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })

  try {
    const summary = await purchaseOrderMatch(prisma, auth.orgId, params.id, 0)
    return NextResponse.json(summary)
  } catch (error) {
    if (error instanceof Error && error.message === 'PURCHASE_ORDER_NOT_FOUND') {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to evaluate PO match' }, { status: 500 })
  }
}
