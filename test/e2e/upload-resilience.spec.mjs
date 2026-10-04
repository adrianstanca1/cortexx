import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { signIn } from './helpers/auth.mjs'

const email = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'

test('upload retries reuse one persisted object and reject id reuse for a different file', async ({ page }) => {
  await signIn(page, email, password, { dashboard: true })

  const uploadId = randomUUID()
  const headers = { 'X-Upload-Id': uploadId }
  const file = {
    name: 'resilient-upload.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('abc'),
  }

  let firstBody
  try {
    const first = await page.request.post('/api/uploads', {
      headers,
      multipart: { file },
    })
    expect(first.status()).toBe(201)
    firstBody = await first.json()
    expect(firstBody.reused).not.toBe(true)

    const retry = await page.request.post('/api/uploads', {
      headers,
      multipart: { file },
    })
    expect(retry.status()).toBe(200)
    const retryBody = await retry.json()
    expect(retryBody.reused).toBe(true)
    expect(retryBody.name).toBe(firstBody.name)
    expect(retryBody.url).toBe(firstBody.url)

    const collision = await page.request.post('/api/uploads', {
      headers,
      multipart: {
        file: {
          name: 'different.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('xyz'),
        },
      },
    })
    expect(collision.status()).toBe(409)
    await expect(collision.json()).resolves.toMatchObject({
      error: 'Upload id already used for a different file',
    })
  } finally {
    if (firstBody?.backend === 'local' && firstBody?.name) {
      const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
      await rm(path.join(dir, firstBody.name), { force: true })
    }
  }
})
