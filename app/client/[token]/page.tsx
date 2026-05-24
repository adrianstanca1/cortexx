import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SF = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

interface Props { params: { token: string } }

const STATUS_COLOR: Record<string, string> = {
  planned: '#52749a',
  in_progress: '#06b6d4',
  complete: '#10b981',
  slipped: '#ef4444',
}
const INVOICE_COLOR: Record<string, string> = {
  draft: '#52749a',
  sent: '#06b6d4',
  paid: '#10b981',
  overdue: '#ef4444',
}

export default async function ClientPortalPage({ params }: Props) {
  const token = (params.token || '').trim()
  if (!token || token.length < 16 || token.length > 128) notFound()

  const project = await prisma.project.findFirst({
    where: { clientToken: token, clientViewEnabled: true, archivedAt: null },
    select: {
      id: true, name: true, address: true, postcode: true,
      clientName: true, status: true, progress: true,
      startDate: true, endDate: true, updatedAt: true,
    },
  })
  if (!project) notFound()

  const [photos, openSnags, milestones, invoices] = await Promise.all([
    prisma.document.findMany({
      where: { projectId: project.id, type: 'photo' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, name: true, url: true, createdAt: true },
    }),
    prisma.snag.count({ where: { projectId: project.id, status: { not: 'closed' } } }),
    prisma.milestone.findMany({
      where: { projectId: project.id, plannedEnd: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
      orderBy: { plannedStart: 'asc' },
      take: 12,
      select: { id: true, title: true, plannedStart: true, plannedEnd: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, number: true, amount: true, status: true, dueDate: true, createdAt: true },
    }),
  ])

  return (
    <div style={{ background: '#06101e', minHeight: '100dvh', fontFamily: SF, color: '#eef3fa' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
        <header style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)', paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#52749a', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>Project portal</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 4, letterSpacing: -0.4 }}>{project.name}</h1>
          <div style={{ color: '#8ea8c5', fontSize: 13, marginTop: 4 }}>
            {project.address}{project.postcode ? `, ${project.postcode}` : ''}
          </div>
          {project.clientName && (
            <div style={{ color: '#52749a', fontSize: 12, marginTop: 4 }}>For {project.clientName}</div>
          )}
        </header>

        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <Kpi label="Progress" value={`${project.progress}%`} />
            <Kpi label="Status" value={project.status.replace(/_/g, ' ')} />
            <Kpi label="Open snags" value={String(openSnags)} accent={openSnags > 0 ? '#ef4444' : '#10b981'} />
            <Kpi label="Last update" value={new Date(project.updatedAt).toLocaleDateString('en-GB')} />
          </div>
        </section>

        {milestones.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <SectionTitle>Upcoming milestones</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestones.map(m => (
                <div key={m.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: '#52749a', marginTop: 2 }}>
                      {new Date(m.plannedStart).toLocaleDateString('en-GB')} → {new Date(m.plannedEnd).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  <span style={{ background: STATUS_COLOR[m.status] + '33', color: STATUS_COLOR[m.status], padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                    {m.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <SectionTitle>Recent photos</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {photos.map(p => (
                <a key={p.id} href={p.url || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {p.url && <img src={p.url} alt={p.name || 'site photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </a>
              ))}
            </div>
          </section>
        )}

        {invoices.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <SectionTitle>Invoices</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {invoices.map(inv => {
                const isOverdue = inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date()
                const status = isOverdue ? 'overdue' : inv.status
                return (
                  <div key={inv.id} style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{inv.number}</div>
                      <div style={{ fontSize: 11, color: '#52749a', marginTop: 2 }}>
                        {inv.dueDate ? `Due ${new Date(inv.dueDate).toLocaleDateString('en-GB')}` : `Raised ${new Date(inv.createdAt).toLocaleDateString('en-GB')}`}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#eef3fa' }}>£{inv.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    <span style={{ background: INVOICE_COLOR[status] + '33', color: INVOICE_COLOR[status], padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                      {status}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <footer style={{ marginTop: 40, padding: '16px 0', borderTop: '0.5px solid rgba(255,255,255,0.07)', textAlign: 'center', fontSize: 11, color: '#52749a' }}>
          Powered by Cortexx · Updated {new Date(project.updatedAt).toLocaleString('en-GB')}
        </footer>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 10, color: '#52749a', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: accent || '#eef3fa' }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 12, color: '#8ea8c5', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>{children}</h2>
}
