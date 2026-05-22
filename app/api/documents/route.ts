import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const documents = await prisma.document.findMany({
      where: { ...(projectId && { projectId }) },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ documents })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 })
    }
    if (!body.type?.trim()) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }
    const document = await prisma.document.create({
      data: {
        name: body.name.trim(),
        type: body.type.trim(),
        projectId: body.projectId || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: { project: true },
    })
    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
