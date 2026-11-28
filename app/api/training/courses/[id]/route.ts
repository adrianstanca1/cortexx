import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute, decodePathSegment } from '@/lib/withRoute'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const COURSE_CATEGORIES = ['safety', 'technical', 'management', 'first_aid', 'environmental', 'other'] as const

function courseIdFrom(req: NextRequest, params: Record<string, string>): string | null {
  return decodePathSegment(params.id || req.nextUrl.pathname.split('/').pop()) || null
}

function parseValidityDays(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const days = Number(value)
  return Number.isInteger(days) && days >= 1 ? days : undefined
}

/** GET — read a single training course in the active organization. */
export const GET = withRoute(
  async ({ req, params }) => {
    const id = courseIdFrom(req, params as Record<string, string>)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const course = await prisma.trainingCourse.findUnique({ where: { id } })
    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(course)
  },
  { requireOrg: false }
)

/** PATCH — update catalog metadata. Admin+ only. */
export const PATCH = withRoute(
  async ({ req, userId, params }) => {
    const id = courseIdFrom(req, params as Record<string, string>)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const data: Prisma.TrainingCourseUncheckedUpdateInput = {}
    if (body.name !== undefined) {
      const name = String(body.name || '').trim()
      if (!name) return NextResponse.json({ error: 'Course name is required' }, { status: 400 })
      data.name = name
    }
    if (body.category !== undefined) {
      const category = String(body.category)
      if (!COURSE_CATEGORIES.includes(category as any)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      data.category = category
    }
    if (body.validityDays !== undefined) {
      const validityDays = parseValidityDays(body.validityDays)
      if (validityDays === undefined) {
        return NextResponse.json({ error: 'Validity days must be a positive integer' }, { status: 400 })
      }
      data.validityDays = validityDays
    }
    for (const field of ['code', 'provider', 'description'] as const) {
      if (body[field] !== undefined) {
        const value = body[field]?.toString().trim() || null
        data[field] = value ? value : null
      }
    }
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null

    try {
      const course = await prisma.trainingCourse.update({ where: { id }, data })
      auditLog({
        action: 'trainingCourse.update',
        resourceType: 'TrainingCourse',
        resourceId: id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json(course)
    } catch (error) {
      reportError(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update course' }, { status: 500 })
    }
  },
  { requireOrg: true, permission: 'manage' }
)

/** DELETE — remove a course. Linked certifications retain their courseId but
 *  Prisma's ON DELETE SET NULL clears the relation. Admin+ only. */
export const DELETE = withRoute(
  async ({ req, userId, params }) => {
    const id = courseIdFrom(req, params as Record<string, string>)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    try {
      await prisma.trainingCourse.delete({ where: { id } })
      auditLog({
        action: 'trainingCourse.delete',
        resourceType: 'TrainingCourse',
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
      return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 })
    }
  },
  { requireOrg: true, permission: 'manage' }
)
