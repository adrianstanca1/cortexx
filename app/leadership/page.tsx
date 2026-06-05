'use client'

/**
 * Leadership — exec-view shortcut. Wraps the Executive dashboard
 * variant (v13) but as a permanent URL so leaders can bookmark it.
 * Redirects to /dashboard?v=13 client-side.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LeadershipPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard?v=13')
  }, [router])
  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#52749a', fontSize: 13, fontFamily: 'var(--font-system)' }}>Opening executive view…</p>
    </div>
  )
}
