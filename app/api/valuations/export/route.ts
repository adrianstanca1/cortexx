import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import exporter from '@/lib/valuation-export'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!auth.orgId) return NextResponse.json({ error: 'Organisation context required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'read', auth.userId)
  if (limited) return limited
  const status = req.nextUrl.searchParams.get('status')
  if (status && !['draft', 'submitted', 'certified', 'paid', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid valuation status' }, { status: 400 })
  }
  try {
    // Explicit scope is retained in addition to the tenancy extension. Export is
    // independent of the first page displayed in the UI.
    const valuations = await prisma.valuation.findMany({
      where: { organizationId: auth.orgId, ...(status ? { status } : {}) },
      include: {
        project: { select: { name: true, clientName: true } },
        certificates: { where: { status: 'issued' }, orderBy: { revision: 'desc' }, include: { payments: true } },
      },
      orderBy: [{ projectId: 'asc' }, { applicationNumber: 'asc' }],
    })
    const csv = '\uFEFF' + [exporter.csvHeader, ...valuations.map(exporter.valuationCsvRow)].join('\r\n') + '\r\n'
    return new NextResponse(csv, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cortexbuild-valuations.csv"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to export valuations' }, { status: 500 })
  }
}
