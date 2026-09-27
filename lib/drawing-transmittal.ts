import PDFDocument from 'pdfkit'

type DateValue = Date | string
export interface TransmittalData {
  id: string
  purpose: string
  message: string | null
  issuedAt: DateValue
  drawing: { number: string; title: string; project: { name: string } }
  revision: { revision: string; fileName: string | null }
  recipients: { email: string; name: string | null; acknowledgedAt: DateValue | null; acknowledgedBy: string | null }[]
}

const date = (value: DateValue) => new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
export function transmittalFilename(id: string) {
  return `transmittal-${id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'drawing'}.pdf`
}

/** Reads only the recorded issue and its exact revision, never the latest revision. */
export function buildDrawingTransmittal(data: TransmittalData, company: string, generatedAt = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 70, left: 48, right: 48 }, bufferPages: true, info: { Title: `Drawing transmittal ${data.id}`, Author: company } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('error', reject)
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    const text = (value: string) => doc.font('Helvetica').fontSize(10).fillColor('#25354a').text(value, { width: 499, lineGap: 3 })
    const heading = (value: string) => { doc.moveDown(); doc.font('Helvetica-Bold').fontSize(11).fillColor('#123654').text(value); doc.moveDown(0.3) }
    doc.font('Helvetica-Bold').fontSize(23).fillColor('#123654').text('DRAWING TRANSMITTAL')
    doc.moveDown(0.5)
    text(company)
    text(`Reference: ${data.id}`)
    text(`Issued: ${date(data.issuedAt)}`)
    text(`Generated: ${date(generatedAt)}`)
    heading('Drawing and revision')
    text(`Project: ${data.drawing.project.name}`)
    text(`Drawing: ${data.drawing.number} — ${data.drawing.title}`)
    text(`Issued revision: ${data.revision.revision}`)
    text(`File: ${data.revision.fileName || 'No file recorded'}`)
    text(`Purpose: ${data.purpose}`)
    if (data.message) { heading('Issue instructions'); text(data.message) }
    heading('Acknowledgement register')
    const acknowledged = data.recipients.filter(r => r.acknowledgedAt).length
    text(`${acknowledged} of ${data.recipients.length} acknowledged; ${data.recipients.length - acknowledged} pending.`)
    for (const recipient of data.recipients) {
      if (doc.y > 690) doc.addPage()
      doc.moveDown(0.6)
      text(`${recipient.name ? `${recipient.name} — ` : ''}${recipient.email}`)
      text(recipient.acknowledgedAt
        ? `Acknowledged: ${date(recipient.acknowledgedAt)} | Recorded by: ${recipient.acknowledgedBy || 'Not recorded'}`
        : 'Awaiting acknowledgement')
    }
    heading('Record notes')
    text('This transmittal records a drawing issue in CortexBuild. It does not confirm email delivery or replace design approval. Acknowledgements reflect the register at the generated time. Drawing and project descriptions reflect their current register values; the issued revision is fixed.')
    const pages = doc.bufferedPageRange()
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i)
      const bottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`CortexBuild Pro | Page ${i + 1} of ${pages.count}`, 48, doc.page.height - 40, { width: 499, lineBreak: false })
      doc.page.margins.bottom = bottom
    }
    doc.end()
  })
}
