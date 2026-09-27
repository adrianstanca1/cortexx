import { test, expect } from '@playwright/test'
import { signIn } from './helpers/auth.mjs'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const admin = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.com'
const foreman = process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.com'

test('project files and document mutations enforce assignment permissions', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page, admin, password)
  let request = page.context().request
  const projects = (await (await request.get('/api/projects')).json()).projects
  const assigned = projects.find(p => p.name === 'E2E Verification Project')
  const privateProject = projects.find(p => p.name === 'E2E Admin Only Project')
  expect(assigned).toBeTruthy()
  expect(privateProject).toBeTruthy()
  const docs = []
  let drawing
  try {
    for (const project of [assigned, privateProject]) {
      const uploadResponse = await request.post('/api/uploads', { multipart: {
        file: { name: 'permission-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfile permission regression\n%%EOF') },
      } })
      expect(uploadResponse.status()).toBe(201)
      const upload = await uploadResponse.json()
      const response = await request.post('/api/documents', { data: {
        name: 'File access ' + Date.now(), type: 'report', projectId: project.id,
        url: upload.url, size: upload.size, mimeType: upload.mimeType,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      } })
      expect(response.status()).toBe(201)
      docs.push(await response.json())
    }
    const drawingResponse = await request.post('/api/drawings', { data: { projectId: privateProject.id, number: 'FILE-' + Date.now(), title: 'Private file access' } })
    expect(drawingResponse.status()).toBe(201)
    drawing = await drawingResponse.json()
    const revision = await request.post('/api/drawings/' + drawing.id + '/revisions', { data: { revision: 'A', fileUrl: docs[1].url, fileName: 'private.pdf', mimeType: 'application/pdf' } })
    expect(revision.status()).toBe(201)
    expect((await request.get(docs[1].url)).status()).toBe(200)
    expect((await request.put('/api/drawings/' + drawing.id, { data: { archived: true } })).status()).toBe(200)
    const activeDrawings = await (await request.get('/api/drawings?projectId=' + privateProject.id)).json()
    expect(activeDrawings.drawings.some(row => row.id === drawing.id)).toBe(false)
    const archivedDrawings = await (await request.get('/api/drawings?status=archived&projectId=' + privateProject.id)).json()
    expect(archivedDrawings.drawings.some(row => row.id === drawing.id)).toBe(true)
    expect((await request.put('/api/drawings/' + drawing.id, { data: { archived: false } })).status()).toBe(200)

    await signIn(page, foreman, password)
    request = page.context().request
    expect((await request.get(docs[0].url)).status()).toBe(200)
    expect((await request.get(docs[1].url)).status()).toBe(404)
    expect((await request.get(docs[1].url + '?download=1', { headers: { Range: 'bytes=0-3' } })).status()).toBe(404)
    expect((await request.get('/api/documents/' + docs[1].id)).status()).toBe(404)
    expect((await request.post('/api/documents/' + docs[1].id + '/tag')).status()).toBe(404)
    const expiring = await (await request.get('/api/documents/expiring')).json()
    expect(expiring.documents.some(doc => doc.id === docs[1].id)).toBe(false)
    expect(expiring.documents.some(doc => doc.id === docs[0].id)).toBe(true)
    const privateList = await request.get('/api/documents?projectId=' + privateProject.id)
    expect(privateList.status()).toBe(200)
    expect((await privateList.json()).documents).toHaveLength(0)
    expect((await request.put('/api/documents/' + docs[1].id, { data: { name: 'Forbidden' } })).status()).toBe(404)
    expect((await request.delete('/api/documents/' + docs[1].id)).status()).toBe(404)
    expect((await request.put('/api/documents/' + docs[0].id, { data: { projectId: privateProject.id } })).status()).toBe(404)
    expect((await request.post('/api/documents', { data: { name: 'Forbidden', type: 'report', projectId: privateProject.id } })).status()).toBe(404)
    expect((await request.put('/api/documents/' + docs[0].id, { data: { name: 'Allowed update' } })).status()).toBe(200)
    const ranged = await request.get(docs[0].url, { headers: { Range: 'bytes=0-3' } })
    expect(ranged.status()).toBe(206)
    expect(await ranged.text()).toBe('%PDF')
    expect(ranged.headers()['cache-control']).toContain('no-store')
  } finally {
    await signIn(page, admin, password)
    request = page.context().request
    if (drawing) await request.delete('/api/drawings/' + drawing.id)
    for (const doc of docs) await request.delete('/api/documents/' + doc.id)
  }
})
