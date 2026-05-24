import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const SLATE = '#152641'
const TEAL = '#06b6d4'
const TEXT = '#0f172a'
const MUTED = '#64748b'
const GREEN = '#10b981'
const AMBER = '#f59e0b'

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_COLOR: Record<string, string> = {
  received: AMBER,
  approved: TEAL,
  paid: GREEN,
  disputed: '#ef4444',
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const si = await prisma.subInvoice.findUnique({
    where: { id: params.id },
    include: { subcontractor: true, project: true },
  })
  if (!si) return NextResponse.json({ error: 'Sub-invoice not found' }, { status: 404 })

  const sc = STATUS_COLOR[si.status] || MUTED
  const invDate = new Date(si.invoiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const paidDate = si.paidAt ? new Date(si.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  const pdfBytes: Buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.rect(0, 0, doc.page.width, 90).fill(SLATE)
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(22).text('SUB-INVOICE', 48, 30)
    doc.font('Helvetica').fontSize(11).fillColor('#8ea8c5').text(si.number, 48, 60)
    doc.fontSize(10).fillColor('#8ea8c5').text('Cortexx', doc.page.width - 48 - 80, 36, { width: 80, align: 'right' })
    doc.fontSize(9).fillColor('#8ea8c5').text('cortexbuildpro.com', doc.page.width - 48 - 120, 52, { width: 120, align: 'right' })

    const pillW = 90
    const pillX = doc.page.width - 48 - pillW
    doc.roundedRect(pillX, 70, pillW, 14, 3).fill(sc)
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(si.status.toUpperCase(), pillX, 73, { width: pillW, align: 'center' })

    let y = 120
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('SUBCONTRACTOR', 48, y)
    doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(14).text(si.subcontractor.name, 48, y + 12)
    if (si.subcontractor.contactName) doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(si.subcontractor.contactName, 48, y + 32)
    if (si.subcontractor.utrNumber) doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`UTR ${si.subcontractor.utrNumber}`, 48, y + 46)
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`CIS status: ${si.subcontractor.cisStatus.toUpperCase()}`, 48, y + 60)

    const rightX = doc.page.width - 48 - 200
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('INVOICE DATE', rightX, y)
    doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(invDate, rightX, y + 12)
    if (paidDate) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PAID', rightX, y + 32)
      doc.fillColor(GREEN).font('Helvetica').fontSize(11).text(paidDate, rightX, y + 44)
    }
    if (si.project?.name) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('PROJECT', rightX, y + (paidDate ? 64 : 32))
      doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(si.project.name, rightX, y + (paidDate ? 76 : 44), { width: 200 })
    }

    y = 220
    if (si.description) {
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('DESCRIPTION', 48, y)
      doc.fillColor(TEXT).font('Helvetica').fontSize(11).text(si.description, 48, y + 12, { width: doc.page.width - 96 })
      y = doc.y + 14
    }

    // ─── CIS breakdown ────────────────────────────────────────
    doc.fillColor(SLATE).rect(48, y, doc.page.width - 96, 22).fill()
    doc.fillColor('#eef3fa').font('Helvetica-Bold').fontSize(9).text('CIS BREAKDOWN', 56, y + 7)
    y += 30

    const breakdownRow = (label: string, value: number, isNegative = false, isBold = false, isTotal = false) => {
      doc.fillColor(isTotal ? TEXT : MUTED).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 13 : 10).text(label, 48, y)
      doc.fillColor(isTotal ? TEAL : isNegative ? '#ef4444' : TEXT).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 13 : 10).text(`${isNegative ? '−' : ''}${gbp(Math.abs(value))}`, doc.page.width - 48 - 120, y, { width: 120, align: 'right' })
      y += isTotal ? 0 : 18
    }

    breakdownRow('Net amount', si.netAmount)
    breakdownRow(`VAT`, si.vatAmount)
    breakdownRow('Gross', si.grossAmount, false, true)
    y += 4
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(48, y).lineTo(doc.page.width - 48, y).stroke()
    y += 8
    breakdownRow('CIS deduction', si.cisAmount, true)
    y += 6
    doc.strokeColor(SLATE).lineWidth(1).moveTo(48, y).lineTo(doc.page.width - 48, y).stroke()
    y += 14
    breakdownRow('Payable to subcontractor', si.payableAmount, false, true, true)

    if (si.notes) {
      y += 50
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('NOTES', 48, y)
      doc.fillColor(TEXT).font('Helvetica').fontSize(9).text(si.notes, 48, y + 12, { width: doc.page.width - 96 })
    }

    const footerY = doc.page.height - 40
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(`Generated by Cortexx · CIS calculated per HMRC rules · ${new Date().toLocaleString('en-GB')}`, 48, footerY, { width: doc.page.width - 96, align: 'center' })

    doc.end()
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${si.number}.pdf"`,
      'Content-Length': String(pdfBytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}
