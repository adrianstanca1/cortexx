import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ARTICLES } from '../page'

interface PageProps { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = ARTICLES.find(a => a.slug === slug)
  if (!article) return { title: 'Help — Cortexx' }
  return {
    title: `${article.title} — Cortexx help`,
    description: article.oneLiner,
  }
}

export function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }))
}

export default async function HelpArticle({ params }: PageProps) {
  const { slug } = await params
  const article = ARTICLES.find(a => a.slug === slug)
  if (!article) notFound()

  return (
    <main style={{ background: '#06101e', minHeight: '100dvh', padding: '60px 24px 80px', color: '#eef3fa' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/help" style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a', textDecoration: 'none', marginBottom: 24, display: 'inline-block' }}>
          ← All articles
        </Link>

        <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Help</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 12px', fontFamily: 'var(--font-system)' }}>
          {article.title}
        </h1>
        <p style={{ fontSize: 15, color: '#8ea8c5', lineHeight: 1.5, fontFamily: 'var(--font-system)', margin: '0 0 32px' }}>
          {article.oneLiner}
        </p>

        <div style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
          {article.body.map((p, i) => (
            <p key={i} style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#d6e2f1', lineHeight: 1.7, margin: i === 0 ? '0 0 14px' : '0 0 14px' }}>
              {p}
            </p>
          ))}
        </div>

        <div style={{ marginTop: 32, fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a', textAlign: 'center' }}>
          Need more help? Email <a href="mailto:support@cortexbuildpro.com" style={{ color: '#f59e0b', fontWeight: 600 }}>support@cortexbuildpro.com</a>
        </div>
      </div>
    </main>
  )
}
