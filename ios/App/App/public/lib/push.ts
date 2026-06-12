/**
 * Web Push helpers.
 *
 * VAPID keys are required for push delivery. Set them as env vars:
 *   VAPID_PUBLIC_KEY=...      (also exposed to the client as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_CONTACT_EMAIL=admin@cortexbuildpro.com
 *
 * Generate keys: `npx web-push generate-vapid-keys`
 *
 * If keys are absent, /api/push/subscribe still accepts subscriptions
 * (so users can opt-in once an admin sets the keys), but sendPush() is
 * a no-op and logs a warning.
 */
import webpush from 'web-push'
import { prisma } from './db'

const PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
const CONTACT = process.env.VAPID_CONTACT_EMAIL || 'admin@cortexbuildpro.com'

let configured = false
export function isPushConfigured(): boolean {
  if (configured) return true
  if (!PUBLIC || !PRIVATE) return false
  try {
    webpush.setVapidDetails(`mailto:${CONTACT}`, PUBLIC, PRIVATE)
    configured = true
    return true
  } catch {
    return false
  }
}

export function publicVapidKey(): string | null {
  return PUBLIC || null
}

export interface PushPayload {
  title: string
  body: string
  url?: string         // path to open on click
  tag?: string         // collapse-key for replacing prior notifications
  icon?: string
  badge?: string
}

/**
 * Notification category — used to honour per-user notification preferences.
 * Subscriptions belonging to users who have disabled the category's push
 * channel are filtered out before delivery.
 */
export type PushCategory = 'tasks' | 'safety' | 'invoices' | 'announcements'

const CATEGORY_TO_PREF: Record<PushCategory, 'tasksPush' | 'safetyPush' | 'invoicesPush' | 'announcementsPush'> = {
  tasks: 'tasksPush',
  safety: 'safetyPush',
  invoices: 'invoicesPush',
  announcements: 'announcementsPush',
}

/**
 * Send a push notification to one or more subscriptions. Stale
 * subscriptions (410 Gone / 404) are auto-deleted from the DB.
 *
 * Pass `userId` to dispatch to every device that user has subscribed,
 * or omit and pass `endpoints` for ad-hoc targeting. When `category` is
 * provided, subscriptions belonging to users who have disabled that
 * category's push channel are filtered out.
 */
export async function sendPush(opts: {
  payload: PushPayload
  userId?: string
  endpoints?: string[]
  category?: PushCategory
}): Promise<{ delivered: number; pruned: number; skipped: boolean }> {
  if (!isPushConfigured()) return { delivered: 0, pruned: 0, skipped: true }

  const subs = await prisma.pushSubscription.findMany({
    where: opts.userId
      ? { userId: opts.userId }
      : opts.endpoints
        ? { endpoint: { in: opts.endpoints } }
        : {},
  })

  // Honour per-user notification preferences when a category is specified.
  // Subscriptions without a userId (legacy / not signed-in) pass through.
  let allowedSubs = subs
  if (opts.category) {
    const prefField = CATEGORY_TO_PREF[opts.category]
    const userIds = Array.from(new Set(subs.map(s => s.userId).filter(Boolean) as string[]))
    if (userIds.length > 0) {
      const prefs = await prisma.notificationPreference.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, [prefField]: true } as { userId: true } & Record<typeof prefField, true>,
      })
      const disabledUserIds = new Set(
        prefs.filter(p => (p as Record<string, unknown>)[prefField] === false).map(p => p.userId),
      )
      allowedSubs = subs.filter(s => !s.userId || !disabledUserIds.has(s.userId))
    }
  }

  const body = JSON.stringify({
    title: opts.payload.title.slice(0, 80),
    body: opts.payload.body.slice(0, 200),
    url: opts.payload.url || '/',
    tag: opts.payload.tag,
    icon: opts.payload.icon || '/icon-192.png',
    badge: opts.payload.badge || '/icon-192.png',
  })

  let delivered = 0
  let pruned = 0
  const stale: string[] = []

  await Promise.all(
    allowedSubs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
        delivered++
        // Update lastUsed best-effort
        prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastUsed: new Date() } }).catch(() => {})
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode
        // 404 Gone / 410 — subscription is dead, prune it.
        if (code === 404 || code === 410) {
          stale.push(sub.id)
        } else {
          console.error('Push send error', sub.id, code, err)
        }
      }
    })
  )

  if (stale.length > 0) {
    const res = await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } })
    pruned = res.count
  }

  return { delivered, pruned, skipped: false }
}
