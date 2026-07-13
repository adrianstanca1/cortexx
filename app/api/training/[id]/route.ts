import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute } from '@/lib/withRoute'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['qualification', 'training', 'course', 'licence', 'safety'] as const

function parseDate(value: unknown): Date {
  const d = new Date(value as string)
  return isNaN(d.getTime()) ? new Date('invalid') : d
}

export const GET = withRoute(async ({ req }) => {
  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const cert = await prisma.certification.findUnique({
    where: { id },
    include: {
      member: { select: { id: true, name: true, role: true } },
      course: { select: { id: true, name: true, category: true } },
    },
  })
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(cert)
  },
  { requireOrg: false }
)

export const PUT = withRoute(
  async ({ req, userId }) => {
    const id = req.nextUrl.pathname.split('/').pop()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    const body = await req.json()
    const data: Prisma.CertificationUncheckedUpdateInput = {}

    if (body.holderName !== undefined) {
      if (body.holderName === null) return NextResponse.json({ error: 'Holder name cannot be null' }, { status: 400 })
      const v = String(body.holderName).trim()
      if (!v) return NextResponse.json({ error: 'Holder name cannot be empty' }, { status: 400 })
      data.holderName = v
    }
    if (body.type !== undefined) {
      if (body.type === null) return NextResponse.json({ error: 'Type cannot be null' }, { status: 400 })
      const v = String(body.type).trim()
      if (!v) return NextResponse.json({ error: 'Type cannot be empty' }, { status: 400 })
      data.type = v
    }
    if (body.category !== undefined) {
      const v = String(body.category).trim()
      if (!CATEGORIES.includes(v as any)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      data.category = v
    }
    if (body.number !== undefined) {
      const v = body.number?.toString().trim() || null
      data.number = v ? v : null
    }
    if (body.notes !== undefined) {
      const v = body.notes?.toString().trim() || null
      data.notes = v ? v : null
    }
    if (body.memberId !== undefined) data.memberId = body.memberId || null
    if (body.courseId !== undefined) data.courseId = body.courseId || null
    if (body.issuedDate !== undefined) {
      if (body.issuedDate) {
        const d = parseDate(body.issuedDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid issuedDate' }, { status: 400 })
        data.issuedDate = d
      } else data.issuedDate = null
    }
    if (body.expiryDate !== undefined) {
      if (body.expiryDate) {
        const d = parseDate(body.expiryDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expiryDate' }, { status: 400 })
        data.expiryDate = d
      } else data.expiryDate = null
    }

    if (body.memberId) {
      const m = await prisma.teamMember.findUnique({ where: { id: body.memberId }, select: { id: true } })
      if (!m) return NextResponse.json({ error: 'Member not found' }, { status: 400 })
    }
    if (body.courseId) {
      const c = await prisma.trainingCourse.findUnique({ where: { id: body.courseId }, select: { id: true } })
      if (!c) return NextResponse.json({ error: 'Course not found' }, { status: 400 })
    }

    try {
      const cert = await prisma.certification.update({
        where: { id },
        data,
        include: {
          member: { select: { id: true, name: true, role: true } },
          course: { select: { id: true, name: true, category: true } },
        },
      })
      auditLog({
        action: 'certification.update',
        resourceType: 'Certification',
        resourceId: id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json(cert)
    } catch (error) {
      reportError(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update certification' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'write' }
)

export const DELETE = withRoute(
  async ({ req, userId }) => {
    const id = req.nextUrl.pathname.split('/').pop()
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    try {
      await prisma.certification.delete({ where: { id } })
      auditLog({
        action: 'certification.delete',
        resourceType: 'Certification',
        resourceId: id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json({ success: true })
    } catch (error) {
      reportError(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to delete certification' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'write' }
)
