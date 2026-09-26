'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import Toast from '@/components/ui/Toast'
import { IcChevL, IcPlus, IcTrash } from '@/components/ui/Icons'

type Activity = { id: string; code?: string | null; title: string; plannedStart: string; plannedEnd: string; status: string }
type Member = { id: string; name: string; email?: string | null; role?: string }
type Equipment = { id: string; name: string; code?: string | null; category?: string | null; status: string }
type Material = { id: string; name: string; code?: string | null; unit: string; stockLevel: number; reorderPoint: number }
type Allocation = { id: string; activityId: string; resourceType: string; teamMemberId?: string | null; equipmentId?: string | null; materialId?: string | null; label?: string | null; quantity: number; unit: string; hoursPerDay: number; needBy?: string | null; notes?: string | null; activity: Activity; teamMember?: Member | null; equipment?: Equipment | null; material?: Material | null }
type Summary = { daily: Array<{ date: string; labourPeople: number; labourHours: number; equipmentUnits: number; materialNeeds: Array<{ label: string; quantity: number; unit: string }> }>; conflicts: Array<{ type: string; date: string; resourceName: string; activityIds: string[] }>; materialShortages: Array<{ label: string; unit: string; required: number; stockLevel: number; shortage: number }>; peakLabourPeople: number; peakLabourHours: number; peakEquipmentUnits: number; totalAllocations: number }
type Payload = { project: { id: string; name: string }; activities: Activity[]; allocations: Allocation[]; catalog: { team: Member[]; equipment: Equipment[]; materials: Material[] }; summary: Summary; permissions: { plan: boolean } }

const SF = 'var(--font-system)'
const blank = { activityId: '', resourceType: 'labour', resourceId: '', label: '', quantity: '1', hoursPerDay: '8', needBy: '', unit: 'unit', notes: '' }

