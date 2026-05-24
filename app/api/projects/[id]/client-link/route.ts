import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

// 32 bytes → 64 hex chars. 256 bits of entropy is overkill for an
// anonymous portal link but cheap; matches the "share URL" guidance.
function freshToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, clientToken: true, clientViewEnabled: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '').trim()
    const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, clientToken: true, name: true } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'disable') {
      await prisma.project.update({ where: { id: params.id }, data: { clientViewEnabled: false } })
      prisma.activity.create({
        data: { projectId: params.id, actorName: actorName(auth), actorType: 'human', action: `disabled client portal for ${project.name}`, iconType: 'check' },
      }).catch(() => {})
      return NextResponse.json({ ok: true, clientViewEnabled: false })
    }

    // enable or rotate — both produce a fresh token. Rotate is just "enable
    // again", which invalidates the prior token.
    const wantsRotate = action === 'rotate' || action === 'enable' || !project.clientToken
    const token = wantsRotate ? freshToken() : project.clientToken!
    const updated = await prisma.project.update({
      where: { id: params.id },
      data: { clientToken: token, clientViewEnabled: true },
      select: { id: true, name: true, clientToken: true, clientViewEnabled: true },
    })
    prisma.activity.create({
      data: { projectId: params.id, actorName: actorName(auth), actorType: 'human', action: `${wantsRotate && project.clientToken ? 'rotated' : 'enabled'} client portal for ${project.name}`, iconType: 'check' },
    }).catch(() => {})
    return NextResponse.json(updated)
  } catch (error) {
    console.error('[client-link] POST failed:', error)
    return NextResponse.json({ error: 'Failed to update client link' }, { status: 500 })
  }
}
