import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const user = session.user as {
    id?: string
    email?: string | null
    name?: string | null
    role?: string
    organizations?: Array<{ id: string; slug: string; name: string; role: string }>
  }
  return NextResponse.json({ user })
}
