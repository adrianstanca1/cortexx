'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcPlus, IcX, IcCheck } from '@/components/ui/Icons'
import { useModalEffects } from '@/lib/useModalEffects'

type CostCode = {
  id: string
  code: string
  name: string
  category: string | null
  description: string | null
  archivedAt: string | null
  _count?: { costEntries: number; purchaseOrders: number }
}

const SF = 'var(--font-system)'

export default function CostCodesPage() {
  const [codes, setCodes] = useState<CostCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)
  const [form, setForm] = useState({ code: '', name: '', category: '', description: '' })

  useModalEffects(showAdd, () => setShowAdd(false))

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cost-codes?includeArchived=${showArchived ? 'true' : 'false'}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load cost codes')
      setCodes(json.codes || [])
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to load cost codes', type: 'error' })
    } finally { setLoading(false) }
  }, [showArchived])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/cost-codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to create cost code')
      setShowAdd(false)
      setForm({ code: '', name: '', category: '', description: '' })
      setToast({ msg: `Cost code ${json.code} created` })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to create cost code', type: 'error' })
    } finally { setSaving(false) }
  }

  const toggleArchived = async (code: CostCode) => {
    try {
      const res = await fetch(`/api/cost-codes/${code.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: !code.archivedAt }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to update cost code')
      setToast({ msg: code.archivedAt ? 'Cost code restored' : 'Cost code archived' })
      await load()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Failed to update cost code', type: 'error' })
    }
  }

  return <div style={{ minHeight: '100dvh', background: 'var(--bg0)', paddingBottom: 96 }}>
    {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <header style={{ padding: '18px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
      <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 9 }}><IcChevL size={18} color="var(--t3)" /><span style={{ fontFamily: SF, fontSize: 13, color: 'var(--t3)' }}>Apps</span></Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div><h1 style={{ fontFamily: SF, fontSize: 22, fontWeight: 800, color: 'var(--t1)' }}>Cost codes</h1><p style={{ fontFamily: SF, fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>One coding structure for POs, receipts and subcontract cost.</p></div>
        <button type="button" onClick={() => setShowAdd(true)} aria-label="Add cost code" style={{ width: 38, height: 38, border: 0, borderRadius: 11, background: '#f59e0b', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IcPlus size={18} color="#fff" /></button>
      </div>
      <button type="button" onClick={() => { setLoading(true); setShowArchived(v => !v) }} style={{ marginTop: 10, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, background: showArchived ? 'rgba(245,158,11,0.12)' : 'transparent', color: showArchived ? '#f59e0b' : 'var(--t2)', padding: '5px 10px', fontFamily: SF, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{showArchived ? 'Showing archived' : 'Show archived'}</button>
    </header>

    {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontFamily: SF }}>Loading cost codes…</div> : codes.length === 0 ? <div style={{ padding: '64px 28px', textAlign: 'center' }}><div style={{ fontFamily: SF, fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>No cost codes yet</div><div style={{ fontFamily: SF, fontSize: 12, color: 'var(--t2)', marginTop: 5 }}>Create codes such as MAT, LAB, PLANT, SUB and PRELIMS.</div></div> : <main style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
      {codes.map(c => <div key={c.id} style={{ background: 'var(--surface-raised)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 13, padding: 13, opacity: c.archivedAt ? 0.58 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}><span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#f59e0b', fontWeight: 900 }}>{c.code}</span><span style={{ fontFamily: SF, fontSize: 14, color: 'var(--t1)', fontWeight: 700 }}>{c.name}</span></div><div style={{ fontFamily: SF, fontSize: 10, color: 'var(--t2)', marginTop: 3 }}>{c.category || 'Uncategorised'} · {c._count?.costEntries || 0} actual entries · {c._count?.purchaseOrders || 0} POs</div>{c.description && <div style={{ fontFamily: SF, fontSize: 10, color: '#6f8cac', marginTop: 5 }}>{c.description}</div>}</div>
          <button type="button" onClick={() => toggleArchived(c)} style={{ alignSelf: 'center', border: `1px solid ${c.archivedAt ? '#10b98155' : '#ef444455'}`, background: c.archivedAt ? '#10b98112' : '#ef444412', color: c.archivedAt ? '#10b981' : '#ef4444', borderRadius: 8, padding: '6px 8px', fontFamily: SF, fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{c.archivedAt ? 'Restore' : 'Archive'}</button>
        </div>
      </div>)}
    </main>}
    <TabBar />

    {showAdd && <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.68)' }} />
      <div className="module-sheet" style={{ position: 'relative', background: 'var(--surface-raised)', borderRadius: '20px 20px 0 0', padding: '22px 20px 34px', display: 'grid', gap: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ fontFamily: SF, fontSize: 19, color: 'var(--t1)' }}>New cost code</h2><button type="button" onClick={() => setShowAdd(false)} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><IcX size={19} color="var(--t2)" /></button></div>
        <input autoFocus value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Code, e.g. MAT" style={inputStyle} />
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Name, e.g. Materials" style={inputStyle} />
        <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Category (optional)" style={inputStyle} />
        <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" style={{ ...inputStyle, resize: 'vertical' }} />
        <button type="button" onClick={create} disabled={saving || !form.code.trim() || !form.name.trim()} style={{ minHeight: 44, border: 0, borderRadius: 11, background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: SF, fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: saving || !form.code.trim() || !form.name.trim() ? 0.5 : 1 }}><IcCheck size={14} color="#fff" /> {saving ? 'Saving…' : 'Create code'}</button>
      </div>
    </div>}
  </div>
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: 'var(--t1)', padding: '10px 11px', fontFamily: SF, fontSize: 12, outline: 'none' }
