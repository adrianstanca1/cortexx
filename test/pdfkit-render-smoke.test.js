// PDFKit 0.21 render smoke — the four financial PDF routes plus the drawing
// transmittal builder render real documents. CI checks build and tests but
// never actually renders a PDF through these paths; this file does, with
// auth/db mocked, and fails if pdfkit's reworked fontkit/linebreak stack
// produces an invalid or empty document (e.g. after a pdfkit upgrade).
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const realPdfkit = require('pdfkit')

class NextResponse {
  constructor(body, init = {}) { this.body = body; this.status = (init && init.status) || 200; this.headers = (init && init.headers) || {} }
  static json(body, options = {}) { return new NextResponse(body, { status: options.status || 200 }) }
}

// Transpile a TS route/lib and run it in a sandbox where only the external
// 'pdfkit' import is real (with CJS default-import interop, as pdfkit ships
// its own CJS entry); everything else comes from the supplied mocks.
function load(file, mocks) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (name === 'pdfkit') return Object.assign(realPdfkit, { default: realPdfkit })
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`)
      return mocks[name]
    },
    Date, Buffer, URL, Response,
  })
  return exports
}

const auth = { session: { user: { id: 'user-1' } }, userId: 'user-1', orgId: 'org-1', role: 'admin' }
const authMocks = {
  'next/server': { NextResponse },
  '@/lib/requireAuth': { requireAuth: async () => auth, requireOrg: async () => auth },
  '@/lib/rbac': load('lib/rbac.ts', {}),
}

const fixtures = {
  invoice: {
    number: 'INV-2026-001', status: 'overdue', issuedDate: '2026-11-01', dueDate: '2026-11-15',
    paidDate: null, clientName: 'Acme Developments Ltd', amount: 12345.67,
    netAmount: 10288.06, vatAmount: 2057.61, vatRate: 20, notes: 'Stage 3 payment — retention applied per contract.',
    project: { name: 'Harbour Point', address: '12 Quay Road', postcode: 'BS1 4TT' },
  },
  quote: {
    number: 'QT-2026-014', status: 'draft', createdAt: '2026-11-20T09:00:00.000Z', validUntil: '2026-12-20',
    title: 'Loft conversion — Harbour Point', description: 'Full structural loft conversion with dormer.',
    lineItems: [
      { description: 'Structural timber frame and steel RSJ', quantity: 1, unit: 'lot', unitPrice: 3400, total: 3400 },
      { description: 'Roof tiling, lead flashing and guttering', quantity: 120, unit: 'm²', unitPrice: 22.5, total: 2700 },
    ],
    subtotal: 6100, vatRate: 20, vatAmount: 1220, total: 7320,
    terms: '50% deposit on acceptance; balance on completion.',
    customerName: 'Mrs J Whitfield', customer: { contactName: 'Joan Whitfield', contactEmail: 'joan.whitfield@example.com' },
  },
  subInvoice: {
    number: 'SI-2026-003', status: 'approved', invoiceDate: '2026-11-05', paidAt: null,
    description: 'Roof package, application 3.', netAmount: 8000, vatAmount: 1600, grossAmount: 9600,
    cisAmount: 1440, payableAmount: 8160, notes: 'CIS deducted at source per scheme.',
    subcontractor: { name: 'Edge Roofing Ltd', contactName: 'Sami Orr', utrNumber: '1234567890', cisStatus: 'active' },
    project: { name: 'Harbour Point' },
  },
  purchaseOrder: {
    number: 'PO-2026-008', status: 'sent', createdAt: '2026-11-18T10:30:00.000Z', expectedDelivery: '2026-11-28',
    supplier: 'Buildbase Supplies', contactEmail: 'orders@buildbase.example', contactPhone: '0117 555 0142',
    lineItems: [
      { description: 'C24 timber 47×100mm (4.8m)', quantity: 64, unit: 'each', unitPrice: 11.4, total: 729.6 },
      { description: 'OSB3 11mm sheeting', quantity: 30, unit: 'sheet', unitPrice: 24.8, total: 744 },
    ],
    subtotal: 1473.6, vatRate: 20, vatAmount: 294.72, total: 1768.32,
    notes: 'Deliver to site store; call before arrival.',
    project: { name: 'Harbour Point' },
  },
}

const prismaMocks = {
  '@/lib/db': {
    prisma: {
      invoice: { findUnique: async () => fixtures.invoice },
      quote: { findFirst: async () => fixtures.quote },
      subInvoice: { findUnique: async () => fixtures.subInvoice },
      purchaseOrder: { findUnique: async () => fixtures.purchaseOrder },
    },
  },
}

const routes = {
  invoice: load('app/api/invoices/[id]/pdf/route.ts', { ...authMocks, ...prismaMocks }),
  quote: load('app/api/quotes/[id]/pdf/route.ts', { ...authMocks, ...prismaMocks }),
  subInvoice: load('app/api/sub-invoices/[id]/pdf/route.ts', { ...authMocks, ...prismaMocks }),
  purchaseOrder: load('app/api/pos/[id]/pdf/route.ts', { ...authMocks, ...prismaMocks }),
}

function request() {
  return { nextUrl: new URL('https://example.test/api/financial-pdf') }
}
function context() {
  return { params: Promise.resolve({ id: 'record-1' }) }
}

/** A rendered document must be a structurally valid, non-trivial PDF. */
function assertValidPdf(res, label) {
  assert.equal(res instanceof NextResponse, true, `${label}: returns a NextResponse`)
  assert.equal(res.status, 200, `${label}: status 200`)
  assert.equal(res.headers['Content-Type'], 'application/pdf', `${label}: PDF content type`)
  assert.match(String(res.headers['Content-Disposition']), /\.pdf"$/, `${label}: attachment filename`)
  const buf = Buffer.from(res.body)
  assert.ok(buf.length > 2000, `${label}: document has real content (${buf.length} bytes)`)
  assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-', `${label}: %PDF- header`)
  assert.ok(buf.lastIndexOf('%%EOF') > buf.length - 64, `${label}: %%EOF trailer`)
  assert.ok(buf.includes(Buffer.from('/Type /Page', 'ascii')), `${label}: contains a page object`)
  assert.ok(buf.includes(Buffer.from('/Font', 'ascii')), `${label}: text was rendered with fonts`)
}

test('invoice PDF route renders a valid document through pdfkit', async () => {
  assertValidPdf(await routes.invoice.GET(request(), context()), 'invoice')
})

test('quote PDF route renders a valid document with line items through pdfkit', async () => {
  assertValidPdf(await routes.quote.GET(request(), context()), 'quote')
})

test('sub-invoice PDF route renders a valid CIS breakdown through pdfkit', async () => {
  assertValidPdf(await routes.subInvoice.GET(request(), context()), 'sub-invoice')
})

test('purchase order PDF route renders a valid document with line items through pdfkit', async () => {
  assertValidPdf(await routes.purchaseOrder.GET(request(), context()), 'purchase order')
})

test('drawing transmittal builder renders a valid document through pdfkit', async () => {
  const { buildDrawingTransmittal } = load('lib/drawing-transmittal.ts', {})
  const buf = await buildDrawingTransmittal({
    id: 'tr-2026-11-07',
    purpose: 'For construction',
    message: 'Revision C supersedes B on site.',
    issuedAt: '2026-11-21T14:05:00.000Z',
    drawing: { number: 'HP-DR-104', title: 'First floor plan', project: { name: 'Harbour Point' } },
    revision: { revision: 'C', fileName: 'HP-DR-104-revC.pdf' },
    recipients: [
      { email: 'site@edge-roofing.example', name: 'Sami Orr', acknowledgedAt: '2026-11-21T15:00:00.000Z', acknowledgedBy: 'Sami Orr' },
      { email: 'qs@acme.example', name: null, acknowledgedAt: null, acknowledgedBy: null },
    ],
  }, 'Cortex Construct')
  assert.ok(Buffer.isBuffer(buf) && buf.length > 2000, `transmittal: real content (${buf.length} bytes)`)
  assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-', 'transmittal: %PDF- header')
  assert.ok(buf.lastIndexOf('%%EOF') > buf.length - 64, 'transmittal: %%EOF trailer')
  assert.ok(buf.includes(Buffer.from('/Type /Page', 'ascii')), 'transmittal: contains a page object')
})

test('the financial-admin-gated quote PDF route denies viewers before rendering', async () => {
  // Only the quote PDF route is gated by requireOrg + canManage; the
  // invoice, sub-invoice and purchase-order PDF routes authenticate only.
  const viewer = {
    ...authMocks,
    '@/lib/requireAuth': { requireAuth: async () => auth, requireOrg: async () => ({ ...auth, role: 'viewer' }) },
    ...prismaMocks,
  }
  const quote = load('app/api/quotes/[id]/pdf/route.ts', viewer)
  const res = await quote.GET(request(), context())
  assert.equal(res.status, 403, 'quote: viewer denied')
})
