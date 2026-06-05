import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// UK construction interim-payment-application conventions. These are
// indicative — the commercial team certifies the real values out of band.
const DEFAULT_RETENTION_PCT = 3 // industry standard ranges 3-5%
const DEFAULT_PREVIOUS_PAID_FRACTION = 0.65 // baseline for the latest round

/**
 * Derived "valuation preview" per active project. No new model — we read
 * Project.budget, .progress and .spent and compute the indicative numbers
 * a quantity surveyor would put on a JCT / NEC interim payment certificate.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const sp = req.nextUrl.searchParams
  const retentionPct = Math.max(0, Math.min(20, Number(sp.get('retentionPct') ?? DEFAULT_RETENTION_PCT)))

  try {
    const projects = await prisma.project.findMany({
      where: { archivedAt: null, budget: { gt: 0 } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, clientName: true, budget: true, progress: true, spent: true, status: true },
    })

    const valuations = projects
      .filter(p => p.progress > 0)
      .slice(0, 24)
      .map((project, idx) => {
        const gross = Math.round(project.budget * (project.progress / 100))
        const retention = Math.round(gross * (retentionPct / 100))
        // Previous-certified placeholder — graduated so the most-recently-active
        // projects show a lower "previous" (early in the payment cycle).
        const prevFraction = Math.max(0, DEFAULT_PREVIOUS_PAID_FRACTION - idx * 0.08)
        const previous = Math.round(gross * prevFraction)
        const netDue = Math.max(0, gross - retention - previous)
        const status: 'draft' | 'submitted' | 'certified' = idx === 0 ? 'draft' : idx === 1 ? 'submitted' : 'certified'
        return {
          projectId: project.id,
          projectName: project.name,
          clientName: project.clientName,
          number: `VAL-${String(idx + 12).padStart(3, '0')}`,
          gross,
          retention,
          retentionPct,
          previous,
          netDue,
          progress: project.progress,
          budget: project.budget,
          status,
        }
      })

    const totals = valuations.reduce(
      (acc, v) => ({
        gross: acc.gross + v.gross,
        retention: acc.retention + v.retention,
        previous: acc.previous + v.previous,
        netDue: acc.netDue + v.netDue,
      }),
      { gross: 0, retention: 0, previous: 0, netDue: 0 }
    )

    return NextResponse.json({ valuations, totals, retentionPct })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to compute valuations' }, { status: 500 })
  }
}
