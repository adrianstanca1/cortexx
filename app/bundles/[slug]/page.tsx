'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'
import { BUNDLES, BUNDLE_SLUGS, type Bundle, type BundlePage } from '@/lib/bundles'
import {
  IcChevL,
  IcSpark,
  IcSend,
  IcDoc,
  IcWrench,
  IcLayers,
  IcAlert,
  IcReceipt,
  IcHardhat,
  IcCheck,
  IcPin,
  IcCamera,
  IcClock,
  IcTeam,
  IcPound,
} from '@/components/ui/Icons'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  doc: IcDoc,
  wrench: IcWrench,
  check: IcCheck,
  hardhat: IcHardhat,
  pin: IcPin,
  camera: IcCamera,
  alert: IcAlert,
  layers: IcLayers,
  team: IcTeam,
  clock: IcClock,
  receipt: IcReceipt,
  pound: IcPound,
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const SF = 'var(--font-system)'

export default function BundlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const b = BUNDLES.find(x => x.slug === slug)
    if (b) setBundle(b)
  }, [slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!bundle) {
    return (
      <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontFamily: SF }}>
        Unknown role pack
      </div>
    )
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch(`/api/bundles/${bundle.slug}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Ask failed')
      setMessages([...next, { role: 'assistant', content: data.content || 'No response' }])
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Ask failed', type: 'error' })
      setMessages(messages)
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/bundles" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Role packs</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${bundle.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IcLayers size={22} color={bundle.color} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>{bundle.title}</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>{bundle.subtitle}</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {bundle.pages.map(p => {
            const Icon = ICON_MAP[p.icon] || IcDoc
            return (
              <Link
                key={p.href}
                href={p.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 10px',
                  borderRadius: 10,
                  background: '#152641',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  textDecoration: 'none',
                }}
              >
                <Icon size={18} color={p.color} />
                <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: '#eef3fa' }}>{p.label}</span>
              </Link>
            )
          })}
        </div>

        <div style={{ background: '#152641', borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcSpark size={16} color={bundle.color} />
            <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: '#eef3fa' }}>Ask the {bundle.title.split(' ')[0]} agent</span>
          </div>

          <div style={{ padding: 12, maxHeight: '45vh', overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <div style={{ color: '#52749a', fontFamily: SF, fontSize: 13, padding: '12px 4px' }}>
                Ask anything about {bundle.subtitle.toLowerCase()}. The agent knows the pages in this pack and current workspace context.
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '90%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: m.role === 'user' ? bundle.color : '#0a1426',
                      color: m.role === 'user' ? '#fff' : '#c1d2e8',
                      fontFamily: SF,
                      fontSize: 13,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: 10, borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about this role pack…"
              rows={1}
              style={{
                flex: 1,
                background: '#0a1426',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#eef3fa',
                fontFamily: SF,
                fontSize: 14,
                outline: 'none',
                resize: 'none',
                minHeight: 40,
              }}
            />
            <Button variant="primary" loading={loading} onClick={send} style={{ height: 40, padding: '0 14px' }}>
              <IcSend size={16} color="#fff" />
            </Button>
          </div>
        </div>
      </div>

      <TabBar />
    </div>
  )
}
