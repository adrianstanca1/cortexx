import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'auth')
  if (limited) return limited
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = body.name ? String(body.name).trim().slice(0, 100) : null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (password.length > 200) {
      return NextResponse.json({ error: 'Password too long' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    try {
      const user = await prisma.user.create({
        data: { email, passwordHash, name },
        select: { id: true, email: true, name: true, role: true },
      })
      return NextResponse.json({ user }, { status: 201 })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
