import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Privacy Policy — Cortexx',
  description: 'How Cortexx handles your data. Local-first, UK-resident, no tracking.',
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="Last updated 22 May 2026 · Version 1.0">
      <div className="box tldr">
        <p><strong>TL;DR.</strong> Cortexx is <strong>local-first</strong> — your project data, photos, invoices and notes live on your device. We don&apos;t track you across apps. We don&apos;t sell your data. We never will.</p>
      </div>

      <h2>1 · Who we are</h2>
      <p>Cortexx is a product of <strong>CortexBuild Ltd</strong>, a company registered in England and Wales (registered office address available on request). For any privacy question, write to <a href="mailto:privacy@cortexbuild.app">privacy@cortexbuild.app</a>.</p>
      <p>For the purposes of the UK GDPR and Data Protection Act 2018, CortexBuild Ltd is the <strong>data controller</strong> for any personal data you supply through the Cortexx app or website.</p>

      <h2>2 · What we collect</h2>
      <h3>On your device (we never see this)</h3>
      <p>The bulk of what Cortexx handles never leaves your phone or tablet. This includes:</p>
      <ul>
        <li>Project details, customer names, addresses</li>
        <li>Invoices, quotes, receipts, CIS deductions</li>
        <li>Site photos, snag evidence, RAMS, drawings</li>
        <li>Voice memos, site diary entries, mileage logs</li>
        <li>Team member records, CSCS card details, training certificates</li>
        <li>Geolocation for site check-in and mileage tracking</li>
      </ul>
      <p>This data is stored in your device&apos;s local storage and IndexedDB. We have no way to access it, and we cannot recover it if you delete the app — back up regularly via <strong>Settings → Database → Export</strong>.</p>

      <h3>What we do see</h3>
      <table>
        <thead><tr><th>Data</th><th>Why we collect it</th><th>How long we keep it</th></tr></thead>
        <tbody>
          <tr><td>Account email (if you create one)</td><td>To restore your data across devices and contact you about account-critical events.</td><td>Until you delete the account.</td></tr>
          <tr><td>App diagnostic data (crash logs)</td><td>To fix bugs.</td><td>30 days, then auto-deleted.</td></tr>
          <tr><td>Anonymous usage metrics (PWA installs, feature opens)</td><td>To know which features are useful. <strong>Opt-out in Settings → Privacy.</strong></td><td>13 months, then aggregated.</td></tr>
          <tr><td>AI prompts sent to Cortex AI</td><td>To answer your question. Sent via our backend to Anthropic&apos;s Claude API.</td><td>Not stored on our servers — passed through. Anthropic&apos;s retention applies to the request only.</td></tr>
        </tbody>
      </table>

      <h2>3 · Cortex AI and third-party processors</h2>
      <p>When you ask Cortex AI a question, draft a chase email, run an AI estimator, scan a receipt with vision OCR, or use any other AI feature, the text or image of that request is sent via our backend to <strong>Anthropic, PBC</strong> (the makers of Claude). Anthropic processes the request and returns an answer. Anthropic do not train on data sent through our API contract (see Anthropic&apos;s data privacy commitments at anthropic.com/legal/api).</p>
      <p>We use <strong>Vercel</strong> (or our own UK-hosted infrastructure on Hostinger VPS) to serve the app. Neither receives a copy of your business data — only the static app code and your IP address at the time of request.</p>
      <p>For payments (Pro / Enterprise tiers), we use <strong>Stripe</strong>. Stripe receives your name, email, billing address and card details directly. We never see card numbers.</p>

      <h2>4 · Permissions we ask for, and why</h2>
      <ul>
        <li><strong>Camera</strong> — to scan receipts, photograph site progress, capture snag evidence, attach photos to incident reports.</li>
        <li><strong>Photo library</strong> — to pick existing photos to attach, and to save exports back.</li>
        <li><strong>Microphone</strong> — for voice memos.</li>
        <li><strong>Location</strong> — for site check-in verification and HMRC-compliant mileage tracking.</li>
        <li><strong>Contacts</strong> (iOS only, if you opt in) — to attach a customer&apos;s saved contact details.</li>
        <li><strong>Calendar</strong> (iOS only, if you opt in) — to add scheduled site visits and inspections to your calendar.</li>
        <li><strong>Face ID / Touch ID</strong> — to unlock the app so financial and CIS data stays private.</li>
        <li><strong>Push & local notifications</strong> — for reminders, expiry alerts, AI nudges.</li>
      </ul>
      <p>Every permission is requested in-context, not at launch, and the app keeps working if you say no.</p>

      <h2>5 · Your rights under UK GDPR</h2>
      <ul>
        <li><strong>Right of access</strong> — ask us what we hold on you. Email <a href="mailto:privacy@cortexbuild.app">privacy@cortexbuild.app</a>.</li>
        <li><strong>Right to rectification</strong> — ask us to correct anything.</li>
        <li><strong>Right to erasure</strong> (&quot;right to be forgotten&quot;) — ask us to delete your account and any associated server-side data. Local-device data is yours to delete via the app.</li>
        <li><strong>Right to data portability</strong> — export your data from <strong>Settings → Database → Export</strong>. The download is a JSON file you can import into any other tool.</li>
        <li><strong>Right to object</strong> — opt out of anonymous usage analytics in <strong>Settings → Privacy</strong>.</li>
        <li><strong>Right to lodge a complaint</strong> — with the UK&apos;s Information Commissioner&apos;s Office, <a href="https://ico.org.uk">ico.org.uk</a>, 0303 123 1113.</li>
      </ul>

      <h2>6 · Children</h2>
      <p>Cortexx is not directed at children under 16 and we do not knowingly collect data from them. If you believe a child has supplied us with personal data, contact us and we will delete it.</p>

      <h2>7 · Security</h2>
      <p>Data on your device is protected by iOS / Android&apos;s standard sandbox and (if you enable it) the OS biometric lock. Data in transit to our backend is protected by TLS 1.3. To responsibly disclose a security issue, write to <a href="mailto:security@cortexbuild.app">security@cortexbuild.app</a>.</p>

      <h2>8 · Changes to this policy</h2>
      <p>We&apos;ll let you know in-app the next time you open Cortexx after a material change. Minor wording fixes are made silently — check the version stamp at the top of this page.</p>

      <h2>9 · Contact</h2>
      <p>Privacy enquiries: <a href="mailto:privacy@cortexbuild.app">privacy@cortexbuild.app</a><br/>
      Data Protection Lead: Adrian Stanca<br/>
      Postal address available on request.</p>
    </LegalShell>
  )
}
