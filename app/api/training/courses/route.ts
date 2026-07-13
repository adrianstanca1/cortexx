import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { withRoute } from '@/lib/withRoute'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const COURSE_CATEGORIES = ['safety', 'technical', 'management', 'first_aid', 'environmental', 'other'] as const

export const GET = withRoute(
  async ({ req }) => {
  const { searchParams } = new URL(req.url)
  const includeArchived = searchParams.get('archived') === 'true'
  const category = searchParams.get('category')

  const courses = await prisma.trainingCourse.findMany({
    where: {
      ...(category && COURSE_CATEGORIES.includes(category as any) && { category }),
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ courses })
  },
  { requireOrg: false }
)

export const POST = withRoute(
  async ({ req, userId }) => {
    const limited = await enforceRateLimit(req, 'write', userId)
    if (limited) return limited

    const body = await req.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Course name is required' }, { status: 400 })

    const category = COURSE_CATEGORIES.includes(body.category as any) ? (body.category as string) : 'other'
    const validityDays =
      body.validityDays !== undefined && body.validityDays !== null && body.validityDays !== ''
        ? Number(body.validityDays)
        : null
    if (validityDays !== null && (!Number.isInteger(validityDays) || validityDays < 1)) {
      return NextResponse.json({ error: 'Validity days must be a positive integer' }, { status: 400 })
    }

    try {
      const data: Prisma.TrainingCourseUncheckedCreateInput = {
        name,
        code: body.code?.toString().trim() ? body.code.toString().trim() : null,
        provider: body.provider?.toString().trim() ? body.provider.toString().trim() : null,
        category,
        validityDays,
        description: body.description?.toString().trim() ? body.description.toString().trim() : null,
      }
      const course = await prisma.trainingCourse.create({ data })
      auditLog({
        action: 'trainingCourse.create',
        resourceType: 'TrainingCourse',
        resourceId: course.id,
        userId,
        ...requestMeta(req),
      })
      return NextResponse.json(course, { status: 201 })
    } catch (error) {
      reportError(error)
      return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
    }
  },
  { requireOrg: false, permission: 'manage' }
)
