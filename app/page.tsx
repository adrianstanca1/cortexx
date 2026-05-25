import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Home — bounces by auth state:
 *   • Signed in  → /dashboard (the app)
 *   • Signed out → /marketing (the static marketing page from the
 *     Claude Design canvas, served via the next.config.js rewrite)
 *
 * Makes cortexbuildpro.com the marketing landing for unauthenticated
 * visitors instead of immediately bouncing them to /login.
 */
export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')
  redirect('/marketing')
}
