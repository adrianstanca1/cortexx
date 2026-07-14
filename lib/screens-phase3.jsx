// Cortexx — Phase 3: Login, Settings, Help, Purchase Orders, Client Portal

// ═══════════════════════════════════════════════════════════════════
// BACKEND EXTENSION — Purchase Orders
// ═══════════════════════════════════════════════════════════════════
(function() {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  const PO_SEED = [
    { id: 'PO-1042', supplier: 'Travis Perkins', projectId: 1, total: 3420, status: 'open',     created: '2026-05-20', delivery: '2026-05-23', items: 4 },
    { id: 'PO-1041', supplier: 'Selco',          projectId: 1, total: 1180, status: 'received', created: '2026-05-18', delivery: '2026-05-21', items: 3 },
    { id: 'PO-1040', supplier: 'Wickes',         projectId: 2, total: 890,  status: 'open',     created: '2026-05-19', delivery: '2026-05-24', items: 2 },
    { id: 'PO-1039', supplier: 'Toolstation',    projectId: 1, total: 245,  status: 'draft',    created: '2026-05-22', delivery: null,         items: 5 },
    { id: 'PO-1038', supplier: 'Jewson',         projectId: 3, total: 4200, status: 'received', created: '2026-05-12', delivery: '2026-05-15', items: 8 },
  ];
  if (!snap.purchaseOrders) {
    snap.purchaseOrders = PO_SEED;
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {}
  }
  const arr3 = (name) => { const s = Backend.db.snapshot(); if (!Array.isArray(s[name])) s[name] = []; return s[name]; };
  const makeT = (name) => ({
    listSync: () => [...arr3(name)],
    getSync: (id) => arr3(name).find(x => x.id == id),
    list: async () => [...arr3(name)],
    get: async (id) => arr3(name).find(x => x.id == id),
    create: async (data) => {
      const s = Backend.db.snapshot();
      const ids = arr3(name).map(x => typeof x.id === 'number' ? x.id : 0);
      const id = data.id ?? (Math.max(0, ...ids) + 1);
      const item = {...data, id};
      s[name] = [item, ...arr3(name)];
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
      return item;
    },
    update: async (id, patch) => {
      const s = Backend.db.snapshot();
      s[name] = arr3(name).map(x => x.id == id ? {...x, ...patch} : x);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
      return s[name].find(x => x.id == id);
    },
    remove: async (id) => {
      const s = Backend.db.snapshot();
      s[name] = arr3(name).filter(x => x.id != id);
      try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
      Backend.db.user.update({});
    },
  });
  Backend.db.purchaseOrders = makeT('purchaseOrders');
  Backend.computed.openPOs = () => (Backend.db.snapshot().purchaseOrders || []).filter(p => p.status !== 'received').length;
})();

