import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

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
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const existing = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Generate + retry on the unlikely collision
    let token = generateToken()
    for (let i = 0; i < 5; i++) {
      const dup = await prisma.project.findUnique({ where: { shareToken: token }, select: { id: true } })
      if (!dup) break
      token = generateToken()
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { shareToken: token },
      select: { id: true, name: true, shareToken: true },
    })

    prisma.activity.create({
      data: {
        projectId: params.id,
        actorName: actorName(auth),
        actorType: 'human',
        action: `rotated client-view link`,
        iconType: 'check',
      },
    }).catch(() => {})

    return NextResponse.json(project)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to rotate share token' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const project = await prisma.project.update({
      where: { id: params.id },
      data: { shareToken: null },
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
    console.error(error)
    return NextResponse.json({ error: 'Failed to revoke share token' }, { status: 500 })
  }
}
