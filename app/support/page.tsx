import type { Metadata } from 'next'
import Link from 'next/link'
import LegalShell from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Support — Cortexx',
  description: 'Help, FAQs and how to get in touch.',
}

export default function SupportPage() {
  return (
    <LegalShell title="Support">
      <p className="sub">Most things are quick. We aim to reply within one business day.</p>

      <div className="cards">
        <a className="card" href="mailto:support@cortexbuild.app">
          <div className="ico">📧</div>
          <div className="t">Email us</div>
          <div className="s">support@cortexbuild.app</div>
        </a>
        <Link className="card" href="/">
          <div className="ico">🚀</div>
          <div className="t">Open the app</div>
          <div className="s">cortexbuildpro.com</div>
        </Link>
      </div>

      <h2>Common questions</h2>

      <details>
        <summary>Where&apos;s my data stored?</summary>
        <p>On your device for the PWA build, or in our Postgres for the web app. Cortexx is local-first where possible — projects, photos, invoices and notes live on your phone or tablet when running the standalone PWA. The hosted web app at cortexbuildpro.com syncs to a UK-resident Postgres so multi-device access just works. Back up regularly via <strong>Settings → Database → Export</strong>.</p>
      </details>

      <details>
        <summary>How do I install Cortexx on my iPhone without the App Store?</summary>
        <p>Open <a href="https://cortexbuildpro.com">cortexbuildpro.com</a> in Safari on your iPhone. Tap the share button (the square with an up arrow), scroll down, tap <strong>Add to Home Screen</strong>. Cortexx installs as a real-feeling app — full-screen, offline, with its own icon.</p>
      </details>

      <details>
        <summary>Cortex AI gave me a wrong number. What now?</summary>
        <p>Always cross-check AI output against the real facts — quotes against your supplier prices, CIS deductions against HMRC&apos;s site, RAMS content against the site survey. Cortex AI is a fast first draft, not a qualified estimator or H&amp;S specialist.</p>
        <p>If you spot a consistent bug, email <a href="mailto:support@cortexbuild.app">support@cortexbuild.app</a> with what you asked and what Cortex said. We&apos;ll feed it back into our prompt tuning.</p>
      </details>

      <details>
        <summary>I lost my data after reinstalling the app.</summary>
        <p>If you didn&apos;t have multi-device sync turned on, we can&apos;t recover it — local-device data is exclusively under your control. Always run <strong>Settings → Database → Export</strong> before uninstalling, and re-import on the new install via <strong>Settings → Database → Import</strong>.</p>
      </details>

      <details>
        <summary>Does Cortexx work with Xero / QuickBooks / Sage?</summary>
        <p>The Pro tier exports CSV ledgers compatible with all three. A direct API connector is on the roadmap — email us if you want to be in the beta.</p>
      </details>

      <details>
        <summary>How do I cancel my Pro subscription?</summary>
        <p>In the app: <strong>Settings → Billing → Cancel subscription</strong>. You keep Pro features until the end of the current billing period.</p>
      </details>

      <details>
        <summary>Is Cortexx CIS-compliant?</summary>
        <p>Cortexx calculates CIS deductions correctly for the standard 20% and higher 30% rates, and lets you generate a CIS300 monthly return. It&apos;s not a replacement for an accountant — we strongly recommend a qualified accountant signs off your CIS return before filing.</p>
      </details>

      <details>
        <summary>Is Cortexx GDPR compliant?</summary>
        <p>Yes. See our <a href="/privacy">Privacy Policy</a> for the detail: legal basis, retention periods, your rights, and how to exercise them.</p>
      </details>

      <details>
        <summary>How do I get help with a specific UK construction scenario (RAMS, CSCS, planning, etc.)?</summary>
        <p>Email <a href="mailto:support@cortexbuild.app">support@cortexbuild.app</a> with the scenario. We&apos;ll either answer or point you at the right HSE / HMRC / planning portal page. We don&apos;t give legal advice but we know the construction stack.</p>
      </details>

      <details>
        <summary>I want a feature.</summary>
        <p>Tell us. We read every request, and the small builders who shaped Cortexx in beta still drive the roadmap. <a href="mailto:hello@cortexbuild.app">hello@cortexbuild.app</a>.</p>
      </details>

      <h2>Status</h2>
      <p>Live status of Cortex AI, sync, and any incidents: <a href="/status">/status</a> (auto-refreshes every 30s). The same data drives the workspace dashboard&rsquo;s connectivity indicator and the GitHub Actions Health Monitor that pages us on outages.</p>

      <h2>Security disclosures</h2>
      <p>If you&apos;ve found a security issue, please tell us privately first: <a href="mailto:security@cortexbuild.app">security@cortexbuild.app</a>. We have a responsible-disclosure policy and credit reporters in our changelog.</p>
    </LegalShell>
  )
}
