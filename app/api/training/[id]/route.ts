import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog, requestMeta } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.holderName !== undefined) {
      const v = String(body.holderName).trim()
      if (!v) return NextResponse.json({ error: 'Holder name cannot be empty' }, { status: 400 })
      data.holderName = v
    }
    if (body.type !== undefined) {
      const v = String(body.type).trim()
      if (!v) return NextResponse.json({ error: 'Type cannot be empty' }, { status: 400 })
      data.type = v
    }
    if (body.number !== undefined) data.number = body.number?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.memberId !== undefined) data.memberId = body.memberId || null
    if (body.issuedDate !== undefined) {
      if (body.issuedDate) {
        const d = new Date(body.issuedDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid issuedDate' }, { status: 400 })
        data.issuedDate = d
      } else data.issuedDate = null
    }
    if (body.expiryDate !== undefined) {
      if (body.expiryDate) {
        const d = new Date(body.expiryDate)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expiryDate' }, { status: 400 })
        data.expiryDate = d
      } else data.expiryDate = null
    }

    const cert = await prisma.certification.update({
      where: { id: params.id },
      data,
      include: { member: { select: { id: true, name: true, role: true } } },
    })
    return NextResponse.json(cert)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update certification' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.certification.delete({ where: { id: params.id } })
    auditLog({
      action: 'certification.delete',
      resourceType: 'Certification',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete certification' }, { status: 500 })
  }
}
