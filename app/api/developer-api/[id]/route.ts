import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { auditLog } from '@/lib/audit'
import { canManage } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

// Same safe-field set as the collection route — `hash` is the secret and
// never goes back to the client after the one-shot reveal in POST.
const SAFE_SELECT = {
  id: true,
  organizationId: true,
  name: true,
  prefix: true,
  scopes: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  try {
    const item = await prisma.apiKey.findUnique({ where: { id }, select: SAFE_SELECT })
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    // Allow renaming + scope edits only. `hash`/`prefix` are immutable
    // from the API surface — rotating a key means delete + create new.
    const item = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(typeof body.name === 'string' ? { name: body.name.trim().slice(0, 80) } : {}),
        ...(typeof body.scopes === 'string' ? { scopes: body.scopes.trim().slice(0, 280) } : {}),
      },
      select: SAFE_SELECT,
    })
    return NextResponse.json({ item })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const role = getCurrentOrg()?.role
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  const { id } = await params
  try {
    await prisma.apiKey.delete({ where: { id } })
    await auditLog({
      userId: (auth.user as { id?: string }).id,
      action: 'developer-api.delete',
      resourceType: 'apiKey',
      resourceId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
