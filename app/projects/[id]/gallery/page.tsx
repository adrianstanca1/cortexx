'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcChevL, IcCamera, IcReceipt, IcDoc } from '@/components/ui/Icons'

interface Doc {
  id: string
  name: string
  type: string
  createdAt: string
  expiresAt: string | null
}

const TYPE_ICONS: Record<string, { Icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  photo: { Icon: IcCamera, color: '#2563eb' },
  receipt: { Icon: IcReceipt, color: '#10b981' },
  rams: { Icon: IcDoc, color: '#f59e0b' },
  report: { Icon: IcDoc, color: '#8b5cf6' },
  quote: { Icon: IcDoc, color: '#06b6d4' },
  permit: { Icon: IcDoc, color: '#ef4444' },
}

export default function ProjectGalleryPage() {
  const { id } = useParams<{ id: string }>()
  const [docs, setDocs] = useState<Doc[]>([])
  const [projectName, setProjectName] = useState('Project')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/documents?projectId=${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ])
      .then(([d, p]) => {
        setDocs(d.documents || [])
        setProjectName(p.project?.name || 'Project')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const types = Array.from(new Set(docs.map(d => d.type))).sort()
  const filtered = docs.filter(d => filter === 'all' || d.type === filter)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href={`/projects/${id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>{projectName}</span>
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: 'var(--font-system)' }}>Gallery</h1>
        <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: 'var(--font-system)' }}>
          {docs.length} document{docs.length === 1 ? '' : 's'} · {docs.filter(d => d.type === 'photo').length} photo{docs.filter(d => d.type === 'photo').length === 1 ? '' : 's'}
        </p>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginTop: 10 }}>
          {['all', ...types].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 99, border: 'none', background: filter === t ? '#f59e0b' : 'rgba(255,255,255,0.06)', color: filter === t ? '#fff' : '#52749a', fontFamily: 'var(--font-system)', fontSize: 12, fontWeight: filter === t ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#52749a', fontFamily: 'var(--font-system)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 13 }}>No documents{filter !== 'all' ? ` of type "${filter}"` : ''} yet.</p>
            <Link href="/capture" style={{ display: 'inline-block', marginTop: 16, padding: '10px 18px', borderRadius: 12, background: '#f59e0b', color: '#fff', textDecoration: 'none', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 700 }}>
              Capture →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {filtered.map(d => {
              const meta = TYPE_ICONS[d.type] || { Icon: IcDoc, color: '#52749a' }
              const Icon = meta.Icon
              return (
                <div key={d.id} style={{ background: '#152641', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 110, background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={42} color={meta.color} />
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: '#eef3fa', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ fontFamily: 'var(--font-system)', fontSize: 10, color: '#52749a', marginTop: 2 }}>
                      <span style={{ textTransform: 'capitalize' }}>{d.type}</span> · {new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  )
}
