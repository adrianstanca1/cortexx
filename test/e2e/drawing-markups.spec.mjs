import { test, expect } from '@playwright/test'
import { signIn } from './helpers/auth.mjs'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const admin = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const foreman = process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.com'

async function createDrawing(request, projectId, suffix) {
  const response = await request.post('/api/drawings', {
    data: { projectId, number: 'MK-' + suffix, title: 'Markup ' + suffix },
  })
  expect(response.status()).toBe(201)
  const drawing = await response.json()
  const uploadResponse = await request.post('/api/uploads', {
    multipart: {
      file: {
        name: 'markup-reference.png',
        mimeType: 'image/png',
        buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
      },
    },
  })
  expect(uploadResponse.status()).toBe(201)
  const upload = await uploadResponse.json()
  const revisionResponse = await request.post('/api/drawings/' + drawing.id + '/revisions', {
    data: {
      revision: 'M01',
      fileUrl: upload.url,
      fileName: 'markup-reference.png',
      fileSize: upload.size,
      mimeType: upload.mimeType,
    },
  })
  expect(revisionResponse.status()).toBe(201)
  return { drawing, revision: await revisionResponse.json() }
}
test('drawing markups persist on exact revisions and respect project assignment', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page, admin, password)
  let request = page.context().request
  const projects = (await (await request.get('/api/projects')).json()).projects
  const assigned = projects.find(project => project.name === 'E2E Verification Project')
  const restricted = projects.find(project => project.name === 'E2E Admin Only Project')
  expect(assigned).toBeTruthy()
  expect(restricted).toBeTruthy()

  const suffix = String(Date.now())
  const assignedDrawing = await createDrawing(request, assigned.id, suffix)
  const privateDrawing = await createDrawing(request, restricted.id, suffix + '-private')

  try {
    const invalid = await request.post('/api/drawing-revisions/' + assignedDrawing.revision.id + '/markups', {
      data: { page: 1, kind: 'pin', x: 1.5, y: 0.4, text: 'Invalid' },
    })
    expect(invalid.status()).toBe(400)

    const createdResponse = await request.post('/api/drawing-revisions/' + assignedDrawing.revision.id + '/markups', {
      data: { page: 1, kind: 'pin', x: 0.25, y: 0.4, text: 'Check fixing zone', color: '#f59e0b' },
    })
    expect(createdResponse.status()).toBe(201)
    const created = await createdResponse.json()

    const list = await request.get('/api/drawing-revisions/' + assignedDrawing.revision.id + '/markups?page=1&status=open')
    expect(list.status()).toBe(200)
    const listed = await list.json()
    expect(listed.permissions.annotate).toBe(true)
    expect(listed.markups.some(markup => markup.id === created.id)).toBe(true)

    const resolved = await request.patch('/api/drawing-markups/' + created.id, { data: { status: 'resolved' } })
    expect(resolved.status()).toBe(200)
    expect((await resolved.json()).resolvedAt).toBeTruthy()

    const reopened = await request.patch('/api/drawing-markups/' + created.id, {
      data: { status: 'open', text: 'Check revised fixing zone' },
    })
    expect(reopened.status()).toBe(200)

    const privateMarkupResponse = await request.post('/api/drawing-revisions/' + privateDrawing.revision.id + '/markups', {
      data: { page: 1, kind: 'box', x: 0.3, y: 0.3, width: 0.2, height: 0.12, text: 'Private note' },
    })
    expect(privateMarkupResponse.status()).toBe(201)
    const privateMarkup = await privateMarkupResponse.json()
    await page.goto('/drawings', { waitUntil: 'domcontentloaded' })
    await page.getByText('Markup ' + suffix, { exact: true }).click()
    const detail = page.getByRole('heading', { name: 'Markup ' + suffix })
    await expect(detail).toBeVisible()
    await page.getByRole('button', { name: /^Markup \d+$/ }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Markup revision M01' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Check revised fixing zone')).toBeVisible()
    await dialog.getByTestId('drawing-markup-surface').click({ position: { x: 180, y: 160 } })
    const draftNote = dialog.getByPlaceholder(/Describe the issue/)
    await draftNote.fill('Confirm bracket centres')
    await dialog.getByRole('button', { name: 'Save annotation' }).click()
    await expect(dialog.getByText('Confirm bracket centres')).toBeVisible()

    await dialog.getByRole('button', { name: 'Close markup' }).click()
    await signIn(page, foreman, password)
    request = page.context().request

    expect((await request.get('/api/drawings/' + assignedDrawing.drawing.id)).status()).toBe(200)
    expect((await request.get('/api/drawings/' + privateDrawing.drawing.id)).status()).toBe(404)
    const privateList = await request.get('/api/drawings?projectId=' + encodeURIComponent(restricted.id))
    expect(privateList.status()).toBe(200)
    expect((await privateList.json()).drawings).toHaveLength(0)
    expect((await request.post('/api/drawings', { data: { projectId: assigned.id, title: 'Foreman must not create drawing' } })).status()).toBe(403)
    expect((await request.post('/api/drawings/' + assignedDrawing.drawing.id + '/revisions', { data: { revision: 'M02' } })).status()).toBe(403)
    expect((await request.post('/api/drawings/' + privateDrawing.drawing.id + '/compare', {
      data: { aRev: privateDrawing.revision.id, bRev: assignedDrawing.revision.id },
    })).status()).toBe(404)

    expect((await request.get('/api/drawing-revisions/' + assignedDrawing.revision.id + '/markups')).status()).toBe(200)
    expect((await request.get('/api/drawing-revisions/' + privateDrawing.revision.id + '/markups')).status()).toBe(404)

    const privateCreate = await request.post('/api/drawing-revisions/' + privateDrawing.revision.id + '/markups', {
      data: { page: 1, kind: 'pin', x: 0.5, y: 0.5, text: 'Should not be visible' },
    })
    expect(privateCreate.status()).toBe(404)
    const foremanCreate = await request.post('/api/drawing-revisions/' + assignedDrawing.revision.id + '/markups', {
      data: { page: 1, kind: 'pin', x: 0.55, y: 0.52, text: 'Foreman coordination note', color: '#2563eb' },
    })
    expect(foremanCreate.status()).toBe(201)
    const foremanMarkup = await foremanCreate.json()

    const foremanResolve = await request.patch('/api/drawing-markups/' + created.id, { data: { status: 'resolved' } })
    expect(foremanResolve.status()).toBe(200)
    expect((await request.patch('/api/drawing-markups/' + privateMarkup.id, { data: { status: 'resolved' } })).status()).toBe(404)
    expect((await request.delete('/api/drawing-markups/' + foremanMarkup.id)).status()).toBe(200)
  } finally {
    await signIn(page, admin, password)
    request = page.context().request
    await request.delete('/api/drawings/' + assignedDrawing.drawing.id)
    await request.delete('/api/drawings/' + privateDrawing.drawing.id)
  }
})
