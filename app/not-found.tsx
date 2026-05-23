import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, color: '#f59e0b', fontWeight: 700 }}>404</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-system)', fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.02em' }}>
        Page not found
      </h1>
      <p style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', textAlign: 'center', maxWidth: 320 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        style={{ background: '#f59e0b', color: '#fff', borderRadius: 12, padding: '12px 24px', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
      >
        Go to dashboard
      </Link>
    </div>
  )
}
