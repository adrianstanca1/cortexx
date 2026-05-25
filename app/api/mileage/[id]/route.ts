import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const ALLOWED_VEHICLE = new Set(['car', 'van', 'motorbike'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const existing = await prisma.mileageEntry.findUnique({
      where: { id: params.id },
      select: { miles: true, ratePence: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (body.fromAddress !== undefined) {
      const v = String(body.fromAddress).trim()
      if (!v) return NextResponse.json({ error: 'From address cannot be empty' }, { status: 400 })
      data.fromAddress = v
    }
    if (body.toAddress !== undefined) {
      const v = String(body.toAddress).trim()
      if (!v) return NextResponse.json({ error: 'To address cannot be empty' }, { status: 400 })
      data.toAddress = v
    }
    if (body.fromPostcode !== undefined) data.fromPostcode = body.fromPostcode?.toString().trim() || null
    if (body.toPostcode !== undefined) data.toPostcode = body.toPostcode?.toString().trim() || null
    if (body.purpose !== undefined) data.purpose = body.purpose?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.vehicleType !== undefined && ALLOWED_VEHICLE.has(body.vehicleType)) data.vehicleType = body.vehicleType
    if (body.approved !== undefined) data.approved = body.approved === true
    if (body.date !== undefined) {
      const d = new Date(body.date)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
      data.date = d
    }
    if (body.miles !== undefined) {
      const v = Number(body.miles)
      if (isNaN(v) || v <= 0 || v > 2000) return NextResponse.json({ error: 'Miles must be 0-2000' }, { status: 400 })
      data.miles = v
    }
    if (body.ratePence !== undefined) {
      const v = Number(body.ratePence)
      if (isNaN(v) || v < 0 || v > 200) return NextResponse.json({ error: 'Rate must be 0-200 pence' }, { status: 400 })
      data.ratePence = v
    }
    if (data.miles !== undefined || data.ratePence !== undefined) {
      const miles = data.miles !== undefined ? (data.miles as number) : existing.miles
      const ratePence = data.ratePence !== undefined ? (data.ratePence as number) : existing.ratePence
      data.amount = (miles * ratePence) / 100
    }

    const entry = await prisma.mileageEntry.update({
      where: { id: params.id },
      data,
      include: { member: { select: { id: true, name: true } } },
    })
    return NextResponse.json(entry)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update mileage entry' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.mileageEntry.delete({ where: { id: params.id } })
    auditLog({
      action: 'mileageEntry.delete',
      resourceType: 'MileageEntry',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
