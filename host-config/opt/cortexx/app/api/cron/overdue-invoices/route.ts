import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron'
import { bypassTenancy } from '@/lib/tenancy'
import { legacyPool } from '@/lib/legacyDb'
import { sendEmail, overdueDigestTemplate } from '@/lib/email'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

interface InvoiceRow {
  id: string
  workspaceId: string
  number: string
  clientName: string
  amount: number
  dueDate: Date
  daysOverdue: number
}

const PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
const CONTACT = process.env.VAPID_CONTACT_EMAIL || process.env.VAPID_SUBJECT || 'admin@cortexbuildpro.com'

let vapidConfigured = false
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  if (!PUBLIC || !PRIVATE) return false
  try {
    const subject = CONTACT.startsWith('mailto:') ? CONTACT : `mailto:${CONTACT}`
    webpush.setVapidDetails(subject, PUBLIC, PRIVATE)
    vapidConfigured = true
    return true
  } catch {
    return false
  }
}

/**
 * GET is used only by the Docker healthcheck. It does not mutate data and
 * does not require the cron secret.
 */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'overdue-invoices' })
}

/**
 * Daily scan: promote invoices with status='due' and past due date to
 * 'overdue', then notify each workspace's users via push + email digest.
 * Built against the legacy schema (workspaces, invoices, users,
 * push_subscriptions).
 */
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  return bypassTenancy(() => runOverdueScan())
}

async function runOverdueScan() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Step 1: promote due → overdue across all workspaces.
  const promoteResult = await legacyPool.query(
    `UPDATE invoices
     SET status = 'overdue'
     WHERE status = 'due'
       AND due IS NOT NULL
       AND due < $1`,
    [today],
  )
  const promoted = promoteResult.rowCount ?? 0

  // Step 2: gather the current overdue invoices, grouped by workspace.
  const overdueResult = await legacyPool.query(
    `SELECT i.id, i.workspace_id, i.client, i.amount::float, i.due
     FROM invoices i
     WHERE i.status = 'overdue'
       AND i.due IS NOT NULL
       AND i.due < $1
     ORDER BY i.workspace_id, i.due`,
    [today],
  )

  const rows: InvoiceRow[] = overdueResult.rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    number: r.id,
    clientName: r.client || '',
    amount: Number(r.amount) || 0,
    dueDate: new Date(r.due),
    daysOverdue: Math.floor((now.getTime() - new Date(r.due).getTime()) / 86_400_000),
  }))

  if (rows.length === 0) {
    return NextResponse.json({ overdueCount: 0, promoted, orgsNotified: 0, emailsSent: 0 })
  }

  // Bucket by workspace.
  const byWorkspace = new Map<string, { workspaceName: string; rows: InvoiceRow[] }>()
  for (const inv of rows) {
    let bucket = byWorkspace.get(inv.workspaceId)
    if (!bucket) {
      const wsRes = await legacyPool.query('SELECT name FROM workspaces WHERE id = $1', [inv.workspaceId])
      bucket = { workspaceName: wsRes.rows[0]?.name || 'Workspace', rows: [] }
      byWorkspace.set(inv.workspaceId, bucket)
    }
    bucket.rows.push(inv)
  }

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://cortexbuildpro.com'
  let totalEmails = 0
  const orgErrors: Array<{ orgId: string; error: string }> = []

  const CONCURRENCY = 5
  const entries = Array.from(byWorkspace.entries())

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const slice = entries.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(slice.map(([workspaceId, bucket]) => processWorkspace(workspaceId, bucket, appUrl)))
    settled.forEach((res, idx) => {
      if (res.status === 'rejected') {
        orgErrors.push({ orgId: slice[idx][0], error: String(res.reason).slice(0, 280) })
      } else {
        totalEmails += res.value.emailsSent
      }
    })
  }

  return NextResponse.json({
    overdueCount: rows.length,
    promoted,
    orgsNotified: byWorkspace.size - orgErrors.length,
    orgsFailed: orgErrors.length,
    errors: orgErrors,
    emailsSent: totalEmails,
  })
}

async function processWorkspace(
  workspaceId: string,
  bucket: { workspaceName: string; rows: InvoiceRow[] },
  appUrl: string,
): Promise<{ emailsSent: number }> {
  const total = bucket.rows.reduce((s, r) => s + r.amount, 0)

  // Load users in this workspace.
  const usersRes = await legacyPool.query(
    'SELECT id, name, email FROM users WHERE workspace_id = $1 AND disabled = false',
    [workspaceId],
  )
  const users = usersRes.rows as Array<{ id: string; name: string; email: string }>

  // Push notifications to subscribed devices.
  await sendWorkspacePush(users.map((u) => u.id), bucket, total).catch((err) => {
    console.error('[cron/overdue-invoices] push failed for workspace', workspaceId, err)
  })

  // Email digest to every user in the workspace (legacy schema has no
  // notification preferences table yet, so we default to all active users).
  let emailsSent = 0
  await Promise.allSettled(
    users.map(async (user) => {
      if (!user.email) return
      const tmpl = overdueDigestTemplate({
        recipientName: user.name || user.email.split('@')[0],
        organizationName: bucket.workspaceName,
        invoices: bucket.rows,
        appUrl,
      })
      const res = await sendEmail({ to: user.email, subject: tmpl.subject, html: tmpl.html, text: tmpl.text })
      if (res.delivered > 0) emailsSent++
    }),
  )

  return { emailsSent }
}

async function sendWorkspacePush(
  userIds: string[],
  bucket: { workspaceName: string; rows: InvoiceRow[] },
  total: number,
): Promise<void> {
  if (!ensureVapid() || userIds.length === 0) return

  const subsRes = await legacyPool.query(
    `SELECT endpoint, sub
     FROM push_subscriptions
     WHERE user_id = ANY($1::text[])
       AND endpoint IS NOT NULL`,
    [userIds],
  )

  const payload = JSON.stringify({
    title: `📒 ${bucket.rows.length} overdue invoice${bucket.rows.length === 1 ? '' : 's'}`,
    body: `£${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} outstanding · ${bucket.workspaceName}`,
    url: '/invoices',
    tag: `overdue-daily-${bucket.rows[0]?.workspaceId || 'unknown'}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })

  const stale: (string | number)[] = []

  await Promise.all(
    subsRes.rows.map(async (row) => {
      const sub = typeof row.sub === 'string' ? JSON.parse(row.sub) : row.sub
      const keys = sub?.keys || {}
      if (!keys.p256dh || !keys.auth) return
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys }, payload)
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          stale.push(row.id ?? row.endpoint)
        } else {
          console.error('[cron/overdue-invoices] push send error', row.endpoint, code, err)
        }
      }
    }),
  )

  if (stale.length > 0) {
    await legacyPool.query('DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])', [stale]).catch(() => {})
  }
}