export default function ProgrammeResourcesPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/projects/${id}/programme/resources`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Resource loading unavailable')
      setData(body); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Resource loading unavailable') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const activityName = useMemo(() => new Map((data?.activities || []).map(a => [a.id, `${a.code ? `${a.code} · ` : ''}${a.title}`])), [data])
  const upcoming = useMemo(() => {
    if (!data) return []
    const today = new Date().toISOString().slice(0, 10)
    const future = data.summary.daily.filter(row => row.date >= today)
    return (future.length ? future : data.summary.daily).slice(0, 42)
  }, [data])

  const resourceOptions = form.resourceType === 'labour' ? data?.catalog.team || [] : form.resourceType === 'equipment' ? data?.catalog.equipment || [] : data?.catalog.materials || []
  const selectType = (resourceType: string) => setForm({ ...blank, activityId: form.activityId, resourceType, hoursPerDay: resourceType === 'labour' ? '8' : '', unit: resourceType === 'material' ? 'unit' : resourceType === 'labour' ? 'people' : 'unit' })

  const add = async () => {
    if (!form.activityId) return setToast({ msg: 'Choose a programme activity', type: 'error' })
    setSaving(true)
    try {
      const resourceKey = form.resourceType === 'labour' ? 'teamMemberId' : form.resourceType === 'equipment' ? 'equipmentId' : 'materialId'
      const body: Record<string, unknown> = { activityId: form.activityId, resourceType: form.resourceType, quantity: Number(form.quantity), label: form.label, notes: form.notes, unit: form.unit }
      if (form.resourceId) body[resourceKey] = form.resourceId
      if (form.resourceType !== 'material') body.hoursPerDay = form.hoursPerDay === '' ? undefined : Number(form.hoursPerDay)
      if (form.resourceType === 'material' && form.needBy) body.needBy = form.needBy
      const res = await fetch(`/api/projects/${id}/programme/resources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out.error || 'Failed to add resource')
      setShowAdd(false); setForm(blank); setToast({ msg: 'Resource loaded onto programme' }); await load()
    } catch (e) { setToast({ msg: e instanceof Error ? e.message : 'Failed to add resource', type: 'error' }) }
    finally { setSaving(false) }
  }

  const remove = async (allocation: Allocation) => {
    if (!window.confirm(`Remove ${allocation.label || allocation.resourceType} from ${allocation.activity.title}?`)) return
    const res = await fetch(`/api/projects/${id}/programme/resources/${allocation.id}`, { method: 'DELETE' })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) return setToast({ msg: out.error || 'Failed to remove allocation', type: 'error' })
    setToast({ msg: 'Resource allocation removed' }); await load()
  }

  if (loading) return <Shell><div style={center}>Loading resource plan…</div></Shell>
  if (error || !data) return <Shell><div style={center}><p style={{ color: '#ef4444' }}>{error || 'Unavailable'}</p><Link href={`/projects/${id}/programme`} style={{ color: '#f59e0b' }}>Back to programme</Link></div></Shell>

  return <Shell>
    {toast && <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    <header style={header}>
      <Link href={`/projects/${id}/programme`} aria-label="Back to programme" style={back}><IcChevL size={18} color="var(--t2)" /></Link>
      <div style={{ flex: 1, minWidth: 0 }}><div style={eyebrow}>PROGRAMME RESOURCES</div><h1 style={title}>{data.project.name}</h1></div>
      {data.permissions.plan && <button onClick={() => { setForm({ ...blank, activityId: data.activities[0]?.id || '' }); setShowAdd(true) }} style={primary}><IcPlus size={14} color="#fff" /> Load</button>}
    </header>
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 16px 96px' }}>
      <section style={grid}>
        <Kpi label="Peak crew" value={`${data.summary.peakLabourPeople}`} sub="people / day" color="#2563eb" />
        <Kpi label="Peak labour" value={`${data.summary.peakLabourHours}h`} sub="hours / day" color="#8b5cf6" />
        <Kpi label="Peak plant" value={`${data.summary.peakEquipmentUnits}`} sub="units / day" color="#f59e0b" />
        <Kpi label="Conflicts" value={`${data.summary.conflicts.length}`} sub="double bookings" color={data.summary.conflicts.length ? '#ef4444' : '#10b981'} />
        <Kpi label="Material gaps" value={`${data.summary.materialShortages.length}`} sub="stock shortages" color={data.summary.materialShortages.length ? '#ef4444' : '#10b981'} />
      </section>

      {(data.summary.conflicts.length > 0 || data.summary.materialShortages.length > 0) && <section style={{ ...panel, borderColor: 'rgba(239,68,68,.28)' }}>
        <div style={{ ...eyebrow, color: '#f87171' }}>RESOURCE EXCEPTIONS</div>
        {data.summary.conflicts.slice(0, 20).map((c, i) => <div key={`${c.type}-${c.date}-${i}`} style={warning}>{c.resourceName} · {c.date} · {c.type === 'labour_overlap' ? 'person double-booked' : 'plant double-booked'} across {c.activityIds.length} activities</div>)}
        {data.summary.materialShortages.map((m, i) => <div key={`${m.label}-${i}`} style={warning}>{m.label}: need {m.required} {m.unit}, stock {m.stockLevel} · gap {m.shortage} {m.unit}</div>)}
      </section>}

      <section style={panel}>
        <div style={sectionHead}><div><div style={eyebrow}>DAILY LOAD</div><div style={sectionTitle}>Next planned resource demand</div></div><span style={muted}>{upcoming.length} days shown</span></div>
        {upcoming.length === 0 ? <Empty text="No loaded programme resources yet." /> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}><thead><tr>{['Date','Crew','Labour hours','Plant','Materials due'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{upcoming.map(row => <tr key={row.date}><td style={td}>{new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</td><td style={tdNum}>{row.labourPeople}</td><td style={tdNum}>{row.labourHours}h</td><td style={tdNum}>{row.equipmentUnits}</td><td style={td}>{row.materialNeeds.length ? row.materialNeeds.map(x => `${x.label} ${x.quantity}${x.unit}`).join(', ') : '—'}</td></tr>)}</tbody></table></div>}
      </section>

      <section style={panel}>
        <div style={sectionHead}><div><div style={eyebrow}>ALLOCATIONS</div><div style={sectionTitle}>{data.allocations.length} resource lines</div></div></div>
        {data.allocations.length === 0 ? <Empty text="Load labour, plant or material onto a programme activity." /> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{data.allocations.map(a => <div key={a.id} style={allocationRow}><div style={{ minWidth: 0, flex: 1 }}><div style={{ display:'flex',gap:6,alignItems:'center',flexWrap:'wrap' }}><b style={{ color:'var(--t1)',fontSize:12 }}>{a.label || a.resourceType}</b><span style={pill}>{a.resourceType}</span></div><div style={{ color:'var(--t3)',fontSize:10,marginTop:3 }}>{activityName.get(a.activityId) || a.activity.title}</div><div style={{ color:'var(--t2)',fontSize:11,marginTop:4 }}>{a.quantity} {a.unit}{a.resourceType === 'labour' ? ` · ${a.hoursPerDay}h/day` : ''}{a.needBy ? ` · need ${new Date(a.needBy).toLocaleDateString('en-GB')}` : ''}</div></div>{data.permissions.plan && <button onClick={() => remove(a)} aria-label={`Remove ${a.label || a.resourceType}`} style={iconBtn}><IcTrash size={14} color="#ef4444" /></button>}</div>)}</div>}
      </section>
    </main>

    {showAdd && <div style={overlay} onMouseDown={e => { if (e.target === e.currentTarget) setShowAdd(false) }}><div style={modal}><div style={sectionHead}><div><div style={eyebrow}>RESOURCE LOAD</div><div style={sectionTitle}>Add programme resource</div></div><button onClick={() => setShowAdd(false)} style={close}>×</button></div>
      <label style={label}>Activity<select value={form.activityId} onChange={e => setForm(f => ({...f,activityId:e.target.value}))} style={input}>{data.activities.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.title}</option>)}</select></label>
      <label style={label}>Type<select value={form.resourceType} onChange={e => selectType(e.target.value)} style={input}><option value="labour">Labour</option><option value="equipment">Plant / equipment</option><option value="material">Material</option></select></label>
      <label style={label}>Named resource (optional)<select value={form.resourceId} onChange={e => setForm(f => ({...f,resourceId:e.target.value,label:''}))} style={input}><option value="">Generic demand</option>{resourceOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      {!form.resourceId && <label style={label}>Generic label<input value={form.label} onChange={e => setForm(f => ({...f,label:e.target.value}))} placeholder={form.resourceType === 'labour' ? 'Cladding crew' : form.resourceType === 'equipment' ? 'Scissor lift' : 'Fixings'} style={input} /></label>}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}><label style={label}>Quantity<input type="number" min="0.01" step="0.25" value={form.resourceId && form.resourceType !== 'material' ? '1' : form.quantity} disabled={!!form.resourceId && form.resourceType !== 'material'} onChange={e => setForm(f => ({...f,quantity:e.target.value}))} style={input} /></label>{form.resourceType !== 'material' ? <label style={label}>Hours / day<input type="number" min="0" max="24" step="0.5" value={form.hoursPerDay} onChange={e => setForm(f => ({...f,hoursPerDay:e.target.value}))} style={input} /></label> : <label style={label}>Need by<input type="date" value={form.needBy} onChange={e => setForm(f => ({...f,needBy:e.target.value}))} style={input} /></label>}</div>
      {form.resourceType === 'material' && !form.resourceId && <label style={label}>Unit<input value={form.unit} onChange={e => setForm(f => ({...f,unit:e.target.value}))} style={input} /></label>}
      <label style={label}>Notes<textarea value={form.notes} onChange={e => setForm(f => ({...f,notes:e.target.value}))} rows={3} style={{...input,resize:'vertical'}} /></label>
      <button onClick={add} disabled={saving || !data.activities.length} style={{...primary,width:'100%',justifyContent:'center',marginTop:8}}>{saving ? 'Saving…' : 'Add resource load'}</button>
    </div></div>}
    <TabBar />
  </Shell>
}

