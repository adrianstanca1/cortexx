import Link from 'next/link'
import type { Metadata } from 'next'
import { isBillingConfigured, PLANS as CANONICAL_PLANS } from '@/lib/billing'

export const metadata: Metadata = {
  title: 'Pricing — Cortexx',
  description: 'Construction-management software for UK contractors. Trial free for 14 days. From £29/month.',
}

// Marketing copy here, canonical pricing from lib/billing.ts. Previously
// the £29 / £79 strings were hard-coded in three places (here,
// /settings/organization, and lib/billing.ts) — when pricing changed,
// only one drifted into sync. Now changes in lib/billing.ts flow here.
const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: `£${CANONICAL_PLANS.starter.priceMonthlyGbp}`,
    cadence: '/month',
    description: 'For solo contractors and small crews.',
    features: [
      'Up to 5 team members',
      'Up to 10 active projects',
      '5 GB document storage',
      'Push + email notifications',
      'CSV exports',
      'PDF quotes, invoices, POs',
    ],
    cta: 'Start free trial',
    href: '/register?plan=starter',
    accent: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: `£${CANONICAL_PLANS.pro.priceMonthlyGbp}`,
    cadence: '/month',
    description: 'For growing builders running multiple sites.',
    features: [
      'Up to 20 team members',
      'Up to 50 active projects',
      '50 GB document storage',
      'AI snag photo analysis',
      'AI quote drafting + estimator',
      'Whisper voice transcription',
      'Vision drawing-revision diff',
      'Priority email support',
    ],
    cta: 'Start free trial',
    href: '/register?plan=pro',
    accent: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    description: 'For larger contractors and main contractors.',
    features: [
      'Unlimited team members',
      'Unlimited projects',
      '500 GB document storage',
      'SAML SSO',
      'Audit log retention',
      'Dedicated onboarding',
      '99.9% uptime SLA',
      'Custom integrations',
    ],
    cta: 'Contact sales',
    href: 'mailto:sales@cortexbuildpro.com?subject=Enterprise%20plan',
    accent: false,
  },
]

const FAQ = [
  {
    q: 'How does the trial work?',
    a: 'Every workspace gets a 14-day free trial on the Pro plan — no card required. After 14 days you pick a plan (or your workspace switches to read-only until you do).',
  },
  {
    q: 'Can I change plan later?',
    a: 'Yes — upgrade or downgrade anytime from Settings → Plan & billing. You pay the prorated difference; we don\'t charge cancellation fees.',
  },
  {
    q: 'Where is my data stored?',
    a: 'UK + EU. Our VPS is in Frankfurt; backups stay in EU object storage. We never sell or share customer data.',
  },
  {
    q: 'Does it work offline?',
    a: 'The PWA caches the last-viewed pages for offline reading. Capturing on-site work (photos, time, RFIs) requires connectivity for now — full offline-write is on the v2 roadmap.',
  },
  {
    q: 'Can clients see my project data?',
    a: 'Only via the per-project shareable link you generate manually. It shows progress, photos, and activity — never margin or rates. Revocable any time.',
  },
  {
    q: 'What about the AI features?',
    a: 'AI runs locally on our server (Ollama for text, Moondream for vision, whisper.cpp for audio). Your project data never leaves our infrastructure — no third-party AI vendors involved.',
  },
]

export default function PricingPage() {
  // When STRIPE_SECRET_KEY isn't set in production yet (early-access phase),
  // self-serve checkout is disabled — point users at sales for manual
  // onboarding. Trials still work; only the subscribe-with-card flow
  // is gated.
  const selfServeBilling = isBillingConfigured()

  return (
    <main style={{ background: '#06101e', minHeight: '100dvh', padding: '60px 24px 80px', color: '#eef3fa' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {!selfServeBilling && (
          <div style={{
            maxWidth: 720,
            margin: '0 auto 32px',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
            border: '0.5px solid rgba(245,158,11,0.3)',
            borderRadius: 12,
            fontFamily: 'var(--font-system)',
            fontSize: 13,
            color: '#eef3fa',
            textAlign: 'center',
          }}>
            <strong style={{ color: '#f59e0b' }}>Early access:</strong> self-serve checkout is being polished —
            during this window please <Link href="mailto:sales@cortexbuildpro.com?subject=Cortexx%20subscription" style={{ color: '#f59e0b', textDecoration: 'underline' }}>email sales</Link> to subscribe.
            The 14-day Pro trial is unaffected — sign up and start using the app today.
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Pricing</div>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 12px', fontFamily: 'var(--font-system)' }}>
            Run your build, not your spreadsheets.
          </h1>
          <p style={{ fontSize: 17, color: '#8ea8c5', maxWidth: 580, margin: '0 auto', lineHeight: 1.5, fontFamily: 'var(--font-system)' }}>
            Construction-management software for UK contractors. RFIs, snags, RAMS, timesheets, invoices, drawings — and AI that actually helps.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 64 }}>
          {PLANS.map(plan => (
            <div
              key={plan.key}
              style={{
                background: plan.accent ? 'linear-gradient(180deg, #2a1d3c 0%, #152641 100%)' : '#152641',
                borderRadius: 18,
                padding: 28,
                border: plan.accent ? '1px solid rgba(245,158,11,0.35)' : '0.5px solid rgba(255,255,255,0.07)',
                position: 'relative',
              }}
            >
              {plan.accent && (
                <div style={{ position: 'absolute', top: -10, right: 20, background: '#f59e0b', color: '#06101e', fontFamily: 'var(--font-system)', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Recommended
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 700, color: '#eef3fa', marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', marginBottom: 16, lineHeight: 1.4 }}>{plan.description}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontFamily: 'var(--font-system)', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em' }}>{plan.price}</span>
                {plan.cadence && <span style={{ fontFamily: 'var(--font-system)', fontSize: 14, color: '#8ea8c5' }}>{plan.cadence}</span>}
              </div>
              <Link
                href={plan.href}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '12px 0',
                  borderRadius: 12,
                  background: plan.accent ? '#f59e0b' : 'transparent',
                  border: plan.accent ? 'none' : '1px solid rgba(255,255,255,0.13)',
                  color: plan.accent ? '#06101e' : '#eef3fa',
                  fontFamily: 'var(--font-system)',
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                  marginBottom: 20,
                }}
              >
                {plan.cta}
              </Link>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', lineHeight: 1.7 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#10b981', flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-system)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 24px' }}>
            Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ.map(item => (
              <details key={item.q} style={{ background: '#152641', borderRadius: 12, padding: '16px 20px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-system)', fontSize: 14, fontWeight: 600, color: '#eef3fa', listStyle: 'none' }}>
                  {item.q}
                </summary>
                <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', lineHeight: 1.6 }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 48, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/login" style={{ fontFamily: 'var(--font-system)', fontSize: 13, color: '#8ea8c5', textDecoration: 'none' }}>
            Already have an account? <span style={{ color: '#f59e0b', fontWeight: 600 }}>Sign in</span>
          </Link>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontFamily: 'var(--font-system)', fontSize: 12, color: '#52749a' }}>
            <a href="/marketing" style={{ color: 'inherit', textDecoration: 'none' }}>About Cortexx</a>
            <span>·</span>
            <a href="/legacy/" style={{ color: 'inherit', textDecoration: 'none' }}>Live demo</a>
            <span>·</span>
            <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
            <span>·</span>
            <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</a>
          </div>
        </div>
      </div>
    </main>
  )
}
