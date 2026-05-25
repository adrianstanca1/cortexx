import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const userId = (auth.user as { id?: string }).id
    if (!userId) return NextResponse.json({ error: 'No session id' }, { status: 401 })

    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 100)
      if (name.length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      await prisma.user.update({ where: { id: userId }, data: { name } })
    }

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    })
    return NextResponse.json({ user: updated })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
