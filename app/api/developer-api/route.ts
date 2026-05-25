import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { canManage } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const MAX_TAKE = 200

// Fields safe to return to the client. Notably EXCLUDES `hash` — the
// secret hash never leaves the server. The plaintext secret is only
// returned ONCE, on creation, and never persisted in plain form.
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

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const sp = req.nextUrl.searchParams
    const take = Math.min(parseInt(sp.get('take') || '50') || 50, MAX_TAKE)
    const skip = Math.max(0, parseInt(sp.get('skip') || '0') || 0)
    const items = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      take, skip,
      select: SAFE_SELECT,
    })
    const total = await prisma.apiKey.count()
    return NextResponse.json({ items, total, hasMore: skip + items.length < total })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  // Issuing an API key is admin-only — it grants programmatic access
  // to org data with the issuer's scopes.
  const role = getCurrentOrg()?.role
  if (!role || !canManage(role)) {
    return NextResponse.json({ error: 'Forbidden — admin role required to issue API keys' }, { status: 403 })
  }
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited
  try {
    const body = await req.json().catch(() => ({}))

    // Reject any client-supplied `hash` — the secret + hash are server-
    // generated. Allowing client input let an attacker set their own
    // hash and then craft a matching plaintext to authenticate.
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : 'Untitled key'
    const scopes = typeof body.scopes === 'string' ? body.scopes.trim().slice(0, 280) : ''

    // 32 bytes → 43-char URL-safe base64 plaintext secret.
    const secret = crypto.randomBytes(32).toString('base64url')
    const prefix = secret.slice(0, 8)
    const hash = crypto.createHash('sha256').update(secret).digest('hex')

    const item = await prisma.apiKey.create({
      data: { name, prefix, hash, scopes },
      select: SAFE_SELECT,
    })

    // Return the plaintext secret ONCE so the client can copy it.
    // Subsequent GETs never expose it again (only the prefix).
    return NextResponse.json({ item, secret }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
