import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

function forbidden(role: string | null) {
  return !role || !canManage(role)
    ? NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
    : null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const denied = forbidden(auth.role)
  if (denied) return denied
  try {
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.code !== undefined) {
      const code = String(body.code || '').trim().toUpperCase().slice(0, 32)
      if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 })
      data.code = code
    }
    if (body.name !== undefined) {
      const name = String(body.name || '').trim().slice(0, 160)
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      data.name = name
    }
    if (body.category !== undefined) data.category = String(body.category || '').trim().slice(0, 80) || null
    if (body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 500) || null
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null
    const costCode = await prisma.costCode.update({ where: { id }, data })
    return NextResponse.json(costCode)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'Cost code already exists' }, { status: 409 })
    reportError(error)
    return NextResponse.json({ error: 'Failed to update cost code' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  const denied = forbidden(auth.role)
  if (denied) return denied
  try {
    const { id } = await params
    const costCode = await prisma.costCode.update({ where: { id }, data: { archivedAt: new Date() } })
    return NextResponse.json(costCode)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to archive cost code' }, { status: 500 })
  }
}
