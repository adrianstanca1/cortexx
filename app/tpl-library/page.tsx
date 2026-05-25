'use client'

/**
 * Template library — categorised browse for organisation templates.
 * /templates is the create-and-list view; /tpl-library is the
 * read-mostly browse view organised by category, with preview cards.
 */
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcDoc } from '@/components/ui/Icons'

interface Template {
  id: string
  name: string | null
  description: string | null
  category: string | null
  version: string | null
  body: string | null
  createdAt: string
}

const CATEGORY_COLOR: Record<string, string> = {
  rams: '#ef4444',
  contract: '#f59e0b',
  quote: '#10b981',
  invoice: '#10b981',
  email: '#06b6d4',
  letter: '#06b6d4',
  default: '#8ea8c5',
}

export default function TplLibraryPage() {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setItems(d.items || []))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach(i => i.category && set.add(i.category))
    return Array.from(set).sort()
  }, [items])

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 12 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>All apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eef3fa', letterSpacing: '-0.03em', fontFamily: 'var(--font-system)', margin: 0 }}>
              Template library
            </h1>
            <p style={{ fontSize: 13, color: '#8ea8c5', fontFamily: 'var(--font-system)', margin: '4px 0 0' }}>
              Browse and reuse workspace templates.{' '}
              <Link href="/templates" style={{ color: '#f59e0b', textDecoration: 'none' }}>Create one →</Link>
            </p>
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {(['all', ...categories]).map(c => {
            const active = filter === c
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                style={{
                  flexShrink: 0,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: active ? '#152641' : 'transparent',
                  border: '0.5px solid ' + (active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'),
                  color: '#eef3fa',
                  fontFamily: 'var(--font-system)',
                  fontSize: 12,
                  cursor: 'pointer',
                  textTransform: c === 'all' ? 'capitalize' : 'lowercase',
                }}
              >
                {c}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <p style={{ color: '#52749a', padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#52749a', fontSize: 13, padding: 60, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
            <IcDoc size={32} color="#52749a" />
            <p style={{ marginTop: 12 }}>
              {filter === 'all'
                ? <>No templates yet. <Link href="/templates" style={{ color: '#f59e0b', textDecoration: 'none' }}>Create the first one →</Link></>
                : `No templates in this category.`}
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {filtered.map(t => {
              const color = (t.category && CATEGORY_COLOR[t.category]) || CATEGORY_COLOR.default
              return (
                <li key={t.id} style={{ background: '#152641', borderRadius: 12, padding: 14, border: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-system)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <IcDoc size={14} color={color} />
                    <span style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                      {t.category || 'general'}
                    </span>
                    {t.version && <span style={{ fontSize: 10, color: '#52749a' }}>v{t.version}</span>}
                  </div>
                  <div style={{ fontSize: 14, color: '#eef3fa', fontWeight: 700, marginBottom: 4 }}>{t.name || 'Untitled'}</div>
                  {t.description && (
                    <p style={{ fontSize: 12, color: '#8ea8c5', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <TabBar />
    </div>
  )
}