// ═══════════════════════════════════════════════════════════════════
// LOGIN / SIGN-IN
// ═══════════════════════════════════════════════════════════════════
function LoginSheet({ onClose, accent }) {
  const [step, setStep] = React.useState('start');
  const [email, setEmail] = React.useState('');
  const [working, setWorking] = React.useState(false);

  const signIn = async () => {
    setWorking(true);
    await new Promise(r => setTimeout(r, 800));
    setWorking(false);
    toast('Signed in', 'success');
    onClose();
  };

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{ flex: 1, padding: '60px 28px', display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: `0 8px 20px ${accent}55`,
          }}>{React.cloneElement(Ic.spark, { size: 22 })}</div>
          <div style={{ fontFamily: SF, fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: -0.5 }}>CortexBuild Pro</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: -30 }}>
          {step === 'start' && (
            <>
              <div style={{ fontFamily: SF, fontSize: 30, fontWeight: 600, color: T.t1, letterSpacing: -0.8, lineHeight: 1.15 }}>
                The construction OS<br/>that thinks with you.
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, color: T.t2, marginTop: 14, lineHeight: 1.5 }}>
                Built for UK SMB contractors. Free forever for crews of 10 or fewer.
              </div>

              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setStep('email')} style={{
                  background: accent, color: '#fff', border: 'none', borderRadius: 14,
                  padding: '14px', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 6px 18px ${accent}55`,
                }}>Get started — it's free</button>
                <button onClick={() => setStep('signin')} style={{
                  background: 'transparent', color: T.t1, border: `0.5px solid ${T.hairMid}`,
                  borderRadius: 14, padding: '14px',
                  fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>I have an account</button>
              </div>
            </>
          )}

          {step === 'signin' && (
            <>
              <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 600, color: T.t1, letterSpacing: -0.5, lineHeight: 1.15 }}>Welcome back.</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 6 }}>Sign in to continue managing your sites.</div>

              <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoFocus placeholder="you@cortexbuild.app"
                style={{ marginTop: 24, background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '14px 16px', color: T.t1, fontFamily: SF, fontSize: 16, outline: 'none' }}/>
              <input type="password" placeholder="Password"
                style={{ marginTop: 8, background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '14px 16px', color: T.t1, fontFamily: SF, fontSize: 16, outline: 'none' }}/>

              <button onClick={signIn} disabled={working} style={{
                marginTop: 16, background: accent, color: '#fff', border: 'none', borderRadius: 14,
                padding: '14px', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: working ? 0.5 : 1,
              }}>{working ? 'Signing in…' : 'Sign in'}</button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontFamily: SF, fontSize: 12 }}>
                <button onClick={() => toast('Reset link sent', 'success')} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', padding: 0 }}>Forgot password?</button>
                <button onClick={() => setStep('start')} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', padding: 0 }}>Back</button>
              </div>
            </>
          )}

          {step === 'email' && (
            <>
              <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 600, color: T.t1, letterSpacing: -0.5, lineHeight: 1.15 }}>What's your email?</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 6 }}>We'll set you up. No credit card, no trial limit.</div>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoFocus placeholder="you@yourcompany.co.uk"
                style={{ marginTop: 24, background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '14px 16px', color: T.t1, fontFamily: SF, fontSize: 16, outline: 'none' }}/>
              <button onClick={signIn} disabled={!email.trim() || working} style={{
                marginTop: 16, background: email.trim() ? accent : T.bg3, color: '#fff', border: 'none', borderRadius: 14,
                padding: '14px', fontFamily: SF, fontSize: 15, fontWeight: 700,
                cursor: email.trim() && !working ? 'pointer' : 'default', opacity: working ? 0.5 : 1,
              }}>{working ? 'Setting up your workspace…' : 'Create my workspace'}</button>
              <button onClick={() => setStep('start')} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', padding: '12px 0', fontFamily: SF, fontSize: 12, marginTop: 8 }}>Back</button>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', fontFamily: SF, fontSize: 11, color: T.t3 }}>
          By continuing you accept our <span style={{ color: T.blueL }}>Terms</span> and <span style={{ color: T.blueL }}>Privacy</span>.
        </div>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS — proper full settings screen
// ═══════════════════════════════════════════════════════════════════
function SettingsScreen({ accent }) {
  const settings = useDB('settings');
  const user = useDB('user');
  const [section, setSection] = React.useState(null);

  const ROOT_SECTIONS = [
    { k: 'account',      l: 'Account',         d: user.email,             i: Ic.me,       c: T.blue },
    { k: 'workspace',    l: 'Workspace',       d: user.company,           i: Ic.briefcase, c: T.amber },
    { k: 'notifs',       l: 'Notifications',   d: 'Push & email',         i: Ic.bell,     c: T.purple },
    { k: 'billing',      l: 'Plan & billing',  d: user.plan,              i: Ic.money,    c: T.green },
    { k: 'integrations', l: 'Integrations',    d: '4 connected · QuickBooks, Xero…', i: Ic.swap, c: T.cyan },
    { k: 'tax',          l: 'Tax & VAT',       d: 'CIS · 20% VAT',        i: Ic.calc,     c: T.amber },
    { k: 'data',         l: 'Data & export',   d: 'Backup, GDPR, export', i: Ic.download, c: T.t2 },
    { k: 'about',        l: 'About CortexBuild Pro',   d: 'v2.0 · build 247',     i: Ic.spark,    c: T.purple },
  ];

  if (section === null) {
    return (
      <ScreenBg accent={accent}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
          <MobileHeader title="Settings" subtitle={user.email}/>
          <Section>
            <GroupedList>
              {ROOT_SECTIONS.map((s, i, a) => (
                <Row key={s.k} icon={s.i} iconBg={s.c}
                  title={s.l} sub={s.d}
                  isLast={i === a.length - 1}
                  onClick={() => setSection(s.k)}/>
              ))}
            </GroupedList>
          </Section>
        </div>
      </ScreenBg>
    );
  }

  const back = () => setSection(null);

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center' }}>
          <button onClick={back} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
            {Ic.chevL} <span>Settings</span>
          </button>
        </div>
        <MobileHeader title={ROOT_SECTIONS.find(s => s.k === section)?.l}/>

        {section === 'account' && <>
          <Section title="Profile">
            <GroupedList>
              <Row icon={Ic.me} iconBg={accent} title="Name" sub={user.name}
                onClick={() => window.cortexxNav('editfield', { label: 'Name', current: user.name, valuePath: ['user', 'name'] })}/>
              <Row icon={Ic.mail} iconBg={T.cyan} title="Email" sub={user.email}
                onClick={() => window.cortexxNav('editfield', { label: 'Email', current: user.email, valuePath: ['user', 'email'], type: 'email' })}/>
              <Row icon={Ic.shield} iconBg={T.green} title="Password" sub="Last changed 3 months ago"
                onClick={() => window.cortexxNav('editfield', { label: 'New password', current: '', type: 'password', help: 'Min 12 characters · mix of letters, numbers, symbols', onSave: async () => { await Backend.db.user.update({ passwordChangedAt: new Date().toISOString() }); } })}/>
              <Row icon={Ic.phone} iconBg={T.blue} title="Phone" sub="07900 123 456" isLast
                onClick={() => window.cortexxNav('editfield', { label: 'Phone', current: '07900 123 456', valuePath: ['user', 'phone'], type: 'tel' })}/>
            </GroupedList>
          </Section>
          <Section title="Verification">
            <GroupedList>
              <Row icon={Ic.hardhat} iconBg={T.amber} title="CSCS Gold" sub="Expires 2027-04" isLast right={<Pill c={T.green} size="xs">✓ Verified</Pill>}/>
            </GroupedList>
          </Section>
        </>}

        {section === 'workspace' && <>
          <Section title="Company">
            <GroupedList>
              <Row icon={Ic.briefcase} iconBg={T.amber} title="Company name" sub={user.company}
                onClick={() => window.cortexxNav('editfield', { label: 'Company name', current: user.company, valuePath: ['user', 'company'] })}/>
              <Row icon={Ic.pin} iconBg={T.blue} title="Address" sub="London, N1"
                onClick={() => window.cortexxNav('editfield', { label: 'Company address', current: 'London, N1', valuePath: ['user', 'companyAddress'], kind: 'textarea' })}/>
              <Row icon={Ic.calc} iconBg={T.cyan} title="Companies House #" sub="GB 12345678"
                onClick={() => window.cortexxNav('editfield', { label: 'Companies House #', current: 'GB 12345678', valuePath: ['user', 'cohoNumber'], help: '8-digit registration number from Companies House.' })}/>
              <Row icon={Ic.team} iconBg={T.purple} title="Team size" sub="7 members" isLast onClick={() => window.cortexxNav('tab', 'team')}/>
            </GroupedList>
          </Section>
        </>}

        {section === 'notifs' && (
          <>
          <Section title="Browser permission">
            <GroupedList>
              {window.NotificationToggleRow ? <NotificationToggleRow accent={accent}/> : null}
            </GroupedList>
          </Section>
          <Section title="Notifications">
            <GroupedList>
              {[
                { k: 'safety',   l: 'Safety alerts',   sub: 'RAMS, CSCS, incidents' },
                { k: 'money',    l: 'Money',           sub: 'Invoices, receipts, chase' },
                { k: 'mentions', l: '@mentions',       sub: 'When someone tags you' },
                { k: 'daily',    l: 'Daily briefing',  sub: '07:30 each morning' },
              ].map((n, i, a) => (
                <div key={n.k} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: 500 }}>{n.l}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{n.sub}</div>
                  </div>
                  <Toggle on={settings.notifications[n.k]} onChange={() => Backend.db.settings.update({
                    notifications: { ...settings.notifications, [n.k]: !settings.notifications[n.k] }
                  })} accent={accent}/>
                </div>
              ))}
            </GroupedList>
          </Section>
          </>
        )}

        {section === 'billing' && <>
          <Section>
            <div style={{
              background: `linear-gradient(135deg, ${accent}33, ${T.purple}11)`,
              border: `0.5px solid ${accent}55`, borderRadius: 16, padding: 16,
            }}>
              <Pill c={accent} solid>FREE FOREVER</Pill>
              <div style={{ fontFamily: SF, fontSize: 28, fontWeight: 700, color: T.t1, marginTop: 10, letterSpacing: -0.5 }}>£0<span style={{ fontSize: 14, color: T.t2, marginLeft: 4 }}>/mo</span></div>
              <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 4 }}>Crews up to 10 · Unlimited AI</div>
            </div>
          </Section>
          <Section title="What's included">
            <GroupedList>
              {['Unlimited projects', 'AI estimates & briefings', 'Photos, RAMS, CIS', 'Cloud sync across devices', 'Free support'].map((f, i, a) => (
                <Row key={i} icon={Ic.check} iconBg={T.green} title={f} isLast={i === a.length - 1}/>
              ))}
            </GroupedList>
          </Section>
          <Section title="Upgrade">
            <GroupedList>
              <Row icon={Ic.star} iconBg={T.amber} title="CortexBuild Pro · Pro plan" sub="£29/mo · 11–50 staff · advanced AI" onClick={async () => { await Backend.db.user.update({ plan: 'Pro · £29/mo' }); toast('Upgraded to Pro · 30-day free trial started', 'success'); }}/>
              <Row icon={Ic.layers} iconBg={T.purple} title="CortexBuild Pro · Enterprise" sub="Custom · 51+ staff · SSO + audit" isLast
                onClick={() => window.open('mailto:sales@cortexbuildpro.com?subject=CortexBuild%20Pro%20Enterprise%20enquiry', '_blank')}/>
            </GroupedList>
          </Section>
        </>}

        {section === 'integrations' && (
          <Section title="Connected">
            <GroupedList>
              {[
                { n: 'QuickBooks', d: 'Sync invoices & expenses', c: T.green, connected: true },
                { n: 'Xero',       d: 'Accounting sync',          c: T.blue,  connected: true },
                { n: 'Stripe',     d: 'Take card payments',       c: T.purple, connected: true },
                { n: 'Google Calendar', d: 'Site visits + schedule', c: T.amber, connected: true },
                { n: 'Slack',      d: 'Team notifications',       c: T.cyan,  connected: false },
                { n: 'Dropbox',    d: 'Document backup',          c: T.t2,    connected: false },
              ].map((it, i, a) => (
                <Row key={i} icon={Ic.swap} iconBg={it.c}
                  title={it.n} sub={it.d}
                  right={<Pill c={it.connected ? T.green : T.t3} size="xs">{it.connected ? '✓ ON' : 'OFF'}</Pill>}
                  isLast={i === a.length - 1}
                  onClick={() => toast(it.connected ? `Disconnect ${it.n}?` : `Connect ${it.n}…`, 'info')}/>
              ))}
            </GroupedList>
          </Section>
        )}

        {section === 'tax' && (
          <Section title="UK tax & CIS">
            <GroupedList>
              <Row icon={Ic.calc} iconBg={T.amber} title="VAT scheme" sub="Standard 20%"
                onClick={() => window.cortexxNav('editfield', { label: 'VAT scheme', current: 'Standard 20%', valuePath: ['user', 'vatScheme'], help: 'Standard 20%, Flat Rate, or Cash accounting.' })}/>
              <Row icon={Ic.shield} iconBg={T.purple} title="CIS verified" sub="HMRC UTR linked" right={<Pill c={T.green} size="xs">✓ Active</Pill>}
                onClick={() => window.cortexxNav('editfield', { label: 'HMRC UTR', current: '', valuePath: ['user', 'cisUtr'], help: '10-digit Unique Tax Reference from HMRC.' })}/>
              <Row icon={Ic.money} iconBg={T.green} title="Subcontractor verification" sub="3 deemed sub-contractors" isLast
                onClick={() => window.cortexxNav('tab', 'team')}/>
            </GroupedList>
          </Section>
        )}

        {section === 'data' && (
          <Section title="Your data">
            <GroupedList>
              <Row icon={Ic.download} iconBg={T.blue} title="Export everything" sub="CSV + JSON archive" onClick={() => toast('Export queued — emailed to you', 'success')}/>
              <Row icon={Ic.cloudOff} iconBg={T.cyan} title="Backup status" sub="Synced 2 min ago" onClick={() => toast('Backup synced', 'success')}/>
              <Row icon={Ic.archive} iconBg={T.amber} title="Reset demo data" sub="Restore seed projects" onClick={() => { Backend.db.reset(); toast('Demo data restored', 'success'); }}/>
              <Row icon={Ic.trash} iconBg={T.red} title="Delete workspace" sub="GDPR — permanent" danger isLast
                onClick={() => window.open('mailto:hello@cortexbuildpro.com?subject=GDPR%20deletion%20request&body=Please%20delete%20my%20CortexBuild%20Pro%20workspace%20and%20all%20personal%20data.', '_blank')}/>
            </GroupedList>
          </Section>
        )}

        {section === 'about' && <>
          <Section>
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 20, margin: '0 auto',
                background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                boxShadow: `0 10px 30px ${accent}55`,
              }}>{React.cloneElement(Ic.spark, { size: 40 })}</div>
              <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, marginTop: 14, letterSpacing: -0.4 }}>CortexBuild Pro</div>
              <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t3, marginTop: 2 }}>v2.0 · build 247</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 14, padding: '0 30px', lineHeight: 1.5 }}>
                The construction OS that thinks alongside you. Built for UK SMB contractors.
              </div>
            </div>
          </Section>
          <Section title="Links">
            <GroupedList>
              <Row icon={Ic.book} iconBg={T.blue} title="Help docs"
                onClick={() => window.open('/help', '_blank')}/>
              <Row icon={Ic.mail} iconBg={T.green} title="Contact support" sub="hello@cortexbuildpro.com"
                onClick={() => window.open('mailto:hello@cortexbuildpro.com', '_blank')}/>
              <Row icon={Ic.share} iconBg={T.purple} title="Share CortexBuild Pro" isLast
                onClick={async () => { try { await navigator.clipboard.writeText(location.href); toast('Link copied', 'success'); } catch(e) { toast('Copy failed', 'error'); } }}/>
            </GroupedList>
          </Section>
        </>}
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELP & SUPPORT
// ═══════════════════════════════════════════════════════════════════
const FAQ = [
  { q: 'How do AI estimates work?',
    a: 'Describe a job in natural language, and Cortex generates UK-realistic line items with quantities, units, and rates. You can edit before saving as a draft quote. Estimates use UK trade rates and current materials cost averages.' },
  { q: 'Is my data private?',
    a: 'Yes — your data is stored locally on your device. AI requests are made to Claude\'s API but no data is used for training. We never share your data with third parties.' },
  { q: 'Does CortexBuild Pro handle CIS deductions?',
    a: 'Yes. On Timesheets, any subcontractor marked as CIS-verified has the 20% deduction calculated automatically. You can see the CIS due total at the top of the Timesheets screen.' },
  { q: 'Can I use CortexBuild Pro offline?',
    a: 'Yes — the app works fully offline. AI features need an internet connection. Your data syncs when you reconnect.' },
  { q: 'Is there a desktop version?',
    a: 'CortexBuild Pro is mobile-first but works on tablets and desktops via web browser. A native desktop app is on our roadmap for Q3.' },
  { q: 'How do I invite my team?',
    a: 'Go to Team → + button → Add team member. They\'ll get an SMS link to install the app and join your workspace.' },
  { q: 'What about photos and drawings?',
    a: 'Photos auto-tag with project + GPS. Drawings live in Documents. You can mark up snags directly on a photo.' },
  { q: 'How does the AI know my business?',
    a: 'During onboarding you describe your business. After that, Cortex sees your live state — projects, cashflow, team, deadlines — and uses that context in every chat and report.' },
];

function HelpScreen({ accent }) {
  const [open, setOpen] = React.useState(null);
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Help" subtitle="FAQs · AI help · contact"/>

        {/* AI Help shortcut */}
        <div style={{ padding: '4px 16px 14px' }}>
          <button onClick={() => window.cortexxNav('ai')} style={{
            width: '100%', background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
            border: 'none', borderRadius: 14, padding: '14px 16px',
            color: '#fff', cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: `0 6px 18px ${T.purple}44`,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{React.cloneElement(Ic.spark, { size: 20 })}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 700 }}>Ask Cortex AI</div>
              <div style={{ fontFamily: SF, fontSize: 12, opacity: 0.85, marginTop: 2 }}>Fastest way to get an answer about anything</div>
            </div>
            <span>{Ic.chevR}</span>
          </button>
        </div>

        <Section title="Frequently asked">
          <GroupedList>
            {FAQ.map((f, i, a) => (
              <div key={i} style={{
                borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
              }}>
                <button onClick={() => setOpen(open === i ? null : i)} style={{
                  width: '100%', background: 'transparent', border: 'none',
                  padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 10, color: T.t1,
                }}>
                  <span style={{ fontFamily: SF, fontSize: 14, fontWeight: 500, flex: 1, lineHeight: 1.3 }}>{f.q}</span>
                  <span style={{ color: T.t3, transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    {React.cloneElement(Ic.chevDown, { size: 16 })}
                  </span>
                </button>
                {open === i && (
                  <div style={{ padding: '0 14px 14px 14px', fontFamily: SF, fontSize: 13, color: T.t2, lineHeight: 1.6 }}>{f.a}</div>
                )}
              </div>
            ))}
          </GroupedList>
        </Section>

        <Section title="Get in touch">
          <GroupedList>
            <Row icon={Ic.mail} iconBg={T.blue} title="Email support" sub="hello@cortexbuildpro.com · ~2 hours"
              onClick={() => window.open('mailto:hello@cortexbuildpro.com?subject=CortexBuild%20Pro%20support', '_blank')}/>
            <Row icon={Ic.phone} iconBg={T.green} title="Call us" sub="0203 555 0123 · Mon–Fri 9–6"
              onClick={() => window.open('tel:02035550123', '_blank')}/>
            <Row icon={Ic.book} iconBg={T.purple} title="Help centre" sub="cortexbuildpro.com/help" isLast
              onClick={() => window.open('/help', '_blank')}/>
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════
const PO_STATUS_C = { draft: T.t3, open: T.amber, received: T.green };

function PurchaseOrdersScreen({ accent }) {
  const pos = useDB('purchaseOrders');
  const projects = useDB('projects');
  const [seg, setSeg] = React.useState('open');
  const filtered = seg === 'all' ? pos : pos.filter(p => p.status === seg);
  const total = pos.filter(p => p.status === 'open').reduce((s, p) => s + p.total, 0);
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader
          title="Purchase orders"
          subtitle={`£${total.toLocaleString()} open · ${pos.filter(p => p.status === 'open').length} POs`}
          right={<button onClick={async () => {
            const next = 'PO-' + (1043 + Math.floor(Math.random() * 50));
            await Backend.db.purchaseOrders.create({
              id: next, supplier: 'New supplier', projectId: 1, total: 0,
              status: 'draft', created: '2026-05-22', delivery: null, items: 0,
            });
            toast(`${next} created · add line items`, 'success');
          }} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {React.cloneElement(Ic.plus, { size: 20 })}
          </button>}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <SegControl value={seg} onChange={setSeg} options={[
            { k: 'all', l: 'All', n: pos.length },
            { k: 'open', l: 'Open', n: pos.filter(p => p.status === 'open').length },
            { k: 'received', l: 'Received', n: pos.filter(p => p.status === 'received').length },
            { k: 'draft', l: 'Draft', n: pos.filter(p => p.status === 'draft').length },
          ]}/>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(po => {
            const proj = projects.find(p => p.id == po.projectId);
            const c = PO_STATUS_C[po.status];
            return (
              <div key={po.id} onClick={() => {
                if (po.status === 'open') {
                  Backend.db.purchaseOrders.update(po.id, { status: 'received' });
                  toast(`${po.id} marked received`, 'success');
                } else {
                  toast(`${po.id} details`, 'info');
                }
              }} style={{
                background: T.bg2, borderRadius: 12, padding: 12,
                border: `0.5px solid ${T.hair}`, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: SFMono, fontSize: 11, color: T.t3, fontWeight: 600 }}>{po.id}</span>
                      <Pill c={c}>{po.status}</Pill>
                    </div>
                    <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: 600, marginTop: 4 }}>{po.supplier}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>
                      {proj?.name?.split(' ').slice(0,2).join(' ')} · {po.items} items
                      {po.delivery && <span> · delivery {_formatRelDate(po.delivery)}</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: SFMono, fontSize: 16, color: T.t1, fontWeight: 700 }}>£{po.total.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT PORTAL — what clients see
// ═══════════════════════════════════════════════════════════════════
function ClientPortalScreen({ accent }) {
  const projects = useDB('projects');
  const invoices = useDB('invoices');
  const diary = useDB('diary');
  const liveProjects = projects.filter(p => ['active', 'snagging', 'quoting'].includes(p.status)).length ? projects.filter(p => ['active', 'snagging', 'quoting'].includes(p.status)) : projects;
  const [pid, setPid] = React.useState((liveProjects[0] || projects[0] || {}).id);
  const project = projects.find(p => p.id == pid) || projects[0];
  const projDiary = diary.filter(d => d.projectId === project.id).slice(0, 3);
  const projInvoices = invoices.filter(iv => iv.projectId === project.id);

  const shareLink = () => {
    const token = btoa(`${project.id}:${(project.client || 'client').replace(/[^a-zA-Z0-9]/g, '')}`).replace(/=+$/, '').slice(0, 18);
    const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}portal.html?pt=${token}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url);
    } catch (e) {}
    if (window.cortexxToast) window.cortexxToast('Portal link copied — share with ' + (project.client || 'client'), 'success');
    if (window.CortexAudit) window.CortexAudit.log('You', `shared client portal for ${project.name}`, 'Settings');
    try { window.open(url, '_blank'); } catch (e) {}
  };

  if (!project) return null;
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <div style={{ padding: '8px 16px 4px', background: `linear-gradient(135deg, ${T.purple}22, ${accent}11)`, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pill c={T.purple} solid size="xs">CLIENT PORTAL · PREVIEW</Pill>
            <button onClick={shareLink} style={{
              background: T.purple, color: '#fff', border: 'none', borderRadius: 16, padding: '6px 12px',
              fontFamily: SF, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}>{React.cloneElement(Ic.share, { size: 12 })} Share link</button>
          </div>
          <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, marginTop: 4, lineHeight: 1.4 }}>
            This is what {project.client} sees. Read-only, branded, automatic.
          </div>
          {/* Project selector */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0 2px' }}>
            {liveProjects.map(p => (
              <button key={p.id} onClick={() => setPid(p.id)} style={{
                background: pid == p.id ? accent : T.bg2, color: pid == p.id ? '#fff' : T.t2,
                border: `0.5px solid ${pid == p.id ? accent : T.hairMid}`, borderRadius: 14,
                padding: '5px 11px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
              }}>{p.name.split(' ').slice(0, 2).join(' ')}</button>
            ))}
          </div>
        </div>

        {/* Hero project card */}
        <div style={{ padding: '8px 16px 14px' }}>
          <div style={{
            background: T.bg2, borderRadius: 16, padding: 16, border: `0.5px solid ${T.hair}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(Ic.spark, { size: 14 })}</div>
              <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t1, letterSpacing: -0.3 }}>CortexBuild Ltd</div>
            </div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>Your project</div>
            <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, marginTop: 2, letterSpacing: -0.5 }}>{project.name}</div>
            <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 4 }}>{project.addr}</div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontFamily: SF, fontSize: 12, color: T.t2, fontWeight: 600 }}>Progress</span>
                <span style={{ fontFamily: SFMono, fontSize: 16, color: accent, fontWeight: 700 }}>{project.pct}%</span>
              </div>
              <Bar pct={project.pct} c={accent} h={6}/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.hair}` }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Started</div>
                <div style={{ fontFamily: SFMono, fontSize: 13, color: T.t1, fontWeight: 600, marginTop: 2 }}>{_formatRelDate(project.createdAt)}</div>
              </div>
              <div>
                <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Est. completion</div>
                <div style={{ fontFamily: SFMono, fontSize: 13, color: T.green, fontWeight: 600, marginTop: 2 }}>{_formatRelDate(project.due)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest updates */}
        <Section title="Latest updates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projDiary.map((d) => (
              <div key={d.id} style={{ background: T.bg2, borderRadius: 12, padding: 12, border: `0.5px solid ${T.hair}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 600, color: T.t2 }}>{_formatRelDate(d.date)}</span>
                  <span style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>📷 {d.photos} · {d.present} on site</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, marginTop: 6, lineHeight: 1.5 }}>{d.summary}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Invoices */}
        <Section title="Invoices">
          <GroupedList>
            {projInvoices.map((iv, i, a) => {
              const c = iv.status === 'paid' ? T.green : iv.status === 'overdue' ? T.red : T.amber;
              return (
                <Row key={iv.id} icon={Ic.doc} iconBg={c}
                  title={`${iv.id} · £${iv.amount.toLocaleString()}`}
                  sub={iv.status === 'paid' ? `Paid ${_formatRelDate(iv.paid)}` : `Due ${_formatRelDate(iv.due)}`}
                  right={iv.status === 'paid' ? <Pill c={c} size="xs">{iv.status}</Pill> : (
                    <button onClick={(e)=>{e.stopPropagation(); if(window.cortexxNav) window.cortexxNav('payinvoice:'+iv.id);}}
                      style={{ padding:'5px 10px', borderRadius: 6, border:'1px solid '+T.hair, background:c, color:'#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textTransform:'uppercase', letterSpacing: 0.4, cursor:'pointer' }}>Pay</button>
                  )}
                  isLast={i === a.length - 1}/>
              );
            })}
          </GroupedList>
        </Section>

        {/* Contact */}
        <Section title="Your team">
          <div style={{
            background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Avatar name="Adrian Stanca" size={44} c={accent}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>Adrian Stanca</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>Project lead · CortexBuild Ltd</div>
            </div>
            <button style={{
              background: accent, color: '#fff', border: 'none', borderRadius: 18,
              padding: '7px 14px', fontFamily: SF, fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}>Message</button>
          </div>
        </Section>

        <div style={{ padding: '20px 20px 0', textAlign: 'center', fontFamily: SF, fontSize: 11, color: T.t3 }}>
          Powered by <span style={{ color: T.purple, fontWeight: 700 }}>CortexBuild Pro</span>
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, {
  LoginSheet, SettingsScreen, HelpScreen,
  PurchaseOrdersScreen, ClientPortalScreen,
});
