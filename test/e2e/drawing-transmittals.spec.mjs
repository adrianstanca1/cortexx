import { test, expect } from '@playwright/test'
import { signIn } from './helpers/auth.mjs'

const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-local-role-password'
const admin = process.env.E2E_ADMIN_EMAIL || 'admin@cortexbuildpro.tech'
const foreman = process.env.E2E_FOREMAN_EMAIL || 'foreman@cortexbuildpro.tech'

async function createDrawing(request, projectId, suffix) {
  const response = await request.post('/api/drawings', { data: { projectId, number: `TR-${suffix}`, title: `Transmittal ${suffix}` } })
  expect(response.status()).toBe(201)
  const drawing = await response.json()
  const revisionResponse = await request.post(`/api/drawings/${drawing.id}/revisions`, { data: { revision: 'C03', fileName: 'facade-C03.pdf' } })
  expect(revisionResponse.status()).toBe(201)
  return { drawing, revision: await revisionResponse.json() }
}

test('drawing transmittal downloads, pending filter updates, and access is project scoped', async ({ page }) => {
  test.setTimeout(120_000)
  await signIn(page, admin, password)
  const request = page.context().request
  const projects = (await (await request.get('/api/projects')).json()).projects
  const assigned = projects.find(p => p.name === 'E2E Verification Project')
  const restricted = projects.find(p => p.name === 'E2E Admin Only Project')
  const suffix = `${Date.now()}`
  const { drawing, revision } = await createDrawing(request, assigned.id, suffix)
  const privateDrawing = await createDrawing(request, restricted.id, `${suffix}-private`)
  const issueBody = { revisionId: revision.id, recipients: [{ email: foreman }], purpose: 'For construction', message: 'Use this revision for the east facade.' }
  try {
    const invalid = await request.post(`/api/drawings/${drawing.id}/distributions`, { data: { ...issueBody, recipients: [{ email: foreman }, { email: 'invalid' }] } })
    expect(invalid.status()).toBe(400)
    const issuedResponse = await request.post(`/api/drawings/${drawing.id}/distributions`, { data: issueBody })
    expect(issuedResponse.status()).toBe(201)
    const issued = await issuedResponse.json()
    const privateResponse = await request.post(`/api/drawings/${privateDrawing.drawing.id}/distributions`, { data: { ...issueBody, revisionId: privateDrawing.revision.id } })
    expect(privateResponse.status()).toBe(201)
    const privateIssue = await privateResponse.json()

    await page.goto('/drawings')
    await page.getByText(`Transmittal ${suffix}`, { exact: true }).click()
    const panel = page.getByRole('region', { name: 'Drawing issues and transmittals' })
    await expect(panel.getByText('1 issues · 0/1 acknowledged · 1 pending')).toBeVisible()
    const downloadEvent = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Download transmittal for revision C03' }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe(`transmittal-${issued.id}.pdf`)
    expect(await download.failure()).toBeNull()
    await panel.getByLabel('Pending acknowledgements only').check()
    await panel.getByRole('button', { name: 'Record acknowledgement' }).click()
    await expect(panel.getByText('No pending acknowledgements.')).toBeVisible()
    await panel.getByLabel('Pending acknowledgements only').uncheck()
    await expect(panel.getByText(/Recorded by/)).toContainText(admin)
    const pdf = await request.get(`/api/drawing-distributions/${issued.id}/transmittal`)
    expect(pdf.status()).toBe(200)
    expect(pdf.headers()['content-type']).toContain('application/pdf')
    expect(pdf.headers()['cache-control']).toContain('no-store')
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')

    await signIn(page, foreman, password)
    expect((await request.get(`/api/drawing-distributions/${issued.id}/transmittal`)).status()).toBe(200)
    expect((await request.get(`/api/drawing-distributions/${privateIssue.id}/transmittal`)).status()).toBe(404)
    expect((await request.get(`/api/drawings/${privateDrawing.drawing.id}/distributions`)).status()).toBe(404)
    expect((await request.post(`/api/drawings/${drawing.id}/distributions`, { data: issueBody })).status()).toBe(403)
    expect((await request.post(`/api/drawing-distributions/${privateIssue.id}/recipients/${privateIssue.recipients[0].id}/acknowledge`)).status()).toBe(404)
  } finally {
    await signIn(page, admin, password)
    await request.delete(`/api/drawings/${drawing.id}`)
    await request.delete(`/api/drawings/${privateDrawing.drawing.id}`)
  }
})
