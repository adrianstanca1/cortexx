// Cortexx — Notification prefs · workspace switcher · checkout (Phase 88)

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES — per-member, per-tenant
// ═══════════════════════════════════════════════════════════════════
(function () {
  if (window.CortexNotifPrefs) return;
  const KEY = () => 'cortexx_notif__' + (window.CortexTenant ? window.CortexTenant.active() : 'default');
  const DEFAULTS = {
    tasks: { push: true, email: true },
    money: { push: true, email: true },
    approvals: { push: true, email: false },
    safety: { push: true, email: true },
    vera: { push: false, email: true },
    mentions: { push: true, email: true },
    quiet: { on: true, from: '20:00', to: '07:00' },
  };
  function load() { try { const r = localStorage.getItem(KEY()); if (r) return { ...DEFAULTS, ...JSON.parse(r) }; } catch (e) {} return { ...DEFAULTS }; }
  window.CortexNotifPrefs = {
    get() { return load(); },
    set(p) { try { localStorage.setItem(KEY(), JSON.stringify(p)); } catch (e) {} },
  };
})();

function NotificationPrefsScreen({ accent }) {
  const [p, setP] = React.useState(window.CortexNotifPrefs.get());
  const save = (np) => { setP(np); window.CortexNotifPrefs.set(np); };
  const toggle = (cat, ch) => save({ ...p, [cat]: { ...p[cat], [ch]: !p[cat][ch] } });

  const cats = [
    { k: 'tasks', l: 'Tasks & deadlines', i: Ic.tasks, c: T.green },
    { k: 'money', l: 'Invoices & payments', i: Ic.money, c: T.green },
    { k: 'approvals', l: 'Approvals & variations', i: Ic.check, c: T.purple },
    { k: 'safety', l: 'Safety & incidents', i: Ic.safety, c: T.red },
    { k: 'vera', l: 'Vera CEO digests', i: Ic.spark, c: accent },
    { k: 'mentions', l: '@mentions & messages', i: Ic.bell, c: T.blue },
  ];

  const Switch = ({ on, onClick }) => (
    <button onClick={onClick} style={{
      width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
      background: on ? accent : T.bg3, position: 'relative', transition: 'background 0.2s',
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
    </button>
  );

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Notifications" subtitle="Per channel · saved to this workspace"/>
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px 8px', gap: 8 }}>
            <div style={{ flex: 1 }}/>
            <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: T.t3, width: 44, textAlign: 'center' }}>Push</span>
            <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color: T.t3, width: 44, textAlign: 'center' }}>Email</span>
          </div>
          <div style={{ background: T.bg2, borderRadius: 14, overflow: 'hidden' }}>
            {cats.map((c, i) => (
              <div key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i === cats.length - 1 ? 'none' : `0.5px solid ${T.hair}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c.c}1a`, color: c.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{React.cloneElement(c.i, { size: 16 })}</div>
                <div style={{ flex: 1, fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{c.l}</div>
                <div style={{ width: 44, display: 'flex', justifyContent: 'center' }}><Switch on={p[c.k].push} onClick={() => toggle(c.k, 'push')}/></div>
                <div style={{ width: 44, display: 'flex', justifyContent: 'center' }}><Switch on={p[c.k].email} onClick={() => toggle(c.k, 'email')}/></div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, background: T.bg2, borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>Quiet hours</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>Mute push between set times</div>
              </div>
              <Switch on={p.quiet.on} onClick={() => save({ ...p, quiet: { ...p.quiet, on: !p.quiet.on } })}/>
            </div>
            {p.quiet.on && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                {['from', 'to'].map(k => (
                  <div key={k} style={{ flex: 1 }}>
                    <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{k}</div>
                    <input type="time" value={p.quiet[k]} onChange={e => save({ ...p, quiet: { ...p.quiet, [k]: e.target.value } })}
                      style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 8, padding: '8px', color: T.t1, fontFamily: SFMono, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER — quick sheet to jump between tenants
// ═══════════════════════════════════════════════════════════════════
function WorkspaceSwitcher({ accent, onClose }) {
  const tenants = window.CortexTenant ? window.CortexTenant.list() : [];
  const activeId = window.CortexTenant ? window.CortexTenant.active() : null;
  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: '20px 20px 30px' }}>
        <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 700, color: T.t1, marginBottom: 4 }}>Switch workspace</div>
        <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginBottom: 18 }}>Each workspace keeps fully isolated data.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tenants.map(t => {
            const isActive = t.id === activeId;
            return (
              <button key={t.id} onClick={() => { if (!isActive && window.CortexTenant) window.CortexTenant.switch(t.id); else onClose(); }} style={{
                background: isActive ? `${accent}11` : T.bg2, border: `0.5px solid ${isActive ? accent : T.hair}`,
                borderRadius: 12, padding: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              }}>
                <Avatar name={t.name} size={40} c={t.color}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{t.role} · {t.plan} plan</div>
                </div>
                {isActive ? <Pill c={T.green}>current</Pill> : React.cloneElement(Ic.chevR || Ic.chevL, { size: 18, color: T.t3 })}
              </button>
            );
          })}
          <button onClick={() => { onClose(); setTimeout(() => window.cortexxNav && window.cortexxNav('newworkspace'), 250); }} style={{
            background: 'none', border: `1px dashed ${T.hairMid}`, borderRadius: 12, padding: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: accent, fontFamily: SF, fontSize: 14, fontWeight: 600,
          }}>{React.cloneElement(Ic.plus, { size: 16 })} New workspace</button>
        </div>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CHECKOUT — plan upgrade with card form (Stripe-style mock)
// ═══════════════════════════════════════════════════════════════════
function CheckoutSheet({ accent, plan, price, onClose }) {
  const [card, setCard] = React.useState('');
  const [exp, setExp] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const fmtCard = v => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = v => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };
  const valid = card.replace(/\s/g, '').length >= 15 && exp.length === 5 && cvc.length >= 3;

  const pay = () => {
    setBusy(true);
    setTimeout(() => {
      if (window.CortexTenant && window.CortexTenant.setPlan) window.CortexTenant.setPlan(plan);
      if (window.CortexAudit) window.CortexAudit.log('You', `upgraded to ${plan} plan`, 'Billing');
      setBusy(false); setDone(true);
      setTimeout(() => { onClose(); if (window.CortexTenant) location.reload(); }, 1400);
    }, 1100);
  };

  if (done) {
    return (
      <Sheet onClose={onClose}>
        <div style={{ padding: '50px 24px', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: T.green, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(Ic.check, { size: 38, color: '#fff', sw: 3 })}</div>
          <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1 }}>You're on {plan}</div>
          <div style={{ fontFamily: SF, fontSize: 14, color: T.t2, marginTop: 6 }}>Payment confirmed · receipt emailed</div>
        </div>
      </Sheet>
    );
  }

  const Inp = (props) => <input {...props} style={{ background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 10, padding: '13px', color: T.t1, fontFamily: SFMono, fontSize: 15, outline: 'none', boxSizing: 'border-box', ...props.style }}/>;

  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: '20px 20px 30px' }}>
        <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 700, color: T.t1 }}>Upgrade to {plan}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, marginBottom: 20 }}>
          <span style={{ fontFamily: SFMono, fontSize: 30, fontWeight: 700, color: accent }}>{price}</span>
          <span style={{ fontFamily: SF, fontSize: 13, color: T.t2 }}>/month · billed monthly · cancel anytime</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Card number</div>
            <Inp value={card} onChange={e => setCard(fmtCard(e.target.value))} placeholder="4242 4242 4242 4242" inputMode="numeric" style={{ width: '100%' }}/>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Expiry</div>
              <Inp value={exp} onChange={e => setExp(fmtExp(e.target.value))} placeholder="MM/YY" inputMode="numeric" style={{ width: '100%' }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>CVC</div>
              <Inp value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" inputMode="numeric" style={{ width: '100%' }}/>
            </div>
          </div>
        </div>
        <button onClick={pay} disabled={!valid || busy} style={{
          width: '100%', marginTop: 18, background: valid ? accent : T.bg3, color: '#fff', border: 'none', borderRadius: 12, padding: '15px',
          fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: valid ? 'pointer' : 'default', opacity: valid ? 1 : 0.5,
        }}>{busy ? 'Processing…' : `Pay ${price} & upgrade`}</button>
        <div style={{ textAlign: 'center', marginTop: 12, fontFamily: SF, fontSize: 11, color: T.t3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {React.cloneElement(Ic.shield, { size: 13, color: T.green })} Secured · PCI-DSS · 256-bit TLS
        </div>
      </div>
    </Sheet>
  );
}

Object.assign(window, { NotificationPrefsScreen, WorkspaceSwitcher, CheckoutSheet });
