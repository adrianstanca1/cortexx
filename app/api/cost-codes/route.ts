import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOrg } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  try {
    const includeArchived = new URL(req.url).searchParams.get('archived') === 'true'
    const codes = await prisma.costCode.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ codes })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to fetch cost codes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg()
  if (auth instanceof NextResponse) return auth
  if (!canManage(auth.role || '')) return NextResponse.json({ error: 'Company Admin permission required' }, { status: 403 })
  try {
    const body = await req.json()
    const code = String(body.code || '').trim().toUpperCase().slice(0, 32)
    const name = String(body.name || '').trim().slice(0, 160)
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    const costCode = await prisma.costCode.create({ data: {
      code, name,
      category: String(body.category || '').trim().slice(0, 80) || null,
      description: String(body.description || '').trim().slice(0, 500) || null,
    } })
    return NextResponse.json(costCode, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Cost code already exists' }, { status: 409 })
    }
    reportError(error)
    return NextResponse.json({ error: 'Failed to create cost code' }, { status: 500 })
  }
}
