import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute, decodePathSegment } from '@/lib/withRoute'
import { enforceRateLimit } from '@/lib/rateLimit'
import { requestMeta } from '@/lib/audit'
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

/** GET — read a course owned by the active organization. */
export const GET = withRoute(
  async ({ req, params, orgId }) => {
    const id = courseIdFrom(req, params as Record<string, string>)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const course = await prisma.trainingCourse.findUnique({
      where: { id, organizationId: orgId },
    })
    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(course)
  },
  { requireOrg: true }
)

/** PATCH — update catalog metadata. Admin+ only, and the target must belong to
 *  the active organization regardless of the tenancy-enforcement flag. */
export const PATCH = withRoute(
  async ({ req, userId, orgId, params }) => {
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

    const meta = requestMeta(req)
    try {
      // Update and audit event commit together: a failed audit rolls back the edit.
      const course = await prisma.$transaction(async tx => {
        const updated = await tx.trainingCourse.update({
          where: { id, organizationId: orgId },
          data,
        })
        await tx.auditEvent.create({
          data: {
            organizationId: orgId,
            userId,
            action: 'trainingCourse.update',
            resourceType: 'TrainingCourse',
            resourceId: id,
            ...meta,
          },
        })
        return updated
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

/** DELETE — remove a course from the active organization. Admin+ only.
 *  Prisma's ON DELETE SET NULL clears certification links, not the records. */
export const DELETE = withRoute(
  async ({ req, userId, orgId, params }) => {
    const id = courseIdFrom(req, params as Record<string, string>)
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    const meta = requestMeta(req)
    try {
      const deleted = await prisma.$transaction(async tx => {
        const result = await tx.trainingCourse.delete({
          where: { id, organizationId: orgId },
        })
        await tx.auditEvent.create({
          data: {
            organizationId: orgId,
            userId,
            action: 'trainingCourse.delete',
            resourceType: 'TrainingCourse',
            resourceId: id,
            ...meta,
          },
        })
        return result
      })
      if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
