import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'
import { canPlanProgramme, programmeProjectWhere } from '@/lib/programme-access'
import resourceLoad from '@/lib/programme-resources'

export const dynamic = 'force-dynamic'
const { buildResourceLoad } = resourceLoad
const RESOURCE_TYPES = new Set(['labour', 'equipment', 'material'])

function positiveNumber(value: unknown, max = 100000) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= max ? n : null
}

function parseDate(value: unknown) {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? 'invalid' : d
}

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true, name: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const [activities, allocations, team, equipment, materials] = await Promise.all([
      prisma.programmeActivity.findMany({ where: { projectId: id }, select: { id: true, code: true, title: true, plannedStart: true, plannedEnd: true, status: true }, orderBy: [{ sortOrder: 'asc' }, { plannedStart: 'asc' }], take: 1000 }),
      prisma.programmeResourceAllocation.findMany({
        where: { projectId: id },
        include: {
          activity: { select: { id: true, code: true, title: true, plannedStart: true, plannedEnd: true } },
          teamMember: { select: { id: true, name: true, email: true, role: true } },
          equipment: { select: { id: true, name: true, code: true, category: true, status: true } },
          material: { select: { id: true, name: true, code: true, unit: true, stockLevel: true, reorderPoint: true } },
        },
        orderBy: [{ activity: { plannedStart: 'asc' } }, { resourceType: 'asc' }, { createdAt: 'asc' }],
        take: 2000,
      }),
      prisma.assignment.findMany({ where: { projectId: id }, include: { member: { select: { id: true, name: true, email: true, role: true } } }, take: 500 }),
      prisma.equipment.findMany({ where: { archivedAt: null }, select: { id: true, name: true, code: true, category: true, status: true }, orderBy: { name: 'asc' }, take: 1000 }),
      prisma.material.findMany({ where: { archivedAt: null }, select: { id: true, name: true, code: true, unit: true, stockLevel: true, reorderPoint: true }, orderBy: { name: 'asc' }, take: 1000 }),
    ])
    return NextResponse.json({
      project,
      activities,
      allocations,
      catalog: { team: team.map(row => row.member), equipment, materials },
      summary: buildResourceLoad({ activities, allocations }),
      permissions: { plan: canPlanProgramme(auth) },
    })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to load programme resources' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const { id } = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!canPlanProgramme(auth)) return NextResponse.json({ error: 'Company Admin or Project Manager permission required' }, { status: 403 })
  const limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id || '')
  if (limited) return limited
  try {
    const project = await prisma.project.findFirst({ where: programmeProjectWhere(id, auth), select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found or not assigned' }, { status: 404 })
    const body = await req.json()
    const activityId = String(body.activityId || '').trim()
    const resourceType = String(body.resourceType || '').trim()
    if (!activityId || !RESOURCE_TYPES.has(resourceType)) return NextResponse.json({ error: 'A programme activity and valid resource type are required' }, { status: 400 })
    const activity = await prisma.programmeActivity.findFirst({ where: { id: activityId, projectId: id }, select: { id: true, title: true, plannedStart: true } })
    if (!activity) return NextResponse.json({ error: 'Programme activity not found' }, { status: 404 })

    let quantity = positiveNumber(body.quantity)
    if (quantity === null) return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 })
    let hoursPerDay = 0
    let teamMemberId: string | null = null
    let equipmentId: string | null = null
    let materialId: string | null = null
    let label = String(body.label || '').trim().slice(0, 160) || null
    let unit = String(body.unit || '').trim().slice(0, 40) || 'unit'
    let needBy = parseDate(body.needBy)
    if (needBy === 'invalid') return NextResponse.json({ error: 'Need-by date is invalid' }, { status: 400 })

    if (resourceType === 'labour') {
      teamMemberId = body.teamMemberId ? String(body.teamMemberId) : null
      if (teamMemberId) {
        const member = await prisma.teamMember.findFirst({ where: { id: teamMemberId, assignments: { some: { projectId: id } } }, select: { id: true, name: true } })
        if (!member) return NextResponse.json({ error: 'Labour resource must be assigned to this project' }, { status: 400 })
        const duplicate = await prisma.programmeResourceAllocation.findFirst({ where: { activityId, teamMemberId, resourceType: 'labour' }, select: { id: true } })
        if (duplicate) return NextResponse.json({ error: 'This person is already allocated to the activity' }, { status: 409 })
        label = member.name
        quantity = 1
      } else if (!label) return NextResponse.json({ error: 'Generic labour demand needs a crew label' }, { status: 400 })
      const hours = body.hoursPerDay === undefined ? 8 : positiveNumber(body.hoursPerDay, 24)
      if (hours === null) return NextResponse.json({ error: 'Labour hours per day must be between 0 and 24' }, { status: 400 })
      hoursPerDay = hours
      unit = 'people'
      needBy = null
    } else if (resourceType === 'equipment') {
      equipmentId = body.equipmentId ? String(body.equipmentId) : null
      if (equipmentId) {
        const equipment = await prisma.equipment.findFirst({ where: { id: equipmentId, archivedAt: null }, select: { id: true, name: true } })
        if (!equipment) return NextResponse.json({ error: 'Equipment not found or archived' }, { status: 400 })
        const duplicate = await prisma.programmeResourceAllocation.findFirst({ where: { activityId, equipmentId, resourceType: 'equipment' }, select: { id: true } })
        if (duplicate) return NextResponse.json({ error: 'This equipment is already allocated to the activity' }, { status: 409 })
        label = equipment.name
        quantity = 1
      } else if (!label) return NextResponse.json({ error: 'Generic plant demand needs a label' }, { status: 400 })
      unit = 'unit'
      const hours = body.hoursPerDay === undefined || body.hoursPerDay === '' ? 0 : positiveNumber(body.hoursPerDay, 24)
      if (hours === null) return NextResponse.json({ error: 'Equipment hours per day must be between 0 and 24' }, { status: 400 })
      hoursPerDay = hours
      needBy = null
    } else {
      materialId = body.materialId ? String(body.materialId) : null
      if (materialId) {
        const material = await prisma.material.findFirst({ where: { id: materialId, archivedAt: null }, select: { id: true, name: true, unit: true } })
        if (!material) return NextResponse.json({ error: 'Material not found or archived' }, { status: 400 })
        label = material.name
        unit = material.unit
      } else if (!label) return NextResponse.json({ error: 'Generic material demand needs a label' }, { status: 400 })
      needBy = needBy || activity.plannedStart
    }

    const created = await prisma.programmeResourceAllocation.create({ data: {
      projectId: id, activityId, resourceType, teamMemberId, equipmentId, materialId, label,
      quantity, unit, hoursPerDay, needBy: needBy instanceof Date ? needBy : null,
      notes: String(body.notes || '').trim().slice(0, 1000) || null,
    }, include: { teamMember: true, equipment: true, material: true, activity: { select: { id: true, title: true, plannedStart: true, plannedEnd: true } } } })
    auditLog({ action: 'programme.resource.create', resourceType: 'ProgrammeResourceAllocation', resourceId: created.id, metadata: { projectId: id, activityId, resourceType, quantity, unit }, ...requestMeta(req) })
    prisma.activity.create({ data: { projectId: id, actorName: actorName(auth), actorType: 'human', action: `loaded ${resourceType} onto ${activity.title}`, iconType: 'check' } }).catch(() => {})
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to allocate programme resource' }, { status: 500 })
  }
}
