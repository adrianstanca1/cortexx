import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * Home — bounces by auth state:
 *   • Signed in  → /dashboard (the app)
 *   • Signed out → /legacy/Cortexx-standalone.html (the full designer
 *     PWA from the Claude Design canvas)
 *
 * The proxy normally rewrites `/` → standalone HTML before this handler
 * runs (see proxy.ts). This is a fallback for cases the proxy lets
 * through. Matching destination so behaviour stays consistent.
 */
export default async function Home() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')
  redirect('/legacy/Cortexx-standalone.html')
}
