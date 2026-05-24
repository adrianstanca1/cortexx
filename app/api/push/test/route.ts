import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

/**
 * Send a test push to all of the current user's subscriptions. Used by
 * the Settings → Notifications "Send test" button.
 */
export async function POST(_req: NextRequest) {
  const session = await requireAuth()
  if (session instanceof NextResponse) return session
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user id in session' }, { status: 401 })

  const result = await sendPush({
    userId,
    payload: {
      title: 'Cortexx test notification',
      body: 'Push delivery is working. You\'ll get notified about new tasks, overdue invoices, and site events.',
      url: '/dashboard',
      tag: 'cortexx-test',
    },
  })

  if (result.skipped) {
    return NextResponse.json({ error: 'Push is not configured on the server. Set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars.', code: 'PUSH_NOT_CONFIGURED' }, { status: 503 })
  }
  return NextResponse.json(result)
}
