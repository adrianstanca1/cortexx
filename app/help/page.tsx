import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Help — Cortexx',
  description: 'How to get started with Cortexx — workspace setup, team invites, AI tools, billing, and security.',
}

interface Article {
  slug: string
  title: string
  oneLiner: string
  body: string[]   // paragraphs / steps
}

const ARTICLES: Article[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    oneLiner: 'Sign up, create your workspace, invite your team — 5 minutes end to end.',
    body: [
      '1. Visit /register and create an account with your email + password.',
      '2. The /onboarding step picks your workspace name. Pro plan is free for the first 14 days, no card required.',
      '3. Add your first project. Projects are the parent of every task, snag, RFI, invoice, document — everything else.',
      '4. Invite teammates from Settings → Workspace → Invite. They get an email link that expires in 7 days.',
      '5. Each invite sets workspace access plus a construction persona. See "Team roles" below.',
    ],
  },
  {
    slug: 'team-roles',
    title: 'Team roles',
    oneLiner: 'Workspace access and construction persona are separate, so permissions stay correct across companies.',
    body: [
      'Workspace access: Owner controls billing/ownership; Admin manages company settings and members; Member can use operational tools; Viewer is read-only. Every workspace must retain at least one Owner.',
      'Construction persona is tenant-specific: Company Admin, Project Manager, Foreman, Operative or Client. A person can have a different persona in another company.',
      'Company Admin — creates projects and controls company-level commercial/settings workflows. Project Manager — manages assigned projects and approvals, including the full safety workflow, but cannot create projects.',
      'Foreman — site-lead workflow for tasks, team coordination and field records. Operative — assigned work, time, documents/photos, safety and quality capture. Client — restricted client-facing access.',
      'Change workspace access or construction persona any time from Settings → Workspace → Team members.',
    ],
  },
  {
    slug: 'ai-tools',
    title: 'AI tools',
    oneLiner: 'Snag photo analysis, quote drafting, voice RFI transcription, drawing-revision diff — all run locally on our server.',
    body: [
      'Photo snag analysis — upload a defect photo to a snag and Cortexx auto-detects what\'s wrong, sets the severity, and pre-fills the description. Uses local Moondream vision (1.8 GB).',
      'Quote drafting — describe a job in plain English and Cortexx generates UK-realistic line items, quantities, and rates.',
      'Voice RFI → text — record a voice note, Cortexx transcribes it via whisper.cpp and drafts the RFI.',
      'Drawing-revision compare — upload two drawing PDFs and Cortexx flags every structural / MEP / annotation difference.',
      'Where it runs — every AI feature uses our own server (Ollama + whisper.cpp). No third-party AI vendor sees your project data.',
    ],
  },
  {
    slug: 'billing',
    title: 'Plans & billing',
    oneLiner: 'Starter £29 · Pro £79 · Enterprise — cancel any time.',
    body: [
      'Plans — see /pricing for the feature matrix. Pro adds AI tools, 50 GB storage, 20 users; Enterprise adds SAML, audit-log retention, SLA.',
      'Free trial — every workspace starts on a 14-day Pro trial. No card required for the trial.',
      'Switching plan — Settings → Workspace → Plan & billing. Upgrades are prorated; downgrades take effect at the end of the current billing period.',
      'Invoicing — we use Stripe. You\'ll get a PDF receipt by email each month. Stripe Customer Portal handles card updates + cancellations.',
      'VAT — UK + EU customers see their local VAT on the invoice; non-EU is zero-rated.',
    ],
  },
  {
    slug: 'security',
    title: 'Security & data',
    oneLiner: 'UK + EU data residency, daily backups, optional 2FA, immutable audit log.',
    body: [
      'Data location — primary VPS in Frankfurt; backups in EU object storage. Your data never leaves the EU.',
      'Two-factor auth — Settings → Security → Enable 2FA. Scan the QR code with any authenticator app (Google, Authy, 1Password, Bitwarden). 10 backup codes generated at enrolment.',
      'Audit log — every workspace change (role grants, billing events, member removals, etc.) is recorded immutably. Owners + admins can view it at Settings → Workspace → Audit log.',
      'Backups — daily pg_dump cron, 30-day retention. Verified weekly by a restore-to-temp-DB job.',
      'Client share links — when you share a project externally, only the read-only "client view" of that project is exposed. Margin, internal costs, and other-project data are never visible. Tokens are revocable any time.',
    ],
  },
]

export default function HelpIndex() {
  return (
    <main style={{ background: '#06101e', minHeight: '100dvh', padding: '60px 24px 80px', color: '#eef3fa' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Help</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 12px', fontFamily: 'var(--font-system)' }}>
            Everything you need to know.
          </h1>
          <p style={{ fontSize: 15, color: '#8ea8c5', lineHeight: 1.5, fontFamily: 'var(--font-system)', margin: 0 }}>
            Five articles cover the 90% of questions. Email <a href="mailto:support@cortexbuildpro.com" style={{ color: '#f59e0b', fontWeight: 600 }}>support@cortexbuildpro.com</a> for anything else.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {ARTICLES.map(a => (
            <Link
              key={a.slug}
              href={`/help/${a.slug}`}
              style={{ display: 'block', background: '#152641', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 17, fontWeight: 700, color: '#eef3fa', marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', lineHeight: 1.5 }}>{a.oneLiner}</div>
            </Link>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontFamily: 'var(--font-system)', fontSize: 13, color: '#52749a' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </div>
    </main>
  )
}

export { ARTICLES }
