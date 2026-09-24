// Creates an owner without adding demo projects or replacing existing passwords.
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !password || password.length < 16) throw new Error('Set ADMIN_EMAIL and a generated ADMIN_PASSWORD of at least 16 characters')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
async function main() {
  const user = await prisma.user.upsert({
    where: { email }, update: {},
    create: { email: email!, name: 'Adrian Stanca', passwordHash: await bcrypt.hash(password!, 12), role: 'admin' },
  })
  const org = await prisma.organization.upsert({
    where: { slug: 'cortexbuildpro' }, update: {},
    create: { slug: 'cortexbuildpro', name: 'CortexBuild Pro', plan: 'pro' },
  })
  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } }, update: {},
    create: { userId: user.id, organizationId: org.id, role: 'owner' },
  })
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
  console.log('Construction owner and workspace are ready; no demo business records created.')
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error.message); process.exitCode = 1 })
