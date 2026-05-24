import Link from 'next/link'
import type { ReactNode } from 'react'

interface LegalShellProps {
  title: string
  updated?: string
  children: ReactNode
}

/**
 * Shared shell for /privacy, /terms, /support.
 * Ported from cortexx-pwa/privacy.html (shared visual language).
 */
export default function LegalShell({ title, updated, children }: LegalShellProps) {
  return (
    <div style={{
      background: '#06101e',
      color: '#e8eef7',
      minHeight: '100dvh',
      fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
      lineHeight: 1.6,
    }}>
      <style>{`
        .legal-wrap { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; }
        .legal-wrap h1 { font-size: 36px; font-weight: 800; letter-spacing: -0.8px; margin: 0 0 8px; color: #e8eef7; }
        .legal-wrap .updated { color: #7a9cc0; font-size: 13px; margin: 0 0 40px; }
        .legal-wrap h2 { font-size: 22px; font-weight: 700; margin: 40px 0 12px; letter-spacing: -0.3px; color: #e8eef7; }
        .legal-wrap h3 { font-size: 16px; font-weight: 700; margin: 24px 0 8px; color: #e8eef7; }
        .legal-wrap p, .legal-wrap li { font-size: 15px; color: #a8bdd5; }
        .legal-wrap ul { padding-left: 22px; margin: 8px 0; }
        .legal-wrap li { margin-bottom: 6px; }
        .legal-wrap strong { color: #e8eef7; font-weight: 600; }
        .legal-wrap a { color: #60a5fa; }
        .legal-wrap .back { display: inline-block; margin-bottom: 32px; color: #7a9cc0; font-size: 13px; text-decoration: none; }
        .legal-wrap .back:hover { color: #e8eef7; }
        .legal-wrap .box { background: #0e1828; border: 0.5px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 18px 22px; margin: 20px 0; }
        .legal-wrap .box.tldr { border-color: rgba(96,165,250,0.4); background: rgba(37,99,235,0.08); }
        .legal-wrap .box.tldr p { color: #e8eef7; font-size: 15px; margin: 0; }
        .legal-wrap table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
        .legal-wrap th, .legal-wrap td { padding: 10px 12px; text-align: left; border-bottom: 0.5px solid rgba(255,255,255,0.07); vertical-align: top; }
        .legal-wrap th { color: #e8eef7; font-weight: 600; font-size: 13px; }
        .legal-wrap td { color: #a8bdd5; }
        .legal-wrap details { background: #0e1828; border: 0.5px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 18px; margin: 10px 0; }
        .legal-wrap details summary { cursor: pointer; font-size: 15px; font-weight: 600; color: #e8eef7; outline: none; }
        .legal-wrap details p { margin: 10px 0 4px; }
        .legal-wrap .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 24px 0 36px; }
        .legal-wrap .card { background: #0e1828; border: 0.5px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px 20px; text-decoration: none; display: block; transition: border-color 0.15s; }
        .legal-wrap .card:hover { border-color: rgba(96,165,250,0.4); }
        .legal-wrap .card .ico { font-size: 24px; margin-bottom: 8px; }
        .legal-wrap .card .t { color: #e8eef7; font-weight: 600; font-size: 15px; }
        .legal-wrap .card .s { color: #7a9cc0; font-size: 13px; margin-top: 2px; }
        .legal-wrap .sub { color: #7a9cc0; font-size: 15px; margin: 0 0 16px; }
      `}</style>
      <div className="legal-wrap">
        <Link href="/" className="back">← Back to Cortexx</Link>
        <h1>{title}</h1>
        {updated && <p className="updated">{updated}</p>}
        {children}
      </div>
    </div>
  )
}
