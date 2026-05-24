'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TabBar from '@/components/ui/TabBar'
import { IcPin, IcChevL, IcTeam, IcCheck, IcAlert } from '@/components/ui/Icons'

interface Member { id: string; name: string; role: string; avatarColor: string; onSite: boolean }
interface ProjectLite { id: string; name: string; address: string; postcode: string; lat: number; lng: number; onSiteCount: number; status: string; progress: number }
interface CheckIn {
  id: string
  memberId: string
  projectId: string
  checkedInAt: string
  member?: Member
  project?: ProjectLite
}
interface Group { project: ProjectLite; checkins: CheckIn[] }
interface Totals { onSite: number; offSite: number; activeProjects: number; sitesOccupied: number }

const SF = 'var(--font-system)'

function durHrs(from: string) {
  return (Date.now() - new Date(from).getTime()) / 3_600_000
}

export default function LiveStatusPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [offSite, setOffSite] = useState<Member[]>([])
  const [totals, setTotals] = useState<Totals>({ onSite: 0, offSite: 0, activeProjects: 0, sitesOccupied: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/live-status')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setGroups(d.byProject || []); setOffSite(d.offSite || []); setTotals(d.totals || { onSite: 0, offSite: 0, activeProjects: 0, sitesOccupied: 0 }); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 30_000)
    return () => clearInterval(t)
  }, [load])

  const sitesEmpty = groups.filter(g => g.checkins.length === 0)
  const sitesOccupied = groups.filter(g => g.checkins.length > 0)

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 12px 60px', position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,16,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <Link href="/apps" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 10 }}>
          <IcChevL size={18} color="#52749a" />
          <span style={{ fontFamily: SF, fontSize: 13, color: '#52749a' }}>Apps</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eef3fa', letterSpacing: -0.4, fontFamily: SF }}>Live status</h1>
            <p style={{ fontSize: 12, color: '#52749a', marginTop: 2, fontFamily: SF }}>Auto-refreshes every 30s</p>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.7)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          <Kpi label="On site" value={totals.onSite} color="#10b981" />
          <Kpi label="Sites busy" value={totals.sitesOccupied} color="#06b6d4" />
          <Kpi label="Sites empty" value={Math.max(0, totals.activeProjects - totals.sitesOccupied)} color="#f59e0b" />
          <Kpi label="Off site" value={totals.offSite} color="#52749a" />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52749a', fontFamily: SF, fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontFamily: SF, fontSize: 14 }}>{error}</div>
      ) : (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sitesOccupied.length > 0 && (
            <Section title={`Occupied sites · ${sitesOccupied.length}`} color="#10b981">
              {sitesOccupied.map(g => (
                <div key={g.project.id} style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <IcPin size={13} color="#10b981" />
                    <Link href={`/projects/${g.project.id}`} style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: '#eef3fa', textDecoration: 'none' }}>{g.project.name}</Link>
                    <span style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#52749a' }}>{g.checkins.length} on site</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {g.checkins.map(ci => {
                      const hrs = durHrs(ci.checkedInAt)
                      return (
                        <div key={ci.id} title={`${ci.member?.name} · ${hrs.toFixed(1)}h on site`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 3px', background: (ci.member?.avatarColor || '#2563eb') + '15', borderRadius: 99, border: `0.5px solid ${(ci.member?.avatarColor || '#2563eb')}44` }}>
                          <div style={{ width: 22, height: 22, borderRadius: 11, background: (ci.member?.avatarColor || '#2563eb'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>
                            {ci.member?.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontFamily: SF, fontSize: 11, color: '#eef3fa', fontWeight: 500 }}>{ci.member?.name.split(' ')[0]}</span>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#52749a', marginLeft: 2 }}>{hrs.toFixed(1)}h</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {sitesEmpty.length > 0 && (
            <Section title={`Empty sites · ${sitesEmpty.length}`} color="#f59e0b">
              {sitesEmpty.map(g => (
                <Link key={g.project.id} href={`/projects/${g.project.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', textDecoration: 'none' }}>
                  <IcAlert size={13} color="#f59e0b" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, color: '#eef3fa' }}>{g.project.name}</div>
                    {g.project.address && <div style={{ fontFamily: SF, fontSize: 11, color: '#52749a' }}>{g.project.address}{g.project.postcode ? `, ${g.project.postcode}` : ''}</div>}
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {offSite.length > 0 && (
            <Section title={`Off site · ${offSite.length}`} color="#52749a">
              <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {offSite.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 3px', background: 'rgba(255,255,255,0.03)', borderRadius: 99, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 10, background: m.avatarColor || '#52749a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 9, fontWeight: 700 }}>
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontFamily: SF, fontSize: 11, color: '#8ea8c5' }}>{m.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {groups.length === 0 && offSite.length === 0 && (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: '#52749a', fontFamily: SF }}>
              <IcTeam size={32} color="#52749a" />
              <p style={{ marginTop: 12, fontSize: 14 }}>No active projects or team members yet</p>
            </div>
          )}
        </div>
      )}

      <TabBar />
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#152641', borderRadius: 10, padding: '8px 10px', border: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 20, color, fontWeight: 700 }}>{value}</div>
      <div style={{ fontFamily: SF, fontSize: 9, color: '#52749a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{label}</div>
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#152641', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontFamily: SF, fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
