import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { canManage } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'
import { reportError } from '@/lib/errors'
export const dynamic = 'force-dynamic'

/** Gate share-token rotation/revoke behind admin+ role — without this a
 *  viewer can DOS the client-facing link. */
function requireManageRole(): NextResponse | null {
  const ctx = getCurrentOrg()
  if (!ctx?.role || !canManage(ctx.role)) {
    return NextResponse.json({ error: 'Only admins can manage share links' }, { status: 403 })
  }
  return null
}

// 16 chars from a URL-safe alphabet — enough entropy for an unguessable
// share token while staying short enough to copy/paste comfortably.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
function generateToken(len = 16): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

// POST = create a share token if missing, or rotate the existing one
export async function POST(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const roleGate = requireManageRole()
  if (roleGate) return roleGate
  try {
    const existing = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Optional expiry on rotation: caller can pass { expiresInDays: 7 } or
    // { expiresAt: ISO } to time-box the link. Default null = never expires.
    const body = await req.json().catch(() => ({}))
    let expiresAt: Date | null = null
    if (typeof body.expiresInDays === 'number' && body.expiresInDays > 0) {
      expiresAt = new Date(Date.now() + Math.min(body.expiresInDays, 365) * 86400000)
    } else if (typeof body.expiresAt === 'string' && body.expiresAt) {
      const d = new Date(body.expiresAt)
      if (!isNaN(d.getTime()) && d.getTime() > Date.now()) expiresAt = d
    }

    // Generate + retry on the unlikely collision
    let token = generateToken()
    for (let i = 0; i < 5; i++) {
      const dup = await prisma.project.findUnique({ where: { shareToken: token }, select: { id: true } })
      if (!dup) break
      token = generateToken()
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { shareToken: token, shareTokenExpiresAt: expiresAt },
      select: { id: true, name: true, shareToken: true, shareTokenExpiresAt: true },
    })

    prisma.activity.create({
      data: {
        projectId: params.id,
        actorName: actorName(auth),
        actorType: 'human',
        action: expiresAt ? `rotated client-view link (expires ${expiresAt.toISOString().slice(0, 10)})` : 'rotated client-view link',
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json(project)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to rotate share token' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const roleGate = requireManageRole()
  if (roleGate) return roleGate
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { shareToken: null, shareTokenExpiresAt: null },
      select: { id: true, shareToken: true },
    })
    prisma.activity.create({
      data: {
        projectId: params.id,
        actorName: actorName(auth),
        actorType: 'human',
        action: `revoked client-view link`,
        iconType: 'trash',
      },
    }).catch(() => {})
    return NextResponse.json(project)
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to revoke share token' }, { status: 500 })
  }
}
