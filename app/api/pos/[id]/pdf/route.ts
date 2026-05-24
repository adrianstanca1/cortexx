import { NextRequest, NextResponse } from 'next/server'
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
const AMBER = '#f59e0b'
const TEXT = '#0f172a'
const MUTED = '#64748b'

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_COLOR: Record<string, string> = {
  draft: MUTED,
  sent: AMBER,
  received: '#10b981',
  closed: '#06b6d4',
  cancelled: '#ef4444',
}

export async function GET(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { project: true },
  })
  if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })

  const lineItems: LineItem[] = Array.isArray(po.lineItems) ? (po.lineItems as unknown as LineItem[]) : []
  const sc = STATUS_COLOR[po.status] || MUTED

  const pdfBytes: Buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.rect(0, 0, doc.page.width, 90).fill(SLATE)
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(22).text('PURCHASE ORDER', 48, 30)
    doc.font('Helvetica').fontSize(11).fillColor('#8ea8c5').text(po.number, 48, 60)
    doc.fontSize(10).fillColor('#8ea8c5').text('Cortexx', doc.page.width - 48 - 80, 36, { width: 80, align: 'right' })
    doc.fontSize(9).fillColor('#8ea8c5').text('cortexbuildpro.com', doc.page.width - 48 - 120, 52, { width: 120, align: 'right' })

    const pillW = 90
    const pillX = doc.page.width - 48 - pillW
    doc.roundedRect(pillX, 70, pillW, 14, 3).fill(sc)
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(po.status.toUpperCase(), pillX, 73, { width: pillW, align: 'center' })

    let y = 120
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('SUPPLIER', 48, y)
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(14).text(po.supplier, 48, y + 12)
    if (po.contactEmail) doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(po.contactEmail, 48, y + 32)
    if (po.contactPhone) doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(po.contactPhone, 48, y + 46)

    const rightX = doc.page.width - 48 - 200
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('ORDERED', rightX, y)
    doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(new Date(po.createdAt).toLocaleDateString('en-GB'), rightX, y + 12)
    if (po.expectedDelivery) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('EXPECTED', rightX, y + 32)
      doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(new Date(po.expectedDelivery).toLocaleDateString('en-GB'), rightX, y + 44)
    }
    if (po.project?.name) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PROJECT', rightX, y + 64)
      doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(po.project.name, rightX, y + 76, { width: 200 })
    }

    y = 220
    const cols = { desc: 48, qty: 320, unit: 360, unitPrice: 410, total: doc.page.width - 48 - 70 }
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

    y += 10
    const totalsX = doc.page.width - 48 - 180
    doc.fillColor(MUTED).font('Helvetica').fontSize(10)
    doc.text('Subtotal', totalsX, y); doc.fillColor(TEXT).text(gbp(po.subtotal), totalsX, y, { width: 180, align: 'right' })
    y += 16
    doc.fillColor(MUTED).text(`VAT (${po.vatRate}%)`, totalsX, y); doc.fillColor(TEXT).text(gbp(po.vatAmount), totalsX, y, { width: 180, align: 'right' })
    y += 22
    doc.strokeColor(SLATE).lineWidth(1).moveTo(totalsX, y - 6).lineTo(doc.page.width - 48, y - 6).stroke()
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(13).text('TOTAL', totalsX, y)
    doc.fillColor(sc).text(gbp(po.total), totalsX, y, { width: 180, align: 'right' })

    if (po.notes) {
      y += 40
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('NOTES', 48, y)
      doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(po.notes, 48, y + 12, { width: doc.page.width - 96 })
    }

    const footerY = doc.page.height - 40
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Generated by Cortexx · ${new Date().toLocaleString('en-GB')}`, 48, footerY, { width: doc.page.width - 96, align: 'center' })

    doc.end()
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${po.number}.pdf"`,
      'Content-Length': String(pdfBytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}
