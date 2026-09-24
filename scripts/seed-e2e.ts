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
    update: { name: persona.name, role: persona.userRole, passwordHash },
    create: { email: persona.email, name: persona.name, role: persona.userRole, passwordHash },
  })
  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    update: { role: persona.orgRole },
    create: { userId: user.id, organizationId, role: persona.orgRole },
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
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'changeme-please-1234'
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

  console.log(`Seeded E2E personas for ${organizationSlug}: ${personas.map(p => p.userRole).join(', ')}`)
}

main().finally(async () => prisma.$disconnect()).catch(error => { console.error(error); process.exit(1) })
