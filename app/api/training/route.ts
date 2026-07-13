import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute } from '@/lib/withRoute'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200
const EXPIRING_WINDOW_DAYS = 60
const CATEGORIES = ['qualification', 'training', 'course', 'licence', 'safety'] as const

function bucket(expiry: Date | null): 'valid' | 'expiring' | 'expired' | 'no_expiry' {
  if (!expiry) return 'no_expiry'
  const ms = expiry.getTime() - Date.now()
  if (ms < 0) return 'expired'
  if (ms < EXPIRING_WINDOW_DAYS * 86_400_000) return 'expiring'
  return 'valid'
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  const d = new Date(value as string)
  if (isNaN(d.getTime())) return new Date('invalid') // caller checks
  return d
}

export const GET = withRoute(
  async ({ req }) => {
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')
    const type = searchParams.get('type')
    const status = searchParams.get('status') // valid | expiring | expired
    const category = searchParams.get('category')
    const take = Math.min(parseInt(searchParams.get('take') || '100') || 100, MAX_TAKE)

    const certs = await prisma.certification.findMany({
      where: {
        ...(memberId && { memberId }),
        ...(type && { type }),
        ...(category && CATEGORIES.includes(category as any) && { category }),
      },
      include: {
        member: { select: { id: true, name: true, role: true } },
        course: { select: { id: true, name: true, category: true } },
      },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
      take,
    })

    const enriched = certs.map((c) => ({ ...c, statusBucket: bucket(c.expiryDate) }))
    const filtered = status ? enriched.filter((c) => c.statusBucket === status) : enriched

    const counts = {
      valid: enriched.filter((c) => c.statusBucket === 'valid').length,
      expiring: enriched.filter((c) => c.statusBucket === 'expiring').length,
      expired: enriched.filter((c) => c.statusBucket === 'expired').length,
      total: enriched.length,
    }

    return NextResponse.json({ certifications: filtered, counts })
  },
  { requireOrg: false }
)

export const POST = withRoute(
  async ({ req, userId }) => {
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    const body = await req.json()
    const holderName = String(body.holderName || '').trim()
    if (!holderName) return NextResponse.json({ error: 'Holder name is required' }, { status: 400 })
    const type = String(body.type || '').trim()
    if (!type) return NextResponse.json({ error: 'Type is required' }, { status: 400 })

    const category = CATEGORIES.includes(body.category as any) ? (body.category as string) : 'qualification'
    const issuedDate = parseDate(body.issuedDate)
    if (body.issuedDate && (!issuedDate || isNaN(issuedDate.getTime()))) {
      return NextResponse.json({ error: 'Invalid issuedDate' }, { status: 400 })
    }
    const expiryDate = parseDate(body.expiryDate)
    if (body.expiryDate && (!expiryDate || isNaN(expiryDate.getTime()))) {
      return NextResponse.json({ error: 'Invalid expiryDate' }, { status: 400 })
    }

    if (body.memberId) {
      const m = await prisma.teamMember.findUnique({ where: { id: body.memberId }, select: { id: true } })
      if (!m) return NextResponse.json({ error: 'Member not found' }, { status: 400 })
    }
    if (body.courseId) {
      const c = await prisma.trainingCourse.findUnique({ where: { id: body.courseId }, select: { id: true } })
      if (!c) return NextResponse.json({ error: 'Course not found' }, { status: 400 })
    }

    const number = body.number?.toString().trim() || null
    const notes = body.notes?.toString().trim() || null
    const data: Prisma.CertificationUncheckedCreateInput = {
      memberId: body.memberId || null,
      courseId: body.courseId || null,
      holderName,
      type,
      category,
      number: number ? number : null,
      ...(issuedDate && { issuedDate }),
      ...(expiryDate && { expiryDate }),
      notes: notes ? notes : null,
    }

    try {
      const cert = await prisma.certification.create({
        data,
        include: {
          member: { select: { id: true, name: true, role: true } },
          course: { select: { id: true, name: true, category: true } },
        },
      })
      auditLog({
        action: 'certification.create',
        resourceType: 'Certification',
        resourceId: cert.id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json(cert, { status: 201 })
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to create certification' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'write' }
)