function Shell({children}:{children:React.ReactNode}) { return <div style={{minHeight:'100dvh',background:'var(--bg0)',color:'var(--t1)'}}>{children}</div> }
function Kpi({label,value,sub,color}:{label:string;value:string;sub:string;color:string}) { return <div style={kpi}><div style={eyebrow}>{label}</div><div style={{fontSize:22,fontWeight:800,color,fontFamily:'ui-monospace,monospace',marginTop:4}}>{value}</div><div style={{...muted,marginTop:2}}>{sub}</div></div> }
function Empty({text}:{text:string}) { return <div style={{padding:'28px 10px',textAlign:'center',color:'var(--t3)',fontSize:12}}>{text}</div> }
const header:React.CSSProperties={display:'flex',alignItems:'center',gap:10,padding:'16px 18px',position:'sticky',top:0,zIndex:40,background:'rgba(6,16,30,.94)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,.06)'}
const back:React.CSSProperties={width:36,height:36,borderRadius:9,background:'var(--surface-raised)',display:'flex',alignItems:'center',justifyContent:'center'}
const title:React.CSSProperties={margin:0,color:'var(--t1)',fontSize:19,fontFamily:SF,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}
const eyebrow:React.CSSProperties={fontFamily:SF,fontSize:9,fontWeight:800,letterSpacing:.8,color:'var(--t3)',textTransform:'uppercase'}
const primary:React.CSSProperties={display:'flex',alignItems:'center',gap:5,border:0,borderRadius:9,padding:'9px 12px',background:'#2563eb',color:'#fff',fontFamily:SF,fontSize:11,fontWeight:750,cursor:'pointer'}
const grid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}
const kpi:React.CSSProperties={padding:13,borderRadius:12,background:'var(--surface-raised)',border:'1px solid rgba(255,255,255,.06)'}
const panel:React.CSSProperties={marginTop:12,padding:14,borderRadius:13,background:'var(--surface-raised)',border:'1px solid rgba(255,255,255,.07)'}
const sectionHead:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}
const sectionTitle:React.CSSProperties={fontFamily:SF,fontSize:14,fontWeight:750,color:'var(--t1)',marginTop:2}
const muted:React.CSSProperties={fontFamily:SF,fontSize:10,color:'var(--t3)'}
const warning:React.CSSProperties={marginTop:8,padding:'8px 10px',borderRadius:8,background:'rgba(239,68,68,.07)',color:'#fca5a5',fontFamily:SF,fontSize:11}
const th:React.CSSProperties={textAlign:'left',padding:'9px 8px',borderBottom:'1px solid rgba(255,255,255,.08)',color:'var(--t3)',fontFamily:SF,fontSize:9,textTransform:'uppercase',letterSpacing:.5}
const td:React.CSSProperties={padding:'9px 8px',borderBottom:'1px solid rgba(255,255,255,.04)',color:'var(--t2)',fontFamily:SF,fontSize:11}
const tdNum:React.CSSProperties={...td,fontFamily:'ui-monospace,monospace',color:'var(--t1)'}
const allocationRow:React.CSSProperties={display:'flex',alignItems:'center',gap:8,padding:10,borderRadius:10,background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.05)'}
const pill:React.CSSProperties={padding:'3px 6px',borderRadius:99,background:'rgba(37,99,235,.11)',color:'#60a5fa',fontSize:9,fontWeight:750,textTransform:'uppercase'}
const iconBtn:React.CSSProperties={width:32,height:32,borderRadius:8,border:'1px solid rgba(239,68,68,.2)',background:'rgba(239,68,68,.06)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}
const overlay:React.CSSProperties={position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,.62)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}
const modal:React.CSSProperties={width:'min(520px,100%)',maxHeight:'88dvh',overflowY:'auto',borderRadius:16,padding:16,background:'#0b1728',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 24px 80px rgba(0,0,0,.45)'}
const close:React.CSSProperties={width:30,height:30,borderRadius:8,border:0,background:'rgba(255,255,255,.06)',color:'var(--t2)',fontSize:20,cursor:'pointer'}
const label:React.CSSProperties={display:'flex',flexDirection:'column',gap:5,marginTop:10,fontFamily:SF,fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:.5}
const input:React.CSSProperties={width:'100%',boxSizing:'border-box',padding:'10px 11px',borderRadius:9,border:'1px solid rgba(255,255,255,.09)',background:'#071321',color:'var(--t1)',fontFamily:SF,fontSize:12}
const center:React.CSSProperties={minHeight:'80dvh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',fontFamily:SF,color:'var(--t3)'}
