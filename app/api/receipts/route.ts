import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import { canWrite } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'
const MAX_TAKE = 100
const STATUSES = new Set(['pending', 'extracted', 'needs_review', 'approved', 'reconciled'])

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const projectId = sp.get('projectId') || undefined
    const statusRaw = sp.get('status') || undefined
    const status = statusRaw && STATUSES.has(statusRaw) ? statusRaw : undefined
    const take = Math.min(Math.max(Number(sp.get('take')) || 50, 1), MAX_TAKE)
    const skip = Math.max(Number(sp.get('skip')) || 0, 0)
    const where = { ...(projectId ? { projectId } : {}), ...(status ? { status } : {}) }
    const [receipts, total, awaitingReview, approved, reconciled, approvedValue] = await Promise.all([
      prisma.expenseReceipt.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          document: { select: { id: true, name: true, url: true, mimeType: true } },
        },
        orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
      }),
      prisma.expenseReceipt.count({ where }),
      prisma.expenseReceipt.count({ where: { ...where, status: { in: ['pending', 'extracted', 'needs_review'] } } }),
      prisma.expenseReceipt.count({ where: { ...where, status: 'approved' } }),
      prisma.expenseReceipt.count({ where: { ...where, status: 'reconciled' } }),
      prisma.expenseReceipt.aggregate({
        where: { ...where, status: { in: ['approved', 'reconciled'] } },
        _sum: { totalAmount: true, vatAmount: true },
      }),
    ])
    return NextResponse.json({
      receipts,
      total,
      hasMore: skip + receipts.length < total,
      summary: {
        awaitingReview,
        approved,
        reconciled,
        approvedValue: approvedValue._sum.totalAmount || 0,
        approvedVat: approvedValue._sum.vatAmount || 0,
      },
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (role && !canWrite(role)) return NextResponse.json({ error: 'Write permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (limited) return limited
  try {
    const body = await req.json()
    const documentId = String(body.documentId || '').trim()
    if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    const document = await prisma.document.findUnique({ where: { id: documentId } })
    if (!document || document.type !== 'receipt') return NextResponse.json({ error: 'Receipt document not found' }, { status: 404 })
    const receipt = await prisma.expenseReceipt.upsert({
      where: { documentId },
      create: {
        documentId,
        projectId: document.projectId,
        capturedAt: document.capturedAt || document.createdAt,
        latitude: document.latitude,
        longitude: document.longitude,
        accuracyM: document.accuracyM,
        status: 'pending',
        extraction: {} as Prisma.InputJsonValue,
      },
      update: {},
      include: { project: { select: { id: true, name: true } }, document: true },
    })
    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to register receipt' }, { status: 500 })
  }
}
