import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: ['error'] })

type PersonaSeed = { email: string; name: string; userRole: string; orgRole: 'owner' | 'admin' | 'member' | 'viewer'; teamRole: string }

async function upsertPersona(persona: PersonaSeed, passwordHash: string, organizationId: string) {
  const user = await prisma.user.upsert({
    where: { email: persona.email },
    update: { name: persona.name, role: 'member', passwordHash },
    create: { email: persona.email, name: persona.name, role: 'member', passwordHash },
  })
  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    update: { role: persona.orgRole, personaRole: persona.userRole },
    create: { userId: user.id, organizationId, role: persona.orgRole, personaRole: persona.userRole },
  })
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })

  const existingMember = await prisma.teamMember.findFirst({ where: { organizationId, email: persona.email } })
  if (existingMember) {
    await prisma.teamMember.update({ where: { id: existingMember.id }, data: { name: persona.name, role: persona.teamRole } })
    return { user, member: existingMember }
  }
  const member = await prisma.teamMember.create({ data: { name: persona.name, role: persona.teamRole, email: persona.email, organizationId } })
  return { user, member }
}

async function main() {
  const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
  const organizationSlug = process.env.DEFAULT_ORG_SLUG || 'cortexbuildpro'
  const organizationName = process.env.DEFAULT_ORG_NAME || 'Cortexbuild Pro'
  const passwordHash = await bcrypt.hash(password, 12)

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: organizationName, plan: 'pro' },
    create: { slug: organizationSlug, name: organizationName, plan: 'pro' },
  })

  const personas: PersonaSeed[] = [
    { email: process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com', name: 'E2E Company Admin', userRole: 'company_admin', orgRole: 'owner', teamRole: 'Company Admin' },
    { email: process.env.E2E_PM_EMAIL || 'pm@cortexbuildpro.com', name: 'E2E Project Manager', userRole: 'project_manager', orgRole: 'member', teamRole: 'Project Manager' },
    { email: process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.com', name: 'E2E Foreman', userRole: 'foreman', orgRole: 'member', teamRole: 'Foreman' },
    { email: process.env.E2E_OPERATIVE_EMAIL || 'operative@cortexbuildpro.com', name: 'E2E Operative', userRole: 'operative', orgRole: 'member', teamRole: 'Operative' },
  ]

  const seeded = new Map<string, Awaited<ReturnType<typeof upsertPersona>>>()
  for (const persona of personas) seeded.set(persona.userRole, await upsertPersona(persona, passwordHash, organization.id))

  let project = await prisma.project.findFirst({ where: { name: 'E2E Verification Project', organizationId: organization.id } })
  if (!project) {
    project = await prisma.project.create({ data: { name: 'E2E Verification Project', address: '1 Automation Way', postcode: 'E2E 1AA', status: 'active', progress: 25, clientName: 'Cortexx Test Client', budget: 100000, spent: 25000, organizationId: organization.id } })
  }

  let adminOnlyProject = await prisma.project.findFirst({ where: { name: 'E2E Admin Only Project', organizationId: organization.id } })
  if (!adminOnlyProject) {
    adminOnlyProject = await prisma.project.create({ data: { name: 'E2E Admin Only Project', address: '99 Restricted Way', postcode: 'E2E 9ZZ', status: 'active', progress: 5, clientName: 'Admin Client', budget: 250000, spent: 10000, organizationId: organization.id } })
  }

  for (const persona of ['project_manager', 'foreman', 'operative']) {
    const member = seeded.get(persona)?.member
    if (member) {
      await prisma.assignment.upsert({
        where: { projectId_memberId: { projectId: project.id, memberId: member.id } },
        update: { role: persona.replace('_', ' ') },
        create: { projectId: project.id, memberId: member.id, role: persona.replace('_', ' '), organizationId: organization.id },
      })
    }
  }

  const operative = seeded.get('operative')?.member
  if (operative) {
    const existing = await prisma.task.findFirst({ where: { title: 'E2E Operative Task', projectId: project.id, organizationId: organization.id } })
    if (existing) await prisma.task.update({ where: { id: existing.id }, data: { assigneeId: operative.id, status: 'todo' } })
    else await prisma.task.create({ data: { title: 'E2E Operative Task', projectId: project.id, assigneeId: operative.id, status: 'todo', priority: 'medium', organizationId: organization.id } })
  }
  const adminTask = await prisma.task.findFirst({ where: { title: 'E2E Admin Only Task', projectId: adminOnlyProject.id, organizationId: organization.id } })
  if (!adminTask) await prisma.task.create({ data: { title: 'E2E Admin Only Task', projectId: adminOnlyProject.id, status: 'todo', priority: 'medium', organizationId: organization.id } })

  await prisma.invoice.upsert({
    where: { number: 'E2E-ADMIN-001' },
    update: { projectId: adminOnlyProject.id, clientName: 'Admin Client', amount: 1250, status: 'sent', dueDate: new Date('2026-10-15T00:00:00.000Z'), organizationId: organization.id },
    create: { number: 'E2E-ADMIN-001', projectId: adminOnlyProject.id, clientName: 'Admin Client', amount: 1250, status: 'sent', dueDate: new Date('2026-10-15T00:00:00.000Z'), organizationId: organization.id },
  })

  const operativeMember = seeded.get('operative')?.member
  if (operativeMember) {
    const assignedDate = new Date('2026-09-24T08:00:00.000Z')
    const existingAssignedTime = await prisma.timeEntry.findFirst({ where: { memberId: operativeMember.id, projectId: project.id, date: assignedDate, organizationId: organization.id } })
    if (existingAssignedTime) await prisma.timeEntry.update({ where: { id: existingAssignedTime.id }, data: { hours: 7.5, week: 39, year: 2026, approved: false } })
    else await prisma.timeEntry.create({ data: { memberId: operativeMember.id, projectId: project.id, date: assignedDate, hours: 7.5, week: 39, year: 2026, approved: false, organizationId: organization.id } })

    const approvedDate = new Date('2026-09-22T08:00:00.000Z')
    const existingApprovedTime = await prisma.timeEntry.findFirst({ where: { memberId: operativeMember.id, projectId: project.id, date: approvedDate, organizationId: organization.id } })
    if (existingApprovedTime) await prisma.timeEntry.update({ where: { id: existingApprovedTime.id }, data: { hours: 8, week: 39, year: 2026, approved: true } })
    else await prisma.timeEntry.create({ data: { memberId: operativeMember.id, projectId: project.id, date: approvedDate, hours: 8, week: 39, year: 2026, approved: true, organizationId: organization.id } })
  }

  const adminMember = seeded.get('company_admin')?.member
  if (adminMember) {
    const adminDate = new Date('2026-09-23T08:00:00.000Z')
    const existingAdminTime = await prisma.timeEntry.findFirst({ where: { memberId: adminMember.id, projectId: adminOnlyProject.id, date: adminDate, organizationId: organization.id } })
    if (existingAdminTime) await prisma.timeEntry.update({ where: { id: existingAdminTime.id }, data: { hours: 4, week: 39, year: 2026, approved: false } })
    else await prisma.timeEntry.create({ data: { memberId: adminMember.id, projectId: adminOnlyProject.id, date: adminDate, hours: 4, week: 39, year: 2026, approved: false, organizationId: organization.id } })
  }

  console.log(`Seeded E2E personas for ${organizationSlug}: ${personas.map(p => p.userRole).join(', ')}`)
}

main().finally(async () => prisma.$disconnect()).catch(error => { console.error(error); process.exit(1) })
