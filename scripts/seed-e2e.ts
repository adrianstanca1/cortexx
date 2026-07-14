import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ['error'],
})

async function main() {
  const email = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@cortexbuildpro.com'
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'changeme-please-1234'
  const organizationSlug = process.env.DEFAULT_ORG_SLUG || 'cortexbuildpro'
  const organizationName = process.env.DEFAULT_ORG_NAME || 'Cortexbuild Pro'

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'E2E Admin', role: 'admin', passwordHash },
    create: { email, name: 'E2E Admin', role: 'admin', passwordHash },
  })

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: organizationName, plan: 'pro' },
    create: { slug: organizationSlug, name: organizationName, plan: 'pro' },
  })

  await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: { role: 'owner' },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: 'owner',
    },
  })

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })

  const project = await prisma.project.findFirst({ where: { name: 'E2E Verification Project' } })
  if (!project) {
    await prisma.project.create({
      data: {
        name: 'E2E Verification Project',
        address: '1 Automation Way',
        postcode: 'E2E 1AA',
        status: 'active',
        progress: 25,
        clientName: 'Cortexx Test Client',
        budget: 100000,
        spent: 25000,
        organizationId: organization.id,
      },
    })
  }

  console.log(`Seeded E2E owner ${email} for ${organizationSlug}`)
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
