import { test, expect } from '@playwright/test'
import { signIn } from './helpers/auth.mjs'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'

test('offline photo capture persists locally and auto-syncs exactly once after reconnect', async ({ page, context }) => {
  await signIn(page, email, password, { dashboard: true })
  await page.goto('/photos')
  await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible()
  await page.waitForFunction(() => Boolean(localStorage.getItem('cortexx_offline_upload_org')))

  const name = `offline-${Date.now()}.jpg`
  await context.setOffline(true)
  try {
    await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles({
      name,
      mimeType: 'image/jpeg',
      buffer: Buffer.from('offline-site-photo'),
    })

    await expect(page.getByText(/Photo saved offline/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /1 upload saved offline/i })).toBeVisible()

    const stored = await page.evaluate(async () => {
      const request = indexedDB.open('cortexbuild-offline-media', 1)
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return new Promise((resolve, reject) => {
        const tx = db.transaction('media-outbox', 'readonly')
        const req = tx.objectStore('media-outbox').getAll()
        req.onsuccess = () => resolve(req.result.map(row => ({
          filename: row.filename,
          size: row.size,
          orgId: row.orgId,
          blobSize: row.file?.size,
        })))
        req.onerror = () => reject(req.error)
      })
    })
    expect(stored).toHaveLength(1)
    expect(stored[0].filename).toBe(name)
    expect(stored[0].blobSize).toBe(Buffer.byteLength('offline-site-photo'))
    expect(stored[0].orgId).toBeTruthy()
  } finally {
    await context.setOffline(false)
  }

  await expect(page.getByRole('button', { name: /upload.*pending|saved offline|syncing/i })).toHaveCount(0, { timeout: 20_000 })

  await expect.poll(async () => {
    return page.evaluate(async fileName => {
      const response = await fetch('/api/documents?type=photo&take=100')
      if (!response.ok) return 0
      const data = await response.json()
      return (data.documents || []).filter(doc => doc.name === fileName).length
    }, name)
  }, { timeout: 20_000 }).toBe(1)

  await context.setOffline(true)
  await context.setOffline(false)
  await page.waitForTimeout(750)

  const count = await page.evaluate(async fileName => {
    const response = await fetch('/api/documents?type=photo&take=100')
    const data = await response.json()
    return (data.documents || []).filter(doc => doc.name === fileName).length
  }, name)
  expect(count).toBe(1)
})


test('document outbox replay is idempotent under concurrent requests', async ({ page }) => {
  await signIn(page, email, password, { dashboard: true })
  const outboxId = crypto.randomUUID()
  const uploadResponse = await page.request.post('/api/uploads', {
    multipart: {
      file: {
        name: 'concurrent-offline-replay.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('concurrent-offline-replay-evidence'),
      },
    },
  })
  expect(uploadResponse.status()).toBe(201)
  const upload = await uploadResponse.json()

  const body = {
    name: `Concurrent offline doc ${Date.now()}`,
    type: 'photo',
    projectId: null,
    url: upload.url,
    size: upload.size,
    mimeType: upload.mimeType,
    metadata: { source: 'e2e-offline-replay' },
  }
  const send = () => page.request.post('/api/documents', {
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Outbox-Id': outboxId,
    },
    data: body,
  })

  const [a, b] = await Promise.all([send(), send()])
  expect([200, 201]).toContain(a.status())
  expect([200, 201]).toContain(b.status())
  const [docA, docB] = await Promise.all([a.json(), b.json()])
  expect(docA.id).toBeTruthy()
  expect(docB.id).toBe(docA.id)

  const response = await page.request.get('/api/documents?type=photo&take=100')
  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  expect((data.documents || []).filter(doc => doc.id === docA.id)).toHaveLength(1)
})


test('new document can be committed offline and syncs after reconnect', async ({ page, context }) => {
  await signIn(page, email, password, { dashboard: true })
  await page.goto('/documents')
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible()
  await page.waitForFunction(() => Boolean(localStorage.getItem('cortexx_offline_upload_org')))

  const name = `Offline RAMS ${Date.now()}`
  await page.getByRole('button', { name: 'Add document' }).first().click()
  const fileInput = page.locator('input[type="file"]').first()

  await context.setOffline(true)
  try {
    await fileInput.setInputFiles({
      name: 'offline-rams.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 offline test'),
    })
    await page.getByLabel('Document name').fill(name)
    await expect(page.getByText(/File ready · Add document to save it offline/i)).toBeVisible()
    await page.getByRole('button', { name: 'Add document' }).last().click()
    await expect(page.getByText(/Document saved offline/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /1 upload saved offline/i })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }

  await expect(page.getByRole('button', { name: /upload.*pending|saved offline|syncing/i })).toHaveCount(0, { timeout: 20_000 })
  await expect.poll(async () => {
    return page.evaluate(async documentName => {
      const response = await fetch('/api/documents?take=100')
      if (!response.ok) return 0
      const data = await response.json()
      return (data.documents || []).filter(doc => doc.name === documentName).length
    }, name)
  }, { timeout: 20_000 }).toBe(1)
})
