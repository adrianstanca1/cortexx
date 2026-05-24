import { NextRequest, NextResponse } from 'next/server'
// pdfkit ships its own CJS entry; importing the default works with esModuleInterop.
import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

interface LineItem {
  description: string
  quantity: number
  unit?: string | null
  unitPrice: number
  total: number
}

const SLATE = '#152641'
const TEAL = '#06b6d4'
const TEXT = '#0f172a'
const MUTED = '#64748b'

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { customer: true },
  })
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  // pdfkit streams chunks — collect them into a single Buffer for the
  // response body (Next 14's Response constructor wants an ArrayBuffer / Buffer).
  const lineItems: LineItem[] = Array.isArray(quote.lineItems) ? (quote.lineItems as unknown as LineItem[]) : []

  const pdfBytes: Buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ─── Header band ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(SLATE)
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(22).text('QUOTE', 48, 30)
    doc.font('Helvetica').fontSize(11).fillColor('#8ea8c5').text(quote.number, 48, 60)
    doc.fontSize(10).fillColor('#8ea8c5').text('Cortexx', doc.page.width - 48 - 80, 36, { width: 80, align: 'right' })
    doc.fontSize(9).fillColor('#8ea8c5').text('cortexbuildpro.com', doc.page.width - 48 - 120, 52, { width: 120, align: 'right' })

    // ─── Meta block ───────────────────────────────────────────
    doc.moveDown(2)
    let y = 120
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('FOR', 48, y)
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(14).text(quote.customerName, 48, y + 12)
    if (quote.customer?.contactName) doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(quote.customer.contactName, 48, y + 32)
    if (quote.customer?.contactEmail) doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(quote.customer.contactEmail, 48, y + 46)

    // Right column: dates + status
    const rightX = doc.page.width - 48 - 200
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('ISSUED', rightX, y)
    doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(new Date(quote.createdAt).toLocaleDateString('en-GB'), rightX, y + 12)
    if (quote.validUntil) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('VALID UNTIL', rightX, y + 32)
      doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(new Date(quote.validUntil).toLocaleDateString('en-GB'), rightX, y + 44)
    }
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('STATUS', rightX, y + 64)
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(11).text(quote.status.toUpperCase(), rightX, y + 76)

    // ─── Title + description ──────────────────────────────────
    y = 210
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(16).text(quote.title, 48, y, { width: doc.page.width - 96 })
    if (quote.description) {
      doc.moveDown(0.4)
      doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(quote.description, { width: doc.page.width - 96 })
    }

    // ─── Line items table ─────────────────────────────────────
    y = (doc.y || 260) + 14
    const cols = {
      desc: 48,
      qty: 320,
      unit: 360,
      unitPrice: 410,
      total: doc.page.width - 48 - 70,
    }
    doc.fillColor(SLATE).rect(48, y, doc.page.width - 96, 22).fill()
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(9)
    doc.text('DESCRIPTION', cols.desc + 8, y + 7)
    doc.text('QTY', cols.qty, y + 7, { width: 40, align: 'right' })
    doc.text('UNIT', cols.unit, y + 7, { width: 40, align: 'left' })
    doc.text('UNIT PRICE', cols.unitPrice, y + 7, { width: 70, align: 'right' })
    doc.text('TOTAL', cols.total, y + 7, { width: 60, align: 'right' })
    y += 26

    doc.fillColor(TEXT).font('Helvetica').fontSize(10)
    for (const it of lineItems) {
      // Page-break: leave room for totals at the bottom of the page (~140px).
      if (y > doc.page.height - 200) {
        doc.addPage()
        y = 60
      }
      const descHeight = doc.heightOfString(it.description || '—', { width: cols.qty - cols.desc - 16 })
      doc.text(it.description || '—', cols.desc + 8, y, { width: cols.qty - cols.desc - 16 })
      doc.text(String(it.quantity), cols.qty, y, { width: 40, align: 'right' })
      doc.fillColor(MUTED).text(it.unit || 'item', cols.unit, y, { width: 40, align: 'left' })
      doc.fillColor(TEXT).text(gbp(it.unitPrice), cols.unitPrice, y, { width: 70, align: 'right' })
      doc.font('Helvetica-Bold').text(gbp(it.total), cols.total, y, { width: 60, align: 'right' })
      doc.font('Helvetica')
      y += Math.max(descHeight, 12) + 6
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(48, y - 2).lineTo(doc.page.width - 48, y - 2).stroke()
    }

    // ─── Totals ───────────────────────────────────────────────
    y += 10
    const totalsX = doc.page.width - 48 - 180
    doc.fillColor(MUTED).font('Helvetica').fontSize(10)
    doc.text('Subtotal', totalsX, y); doc.fillColor(TEXT).text(gbp(quote.subtotal), totalsX, y, { width: 180, align: 'right' })
    y += 16
    doc.fillColor(MUTED).text(`VAT (${quote.vatRate}%)`, totalsX, y); doc.fillColor(TEXT).text(gbp(quote.vatAmount), totalsX, y, { width: 180, align: 'right' })
    y += 22
    doc.strokeColor(SLATE).lineWidth(1).moveTo(totalsX, y - 6).lineTo(doc.page.width - 48, y - 6).stroke()
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(13).text('TOTAL', totalsX, y)
    doc.fillColor(TEAL).text(gbp(quote.total), totalsX, y, { width: 180, align: 'right' })

    // ─── Terms ────────────────────────────────────────────────
    if (quote.terms) {
      y += 40
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('TERMS', 48, y)
      doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(quote.terms, 48, y + 12, { width: doc.page.width - 96 })
    }

    // ─── Footer ───────────────────────────────────────────────
    const footerY = doc.page.height - 40
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Generated by Cortexx · ${new Date().toLocaleString('en-GB')}`, 48, footerY, { width: doc.page.width - 96, align: 'center' })

    doc.end()
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quote.number}.pdf"`,
      'Content-Length': String(pdfBytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}
