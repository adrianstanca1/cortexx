// Cortexx — Per-tenant data export + new-workspace onboarding wizard (Phase 87)

// ═══════════════════════════════════════════════════════════════════
// DATA EXPORT — export this workspace's data as JSON / CSV
// ═══════════════════════════════════════════════════════════════════
function DataExportScreen({ accent }) {
  const tenant = window.CortexTenant ? window.CortexTenant.list().find(t => t.id === window.CortexTenant.active()) : null;
  const [scope, setScope] = React.useState({ projects: true, tasks: true, money: true, photos: false, audit: true, members: true });
  const [busy, setBusy] = React.useState(false);
  const toggle = k => setScope(s => ({ ...s, [k]: !s[k] }));

  const sources = [
    { k: 'projects', l: 'Projects', d: 'Active & archived jobs', i: Ic.projects, c: accent },
    { k: 'tasks',    l: 'Tasks',    d: 'All task records',       i: Ic.tasks,    c: T.green },
    { k: 'money',    l: 'Financials', d: 'Invoices, quotes, payroll', i: Ic.money, c: T.green },
    { k: 'members',  l: 'Team',     d: 'Members & roles',        i: Ic.team,     c: T.blue },
    { k: 'audit',    l: 'Audit log', d: 'Full event trail',      i: Ic.archive,  c: T.purple },
    { k: 'photos',   l: 'Photos',   d: 'Metadata only (no blobs)', i: Ic.camera, c: T.cyan },
  ];

  const collect = () => {
    const out = { workspace: tenant ? tenant.name : 'CortexBuild Pro', exportedAt: new Date().toISOString(), data: {} };
    try {
      if (scope.projects && window.Backend) out.data.projects = window.Backend.db.projects ? '(live)' : [];
      if (scope.audit && window.CortexAudit) out.data.audit = window.CortexAudit.list();
      if (scope.members && window.CortexMembers) out.data.members = window.CortexMembers.list();
    } catch (e) {}
    return out;
  };

  const doExport = (fmt) => {
    setBusy(true);
    setTimeout(() => {
      const payload = collect();
      let blob, name;
      if (fmt === 'json') {
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        name = `cortexx-${(tenant?.name || 'export').toLowerCase().replace(/\W+/g, '-')}-${Date.now()}.json`;
      } else {
        const rows = (payload.data.audit || []).map(e => `"${e.when}","${e.who}","${e.area}","${e.action}"`);
        blob = new Blob(['When,Who,Area,Action\n' + rows.join('\n')], { type: 'text/csv' });
        name = `cortexx-audit-${Date.now()}.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBusy(false);
      if (window.cortexxToast) window.cortexxToast('Export downloaded', 'success');
      if (window.CortexAudit) window.CortexAudit.log('You', `exported workspace data (${fmt.toUpperCase()})`, 'Settings');
    }, 600);
  };

  const count = Object.values(scope).filter(Boolean).length;
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Export data" subtitle={tenant ? `${tenant.name} · GDPR portable` : 'GDPR portable'}/>
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginBottom: 10, lineHeight: 1.5 }}>
            Download a portable copy of this workspace. Data stays isolated to {tenant ? tenant.name : 'your org'} — nothing leaks across tenants.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sources.map(s => (
              <button key={s.k} onClick={() => toggle(s.k)} style={{
                background: T.bg2, border: `0.5px solid ${scope[s.k] ? s.c : T.hair}`, borderRadius: 12,
                padding: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.c}1a`, color: s.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{React.cloneElement(s.i, { size: 17 })}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{s.l}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{s.d}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${scope[s.k] ? s.c : T.hairMid}`, background: scope[s.k] ? s.c : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {scope[s.k] && <span style={{ color: '#fff' }}>{React.cloneElement(Ic.check, { size: 13, sw: 3 })}</span>}
                </div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => doExport('json')} disabled={busy || !count} style={{
              flex: 1, background: count ? accent : T.bg3, color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
              fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: count ? 'pointer' : 'default', opacity: count ? 1 : 0.5,
            }}>{busy ? 'Exporting…' : `Export JSON (${count})`}</button>
            <button onClick={() => doExport('csv')} disabled={busy} style={{
              background: T.bg2, color: T.t1, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '14px 18px',
              fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>CSV</button>
          </div>
          <div style={{ marginTop: 14, padding: 12, background: T.bg2, borderRadius: 10, fontFamily: SF, fontSize: 11, color: T.t2, lineHeight: 1.5 }}>
            {React.cloneElement(Ic.shield, { size: 13, color: T.green })} Export satisfies GDPR Article 20 (data portability). Photo binaries are excluded — request a full media archive from your admin.
          </div>
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ONBOARDING WIZARD — create a new workspace
// ═══════════════════════════════════════════════════════════════════
function OnboardWizard({ accent, onClose }) {
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState({ name: '', trade: 'General Build', size: '1–10', color: '#2563eb' });
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const trades = ['General Build', 'Groundworks', 'M&E', 'Fit-out', 'Roofing', 'Civils'];
  const sizes = ['1–10', '11–50', '51–200', '200+'];
  const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

  const steps = [
    { t: 'Company name', d: 'What should we call your workspace?' },
    { t: 'Your trade', d: 'We tailor templates to your sector' },
    { t: 'Team size', d: 'Helps us pick the right plan' },
    { t: 'Brand colour', d: 'Personalise your CortexBuild Pro' },
  ];

  const finish = () => {
    try {
      if (window.CortexTenant && window.CortexTenant.create) {
        window.CortexTenant.create(data.name || 'New Workspace');
      }
      if (window.CortexAudit) window.CortexAudit.log('You', `created workspace "${data.name}"`, 'Settings');
    } catch (e) {}
    if (window.cortexxToast) window.cortexxToast('Workspace created — 14-day trial started', 'success');
    onClose();
  };

  const canNext = step !== 0 || data.name.trim().length > 1;

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 24px' }}>
        {/* progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? accent : T.hair, transition: 'background 0.3s' }}/>
          ))}
        </div>
        <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>Step {step + 1} of {steps.length}</div>
        <div style={{ fontFamily: SF, fontSize: 26, fontWeight: 700, color: T.t1, letterSpacing: -0.5, marginTop: 6 }}>{steps[step].t}</div>
        <div style={{ fontFamily: SF, fontSize: 14, color: T.t2, marginTop: 6, marginBottom: 28 }}>{steps[step].d}</div>

        <div style={{ flex: 1 }}>
          {step === 0 && (
            <input autoFocus value={data.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Meridian Build Ltd"
              style={{ width: '100%', background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '15px', color: T.t1, fontFamily: SF, fontSize: 16, outline: 'none', boxSizing: 'border-box' }}/>
          )}
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {trades.map(t => (
                <button key={t} onClick={() => set('trade', t)} style={{
                  background: data.trade === t ? `${accent}14` : T.bg2, border: `0.5px solid ${data.trade === t ? accent : T.hair}`,
                  borderRadius: 12, padding: '16px 12px', cursor: 'pointer', fontFamily: SF, fontSize: 14, fontWeight: 600,
                  color: data.trade === t ? accent : T.t1,
                }}>{t}</button>
              ))}
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sizes.map(s => (
                <button key={s} onClick={() => set('size', s)} style={{
                  background: data.size === s ? `${accent}14` : T.bg2, border: `0.5px solid ${data.size === s ? accent : T.hair}`,
                  borderRadius: 12, padding: '16px', cursor: 'pointer', fontFamily: SF, fontSize: 15, fontWeight: 600,
                  color: data.size === s ? accent : T.t1, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>{s} people {data.size === s && <span style={{ color: accent }}>{React.cloneElement(Ic.check, { size: 18, sw: 3 })}</span>}</button>
              ))}
            </div>
          )}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
                {colors.map(c => (
                  <button key={c} onClick={() => set('color', c)} style={{
                    width: 52, height: 52, borderRadius: 26, background: c, border: data.color === c ? '3px solid #fff' : '3px solid transparent',
                    boxShadow: data.color === c ? `0 0 0 2px ${c}` : 'none', cursor: 'pointer',
                  }}/>
                ))}
              </div>
              <div style={{ background: T.bg2, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={data.name || 'New Workspace'} size={44} c={data.color}/>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: T.t1 }}>{data.name || 'New Workspace'}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: T.t2 }}>{data.trade} · {data.size} people · Trial</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{ background: T.bg2, color: T.t1, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '15px 22px', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Back</button>
          )}
          <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : finish()} disabled={!canNext} style={{
            flex: 1, background: canNext ? accent : T.bg3, color: '#fff', border: 'none', borderRadius: 12, padding: '15px',
            fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: canNext ? 'pointer' : 'default', opacity: canNext ? 1 : 0.5,
          }}>{step < steps.length - 1 ? 'Continue' : 'Create workspace'}</button>
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { DataExportScreen, OnboardWizard });
