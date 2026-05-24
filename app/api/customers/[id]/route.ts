import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      quotes: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ customer })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.contactName !== undefined) data.contactName = body.contactName?.toString().trim() || null
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.toString().trim() || null
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.toString().trim() || null
    if (body.address !== undefined) data.address = body.address?.toString().trim() || null
    if (body.postcode !== undefined) data.postcode = body.postcode?.toString().trim() || null
    if (body.notes !== undefined) data.notes = body.notes?.toString().trim() || null
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null

    const customer = await prisma.customer.update({ where: { id: params.id }, data })
    return NextResponse.json(customer)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    await prisma.customer.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
