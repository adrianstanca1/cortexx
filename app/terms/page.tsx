import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Terms of Service — Cortexx',
  description: 'The terms you agree to when using Cortexx. Plain English.',
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="Last updated 22 May 2026 · Version 1.0">
      <div className="box">
        <p>By using Cortexx you agree to these terms. They&apos;re written in plain English; we&apos;ve kept the lawyer language to a minimum. If anything is unclear, write to <a href="mailto:hello@cortexbuild.app">hello@cortexbuild.app</a>.</p>
      </div>

      <h2>1 · Who you&apos;re contracting with</h2>
      <p>Cortexx is operated by <strong>CortexBuild Ltd</strong>, a company registered in England and Wales. References to &quot;we&quot;, &quot;us&quot; and &quot;our&quot; mean CortexBuild Ltd. &quot;Cortexx&quot; means the iOS app, Android app, web app at cortexbuildpro.com and any associated services.</p>

      <h2>2 · Your account</h2>
      <p>You can use the Free tier of Cortexx without creating an account — your data lives on your device. For paid tiers, multi-device sync or team features, you&apos;ll create an account with an email and password. You&apos;re responsible for keeping your password safe; we&apos;ll only ever ask for it through the official login flow.</p>
      <p>You must be 16 or over to use Cortexx, and you must use it lawfully. If you operate Cortexx on behalf of a company, you confirm that you have the authority to bind that company to these terms.</p>

      <h2>3 · Acceptable use</h2>
      <p>Don&apos;t use Cortexx to:</p>
      <ul>
        <li>break any law (UK or otherwise);</li>
        <li>store or transmit malware, illegal content, or content that infringes someone else&apos;s rights;</li>
        <li>attempt to break, probe, or reverse-engineer our systems or those of our third-party processors;</li>
        <li>resell Cortexx to other businesses without a written reseller agreement.</li>
      </ul>
      <p>We may suspend or terminate your account if we have reasonable grounds to believe you&apos;ve broken these rules.</p>

      <h2>4 · Your data</h2>
      <p>You own your data. We don&apos;t claim any rights over your projects, customers, photos, or business records. We process your data on your instructions in line with the <a href="/privacy">Privacy Policy</a> and the UK GDPR.</p>
      <p>If you cancel a paid plan, you keep your local-device data forever. Server-side data (multi-device sync, account email) is deleted within 30 days of cancellation unless you ask us to keep it.</p>

      <h2>5 · Cortex AI</h2>
      <p>Cortex AI generates suggestions, drafts, estimates and summaries. <strong>It is a tool, not a professional advisor.</strong> Always check AI-generated quotes, financial calculations, CIS deductions, RAMS content and safety advice against the real facts of the job, your professional judgement, and (where relevant) a qualified accountant, surveyor or H&amp;S specialist. We accept no liability for losses caused by relying on AI output without verification.</p>

      <h2>6 · Pricing & billing</h2>
      <p>Free tier is — and will remain — free for crews of up to 10 active users. Pro and Enterprise tiers are billed monthly or annually via Stripe. Prices are quoted exclusive of VAT, charged at the applicable UK rate. You can cancel at any time; you&apos;ll keep paid features until the end of the current billing period.</p>
      <p>We may change pricing for new sign-ups at any time. Existing paying customers get at least 60 days&apos; notice before any price increase affecting their plan.</p>

      <h2>7 · Availability</h2>
      <p>We aim for 99.5% monthly uptime of any cloud features, but we don&apos;t guarantee it. Cortexx is local-first, so the app keeps working even when our servers don&apos;t. We&apos;re not liable for losses caused by outages, downtime, or your local device&apos;s failures.</p>

      <h2>8 · Liability</h2>
      <p>Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded under English law. Subject to that:</p>
      <ul>
        <li>Cortexx is provided &quot;as is&quot; without warranties of fitness for any particular purpose.</li>
        <li>Our total aggregate liability to you for any claim is limited to the greater of (a) £100, or (b) the amount you paid us in the 12 months before the claim arose.</li>
        <li>We&apos;re not liable for indirect, consequential, or special losses including lost profit, lost contract, lost data, or wasted management time.</li>
      </ul>

      <h2>9 · Changes to these terms</h2>
      <p>We may update these terms. Material changes get an in-app banner and an email if we have one for you. Your continued use of Cortexx after a change confirms you accept the new terms.</p>

      <h2>10 · Termination</h2>
      <p>You can stop using Cortexx at any time — just uninstall the app. For paid accounts, cancel in <strong>Settings → Billing</strong>. We may terminate your access immediately if you break section 3 (acceptable use) or fail to pay a Pro/Enterprise invoice for 30 days.</p>

      <h2>11 · Governing law</h2>
      <p>These terms are governed by the laws of England and Wales. Any dispute that cannot be resolved by friendly conversation is subject to the exclusive jurisdiction of the courts of England and Wales.</p>

      <h2>12 · Getting in touch</h2>
      <p>Email <a href="mailto:hello@cortexbuild.app">hello@cortexbuild.app</a>. We aim to reply within one business day.</p>
    </LegalShell>
  )
}
