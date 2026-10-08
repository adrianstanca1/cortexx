/**
 * Idempotent, production-safe Cortex Construct user seeding.
 *
 * The public web app and Expo client use the SAME Prisma User and
 * UserOrganization tables. Never create a second mobile users database.
 *
 * Dry-run by default. --apply fills missing notification preferences.
 * --apply --demo-roles creates strictly isolated internal demo personas in
 * an EXISTING organization. It NEVER changes existing user passwords or roles.
 * Test email addresses use the reserved .invalid domain and cannot receive mail.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, lstatSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const apply = process.argv.includes('--apply')
const demo = process.argv.includes('--demo-roles')
const slug = process.env.CORTEX_SEED_ORG_SLUG || 'cortexbuildpro'
const credentialsPath = process.env.CORTEX_SEED_CREDENTIAL_PATH

const roles = [
  { email: 'cortex-construct-pm@seed.invalid', name: 'Cortex Construct Test Project Manager', personaRole: 'project_manager', teamRole: 'Project Manager' },
  { email: 'cortex-construct-foreman@seed.invalid', name: 'Cortex Construct Test Foreman', personaRole: 'foreman', teamRole: 'Foreman' },
  { email: 'cortex-construct-operative@seed.invalid', name: 'Cortex Construct Test Operative', personaRole: 'operative', teamRole: 'Operative' },
] as const

type Credential = { email: string; password: string; personaRole: string }

function credentials(): Credential[] {
  if (!credentialsPath?.startsWith('/')) throw new Error('CORTEX_SEED_CREDENTIAL_PATH must be an absolute path outside repository')
  if (credentialsPath.includes('/production/cortexx/') || credentialsPath.includes('/app/')) throw new Error('Credentials path must be outside application source')
  try {
    const info = lstatSync(credentialsPath)
    if (!info.isFile() || (info.mode & 0o077)) throw new Error('Credentials must be a private 0600 regular file')
    const value = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Credential[]
    if (!Array.isArray(value) || value.length !== roles.length || roles.some((r, i) =>
      value[i]?.email !== r.email || value[i]?.personaRole !== r.personaRole || typeof value[i]?.password !== 'string' || value[i].password.length < 32))
      throw new Error('Stored seed credentials do not match expected demo personas')
    return value
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    const value = roles.map(r => ({ email: r.email, personaRole: r.personaRole, password: randomBytes(36).toString('base64url') }))
    // The credential file is *only* present on the server's protected host volume.
    writeFileSync(credentialsPath, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    return value
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL required')
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: ['error'] })
  try {
    const org = await client.organization.findUnique({ where: { slug }, select: { id: true } })
    if (!org) throw new Error('Target organization does not exist; refusing to create another tenant')
    const users = await client.user.findMany({ select: { id: true } })
    const prefs = await client.notificationPreference.findMany({ select: { userId: true } })
    const existing = new Set(prefs.map(p => p.userId))
    const missing = users.filter(u => !existing.has(u.id))
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', targetOrganization: slug,
      existingAccounts: users.length, missingNotificationPreferences: missing.length, internalDemoRolesRequested: demo }))
    if (!apply) return

    if (missing.length) await client.notificationPreference.createMany({
      data: missing.map(u => ({ userId: u.id })), skipDuplicates: true,
    })
    console.log('Existing account preferences reconciled without editing user passwords, company memberships, or roles.')
    if (!demo) return

    const allCredentials = credentials()
    for (const role of roles) {
      const credential = allCredentials.find(c => c.email === role.email)!
      const user = await client.user.findUnique({ where: { email: role.email },
        select: { id: true, passwordHash: true } })
      if (user) {
        // Never reuse an unrelated account or reset its password/roles.
        if (!user.passwordHash || !await bcrypt.compare(credential.password, user.passwordHash))
          throw new Error(`Seed account collision for ${role.personaRole}; stopped without changing credentials`)
        const membership = await client.userOrganization.findUnique({
          where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        })
        if (!membership || membership.role !== 'member' || membership.personaRole !== role.personaRole)
          throw new Error(`Existing seed persona membership mismatch: ${role.personaRole}`)
        console.log(`Kept existing internal ${role.personaRole}; credentials and permissions unchanged.`)
        continue
      }
      const hash = await bcrypt.hash(credential.password, 12)
      await client.$transaction(async tx => {
        const created = await tx.user.create({
          data: { email: role.email, name: role.name, passwordHash: hash, role: 'member' },
        })
        await tx.userOrganization.create({ data: {
          userId: created.id, organizationId: org.id, role: 'member', personaRole: role.personaRole,
        } })
        await tx.notificationPreference.create({ data: { userId: created.id } })
        await tx.teamMember.create({ data: {
          organizationId: org.id, name: role.name, role: role.teamRole, email: role.email,
        } })
      })
      console.log(`Created internal ${role.personaRole} in existing web/mobile database (no password printed).`)
    }
  } finally {
    await client.$disconnect()
  }
}

main().catch(err => { console.error('Safe user seed failed:', err.message); process.exitCode = 1 })
