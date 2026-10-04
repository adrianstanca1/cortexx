import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { signIn } from './helpers/auth.mjs'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const admin = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const pm = process.env.E2E_PM_EMAIL || 'pm@cortexbuildpro.com'
const foreman = process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.com'
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

async function removeLocalUpload(upload) {
  if (upload?.backend !== 'local' || !upload?.name) return
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
  await rm(path.join(dir, upload.name), { force: true })
}

test('upload provenance binds attachment URLs to the tenant without blocking team reuse', async ({ page }) => {
  test.setTimeout(120_000)

  await signIn(page, admin, password)
  let request = page.context().request
  const projects = (await (await request.get('/api/projects')).json()).projects
  const project = projects.find(row => row.name === 'E2E Verification Project')
  expect(project).toBeTruthy()

  await signIn(page, foreman, password)
  request = page.context().request
  const uploadResponse = await request.post('/api/uploads', {
    multipart: {
      file: {
        name: 'foreman-evidence.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('foreman-owned-evidence'),
      },
    },
  })
  expect(uploadResponse.status()).toBe(201)
  const upload = await uploadResponse.json()
  expect(upload.uploadObjectId).toBeTruthy()

  const ownerDocumentResponse = await request.post('/api/documents', {
    data: {
      name: 'Foreman provenance evidence',
      type: 'photo',
      projectId: project.id,
      url: upload.url,
      size: upload.size,
      mimeType: upload.mimeType,
    },
  })
  expect(ownerDocumentResponse.status()).toBe(201)
  const ownerDocument = await ownerDocumentResponse.json()

  await signIn(page, pm, password)
  request = page.context().request
  const teamReuse = await request.post('/api/documents', {
    data: {
      name: 'PM reused team evidence',
      type: 'photo',
      projectId: project.id,
      url: upload.url,
      size: upload.size,
      mimeType: upload.mimeType,
    },
  })
  expect(teamReuse.status()).toBe(201)
  const pmDocument = await teamReuse.json()

  expect((await request.get(upload.url)).status()).toBe(200)

  await signIn(page, admin, password)
  request = page.context().request
  await request.delete('/api/documents/' + ownerDocument.id)
  await request.delete('/api/documents/' + pmDocument.id)
  await prisma.uploadObject.delete({ where: { id: upload.uploadObjectId } }).catch(() => {})
  await removeLocalUpload(upload)
})

test('foreign tenant provenance blocks bytes even when a copied URL is republished', async ({ page }) => {
  test.setTimeout(120_000)

  await signIn(page, admin, password)
  const request = page.context().request
  const projects = (await (await request.get('/api/projects')).json()).projects
  const project = projects.find(row => row.name === 'E2E Verification Project')
  expect(project).toBeTruthy()

  const uploadResponse = await request.post('/api/uploads', {
    multipart: {
      file: {
        name: 'foreign-owner.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('foreign-owner-evidence'),
      },
    },
  })
  expect(uploadResponse.status()).toBe(201)
  const upload = await uploadResponse.json()
  const provenance = await prisma.uploadObject.findUnique({ where: { id: upload.uploadObjectId } })
  expect(provenance?.organizationId).toBeTruthy()

  const suffix = Date.now().toString(36)
  const foreignOrg = await prisma.organization.create({
    data: { name: 'Foreign provenance ' + suffix, slug: 'foreign-provenance-' + suffix },
  })

  let forgedDocument
  try {
    await prisma.uploadObject.update({
      where: { id: upload.uploadObjectId },
      data: { organizationId: foreignOrg.id },
    })
    forgedDocument = await prisma.document.create({
      data: {
        organizationId: provenance.organizationId,
        projectId: project.id,
        name: 'Forged cross-tenant attachment',
        type: 'photo',
        url: upload.url,
        size: upload.size,
        mimeType: upload.mimeType,
      },
    })

    // The business record belongs to the signed-in tenant, but the storage key
    // does not. Durable provenance must win and prevent bytes from being served.
    expect((await request.get(upload.url)).status()).toBe(404)
  } finally {
    if (forgedDocument?.id) await prisma.document.delete({ where: { id: forgedDocument.id } }).catch(() => {})
    await prisma.organization.delete({ where: { id: foreignOrg.id } }).catch(() => {})
    await removeLocalUpload(upload)
  }
})
