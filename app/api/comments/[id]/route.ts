import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/requireAuth'
import { auditLog, requestMeta } from '@/lib/audit'
import { canManage } from '@/lib/rbac'
import { getCurrentOrg } from '@/lib/tenancy'
import { reportError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const authorId = (auth.user as { id?: string }).id
    // Authorization is per-org, not global. Previously read session.user.role
    // (the global User.role) which let a globally-admin user delete comments
    // in orgs where they were only a member/viewer. canManage(org.role)
    // correctly maps to per-org admin/owner.
    const orgRole = getCurrentOrg()?.role
    const c = await prisma.comment.findUnique({ where: { id: params.id }, select: { authorId: true } })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (c.authorId !== authorId && !canManage(orgRole || '')) {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 })
    }
    await prisma.comment.delete({ where: { id: params.id } })
    auditLog({
      action: 'comment.delete',
      resourceType: 'Comment',
      resourceId: params.id,
      ...requestMeta(req),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
