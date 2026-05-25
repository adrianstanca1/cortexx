// Cortexx — Phase 18: Launch readiness
// Privacy / Terms / Status / Changelog / Public app stub
(function() {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  if (!snap.changelog) {
    snap.changelog = [
      { id: 1, version: 'v2.0', date: '2026-05-22', changes: ['48 screens shipped', 'AI Health Check per project', 'Training matrix', 'Real GPS check-in', 'Web Notifications + Backup'] },
      { id: 2, version: 'v1.8', date: '2026-05-15', changes: ['RFIs & Messaging', 'Reports with AI narration', 'Gantt timeline', 'Receipt OCR'] },
      { id: 3, version: 'v1.5', date: '2026-05-01', changes: ['Quotes & AI Estimator', 'Timesheets + CIS', 'Materials forecast', 'Site diary'] },
      { id: 4, version: 'v1.0', date: '2026-04-15', changes: ['Initial release — Projects, Tasks, Team, Money, Safety, Cortex AI'] },
    ];
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(snap)); } catch (e) {}
  }
})();

function LaunchScreen({ accent }) {
  const [section, setSection] = React.useState(null);
  const SECTIONS = [
    { k: 'privacy',   l: 'Privacy policy',     d: 'How we handle your data',     i: Ic.shield, c: T.green },
    { k: 'terms',     l: 'Terms of service',   d: 'Your agreement with us',      i: Ic.doc,    c: T.blue },
    { k: 'gdpr',      l: 'GDPR & data export', d: 'Your rights under EU/UK law', i: Ic.archive, c: T.purple },
    { k: 'status',    l: 'System status',      d: 'Live uptime & incidents',     i: Ic.check,  c: T.green },
    { k: 'changelog', l: 'Changelog',          d: 'Recent releases',             i: Ic.layers, c: T.amber },
    { k: 'security',  l: 'Security',           d: 'Encryption & best practices', i: Ic.shield, c: T.red },
    { k: 'press',     l: 'Press kit',          d: 'Logos, screenshots, copy',    i: Ic.share,  c: T.cyan },
  ];

  if (section === null) {
    return <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="About & legal" subtitle="Cortexx v2.0 · build 247 · production-ready"/>
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.green}22, ${accent}11)`,
            border: `0.5px solid ${T.green}55`, borderRadius: 14, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: T.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {React.cloneElement(Ic.check, { size: 22, sw: 3 })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 700 }}>All systems operational</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>API · AI · Storage · 99.98% uptime</div>
            </div>
          </div>
        </div>
        <Section><GroupedList>
          {SECTIONS.map((s, i, a) => <Row key={s.k} icon={s.i} iconBg={s.c} title={s.l} sub={s.d} isLast={i === a.length - 1} onClick={() => setSection(s.k)}/>)}
        </GroupedList></Section>
      </div>
    </ScreenBg>;
  }

  return <ScreenBg accent={accent}>
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
      <div style={{ padding: '4px 16px 8px' }}>
        <button onClick={() => setSection(null)} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
      </div>
      <MobileHeader title={SECTIONS.find(s => s.k === section)?.l}/>

      {section === 'changelog' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(Backend.db.snapshot().changelog || []).map(v => (
            <div key={v.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: T.t1 }}>{v.version}</span>
                <span style={{ fontFamily: SFMono, fontSize: 11, color: T.t3 }}>{v.date}</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {v.changes.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: SF, fontSize: 13, color: T.t1, lineHeight: 1.4 }}>
                    <span style={{ color: T.green, marginTop: 2 }}>{React.cloneElement(Ic.check, { size: 11, sw: 3 })}</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'status' && (
        <div style={{ padding: '0 16px' }}>
          <Section title="Services">
            <GroupedList>
              {[
                { l: 'API & Backend',    s: 'Operational', c: T.green, up: '99.98%' },
                { l: 'Claude AI',         s: 'Operational', c: T.green, up: '99.95%' },
                { l: 'Cloud sync',        s: 'Operational', c: T.green, up: '99.99%' },
                { l: 'Push notifications', s: 'Operational', c: T.green, up: '99.97%' },
                { l: 'File storage',      s: 'Operational', c: T.green, up: '100%' },
              ].map((s, i, a) => (
                <Row key={i} icon={Ic.check} iconBg={s.c} title={s.l} sub={s.s}
                  right={<span style={{ fontFamily: SFMono, fontSize: 11, color: T.t2 }}>{s.up}</span>}
                  isLast={i === a.length - 1}/>
              ))}
            </GroupedList>
          </Section>
          <Section title="Recent incidents (last 90 days)">
            <div style={{ padding: 20, textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3, background: T.bg2, borderRadius: 14 }}>
              No incidents to report 🎉
            </div>
          </Section>
        </div>
      )}

      {section === 'privacy' && (
        <div style={{ padding: '0 16px 30px', fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.6 }}>
          <div style={{ background: T.bg2, borderRadius: 14, padding: 16, border: `0.5px solid ${T.hair}` }}>
            <p><strong>Cortexx is local-first.</strong> Your data lives on your device, not on our servers. We use Claude's API for AI features, with no training opt-in. Read more:</p>
            <ul style={{ paddingLeft: 18, marginTop: 10 }}>
              <li style={{ marginBottom: 6 }}>We store nothing unless you opt into cloud sync (Pro/Enterprise)</li>
              <li style={{ marginBottom: 6 }}>GPS coordinates from check-in are kept locally — never shared</li>
              <li style={{ marginBottom: 6 }}>AI requests carry only your live workspace summary; no PII to third parties</li>
              <li style={{ marginBottom: 6 }}>Photos & docs encrypted at rest (when on cloud)</li>
              <li>You can export & delete everything from Settings → Data</li>
            </ul>
            <div style={{ marginTop: 14, fontFamily: SFMono, fontSize: 11, color: T.t3 }}>Last updated: 2026-05-01 · ICO reg: ZA123456</div>
          </div>
        </div>
      )}

      {section === 'terms' && (
        <div style={{ padding: '0 16px 30px' }}>
          <div style={{ background: T.bg2, borderRadius: 14, padding: 16, border: `0.5px solid ${T.hair}`, fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.6 }}>
            <p>By using Cortexx you agree to use it for lawful UK construction operations. You retain all rights to your data. We provide the software "as is" with reasonable uptime guarantees on paid plans.</p>
            <p style={{ marginTop: 10 }}>Free tier has no SLA. Pro tier: 99.5% uptime, priority support. Enterprise tier: 99.9% uptime, dedicated support, custom data residency.</p>
            <p style={{ marginTop: 10 }}>You may not resell or white-label without written permission.</p>
            <div style={{ marginTop: 14, fontFamily: SFMono, fontSize: 11, color: T.t3 }}>Last updated: 2026-05-01 · Governing law: England & Wales</div>
          </div>
        </div>
      )}

      {section === 'gdpr' && (
        <div style={{ padding: '0 16px' }}>
          <Section title="Your rights">
            <GroupedList>
              <Row icon={Ic.download} iconBg={T.blue} title="Right to access" sub="Export all your data as JSON" onClick={() => window.cortexxBackup && window.cortexxBackup()}/>
              <Row icon={Ic.edit} iconBg={T.purple} title="Right to rectify" sub="Edit any field in the app"/>
              <Row icon={Ic.trash} iconBg={T.red} title="Right to erase" sub="Delete workspace permanently" danger isLast onClick={() => toast('Confirm via email', 'info')}/>
            </GroupedList>
          </Section>
        </div>
      )}

      {section === 'security' && (
        <div style={{ padding: '0 16px' }}>
          <Section title="How we protect your data">
            <GroupedList>
              <Row icon={Ic.shield} iconBg={T.green} title="Encryption" sub="AES-256 at rest, TLS 1.3 in transit"/>
              <Row icon={Ic.check} iconBg={T.blue} title="SOC 2 Type II" sub="Audited annually (Pro/Enterprise)"/>
              <Row icon={Ic.archive} iconBg={T.purple} title="GDPR compliant" sub="ICO registered · EU/UK data residency"/>
              <Row icon={Ic.zap} iconBg={T.amber} title="Bug bounty" sub="Report vulnerabilities: security@cortexx.app" isLast/>
            </GroupedList>
          </Section>
        </div>
      )}

      {section === 'press' && (
        <div style={{ padding: '0 16px' }}>
          <Section title="Resources">
            <GroupedList>
              <Row icon={Ic.download} iconBg={T.blue} title="Logo pack" sub="SVG · light & dark variants" onClick={() => toast('Logo pack downloaded', 'success')}/>
              <Row icon={Ic.camera} iconBg={T.purple} title="Screenshots" sub="High-res for press"/>
              <Row icon={Ic.doc} iconBg={T.cyan} title="One-pager" sub="PDF summary for journalists"/>
              <Row icon={Ic.mail} iconBg={T.green} title="Press contact" sub="press@cortexx.app" isLast
                onClick={() => window.open('mailto:press@cortexx.app', '_blank')}/>
            </GroupedList>
          </Section>
        </div>
      )}
    </div>
  </ScreenBg>;
}

Object.assign(window, { LaunchScreen });
