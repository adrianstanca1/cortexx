import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_CIS = new Set(['gross', '20', '30'])

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.trade !== undefined) data.trade = body.trade?.toString().trim() || null
    if (body.contactName !== undefined) data.contactName = body.contactName?.toString().trim() || null
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.toString().trim() || null
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.toString().trim() || null
    if (body.address !== undefined) data.address = body.address?.toString().trim() || null
    if (body.postcode !== undefined) data.postcode = body.postcode?.toString().trim() || null
    if (body.cisStatus !== undefined && ALLOWED_CIS.has(body.cisStatus)) data.cisStatus = body.cisStatus
    if (body.utrNumber !== undefined) data.utrNumber = body.utrNumber?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null
    if (body.insuranceExpiry !== undefined) {
      if (body.insuranceExpiry) {
        const d = new Date(body.insuranceExpiry)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid insuranceExpiry' }, { status: 400 })
        data.insuranceExpiry = d
      } else data.insuranceExpiry = null
    }
    if (body.qualificationsExpiry !== undefined) {
      if (body.qualificationsExpiry) {
        const d = new Date(body.qualificationsExpiry)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid qualificationsExpiry' }, { status: 400 })
        data.qualificationsExpiry = d
      } else data.qualificationsExpiry = null
    }
    const sub = await prisma.subcontractor.update({ where: { id: params.id }, data })
    return NextResponse.json(sub)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.subcontractor.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
