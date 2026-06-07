// Cortexx — Notification digests (Phase 91)
// A scheduled summary of what matters to a member: tasks due, overdue invoices,
// approvals waiting, safety expiries. Live-compiled from Backend data, per tenant.

(function () {
  if (window.CortexDigest) return;
  const KEY = () => 'cortexx_digest__' + (window.CortexTenant ? window.CortexTenant.active() : 'default');
  const DEFAULTS = { freq: 'daily', time: '07:00', day: 'Mon', channels: { email: true, push: false } };
  function load() { try { const r = localStorage.getItem(KEY()); if (r) return { ...DEFAULTS, ...JSON.parse(r) }; } catch (e) {} return { ...DEFAULTS }; }
  window.CortexDigest = {
    get() { return load(); },
    set(p) { try { localStorage.setItem(KEY(), JSON.stringify(p)); } catch (e) {} },
    // Compile the live digest from current Backend state.
    compile() {
      const db = window.Backend && window.Backend.db;
      const out = { tasks: [], invoices: [], approvals: [], safety: [] };
      if (!db) return out;
      try {
        const tasks = db.tasks.listSync ? db.tasks.listSync() : [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        out.tasks = (tasks || []).filter(t => !t.done && t.due).filter(t => {
          const d = new Date(t.due); return d <= new Date(today.getTime() + 2 * 864e5);
        }).slice(0, 6);
      } catch (e) {}
      try {
        const inv = db.invoices.listSync ? db.invoices.listSync() : [];
        out.invoices = (inv || []).filter(i => ['overdue', 'due'].includes(i.status)).slice(0, 6);
      } catch (e) {}
      try {
        const q = db.quotes && db.quotes.listSync ? db.quotes.listSync() : [];
        out.approvals = (q || []).filter(x => x.status === 'sent').slice(0, 4);
      } catch (e) {}
      try {
        const team = db.team && db.team.listSync ? db.team.listSync() : [];
        out.safety = (team || []).filter(m => m.cscs === 'Red' || m.cscsExpiry).slice(0, 4);
      } catch (e) {}
      return out;
    },
  };
})();

function DigestScreen({ accent }) {
  const [cfg, setCfg] = React.useState(window.CortexDigest.get());
  useDB('tasks'); useDB('invoices'); // re-render on data change
  const digest = window.CortexDigest.compile();
  const save = (c) => { setCfg(c); window.CortexDigest.set(c); };

  const total = digest.tasks.length + digest.invoices.length + digest.approvals.length + digest.safety.length;
  const FREQ = [{ k: 'off', l: 'Off' }, { k: 'daily', l: 'Daily' }, { k: 'weekly', l: 'Weekly' }];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const Switch = ({ on, onClick }) => (
    <button onClick={onClick} style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0, background: on ? accent : T.bg3, position: 'relative', transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}/>
    </button>
  );

  const Group = ({ title, color, items, render }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>{title} · {items.length}</div>
      <div style={{ background: T.bg2, borderRadius: 12, border: `0.5px solid ${T.hair}`, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={i} style={{ padding: '10px 13px', borderBottom: i === items.length - 1 ? 'none' : `0.5px solid ${T.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 }}/>
            {render(it)}
          </div>
        ))}
      </div>
    </div>
  );

  const sendTest = () => {
    if (window.cortexxToast) window.cortexxToast(`Digest sent · ${total} items`, 'success');
    if (window.CortexAudit) window.CortexAudit.log('You', `sent test digest (${total} items)`, 'Settings');
  };

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Digests" subtitle="Your scheduled summary" ws/>

        {/* Schedule controls */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Frequency</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FREQ.map(f => (
                <button key={f.k} onClick={() => save({ ...cfg, freq: f.k })} style={{
                  flex: 1, background: cfg.freq === f.k ? accent : T.bg3, color: cfg.freq === f.k ? '#fff' : T.t2,
                  border: 'none', borderRadius: 9, padding: '10px', cursor: 'pointer', fontFamily: SF, fontSize: 13, fontWeight: 700,
                }}>{f.l}</button>
              ))}
            </div>

            {cfg.freq !== 'off' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Time</div>
                  <input type="time" value={cfg.time} onChange={e => save({ ...cfg, time: e.target.value })}
                    style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 8, padding: '9px', color: T.t1, fontFamily: SFMono, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
                </div>
                {cfg.freq === 'weekly' && (
                  <div style={{ flex: 1.4 }}>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Day</div>
                    <select value={cfg.day} onChange={e => save({ ...cfg, day: e.target.value })}
                      style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 8, padding: '9px', color: T.t1, fontFamily: SF, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {cfg.freq !== 'off' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['email', 'Email digest'], ['push', 'Push summary']].map(([k, l]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: SF, fontSize: 14, color: T.t1 }}>{l}</span>
                    <Switch on={cfg.channels[k]} onClick={() => save({ ...cfg, channels: { ...cfg.channels, [k]: !cfg.channels[k] } })}/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cfg.freq !== 'off' && (
            <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, textAlign: 'center', margin: '12px 0 4px' }}>
              Next: {cfg.freq === 'daily' ? `every day at ${cfg.time}` : `every ${cfg.day} at ${cfg.time}`}
            </div>
          )}
        </div>

        {/* Live preview */}
        <Section title={`Preview · ${total} item${total === 1 ? '' : 's'}`}>
          <div style={{ padding: '0 16px' }}>
            {total === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>
                Nothing needs attention right now — your digest is clear. 🎉
              </div>
            ) : (
              <>
                <Group title="Tasks due soon" color={T.amber} items={digest.tasks} render={t => (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 500 }}>{t.t || t.title}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>{t.assignee || 'Unassigned'} · due {new Date(t.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                  </div>
                )}/>
                <Group title="Invoices outstanding" color={T.red} items={digest.invoices} render={iv => (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: SF, fontSize: 13, color: T.t1 }}>{iv.client}</span>
                    <span style={{ fontFamily: SFMono, fontSize: 12, color: iv.status === 'overdue' ? T.red : T.amber, fontWeight: 700 }}>£{(iv.amount || 0).toLocaleString()}</span>
                  </div>
                )}/>
                <Group title="Quotes awaiting reply" color={T.purple} items={digest.approvals} render={q => (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: SF, fontSize: 13, color: T.t1 }}>{q.client || q.title}</span>
                    <span style={{ fontFamily: SFMono, fontSize: 12, color: T.t2 }}>£{((q.total || 0) / 1000).toFixed(1)}k</span>
                  </div>
                )}/>
                <Group title="Certs to check" color={T.cyan} items={digest.safety} render={m => (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: SF, fontSize: 13, color: T.t1 }}>{m.n || m.name}</span>
                    <span style={{ fontFamily: SF, fontSize: 11, color: T.t3 }}>{m.cscs || 'CSCS'}</span>
                  </div>
                )}/>
              </>
            )}
          </div>
        </Section>

        <div style={{ padding: '4px 16px 0' }}>
          <button onClick={sendTest} disabled={total === 0} style={{
            width: '100%', background: total ? accent : T.bg3, color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
            fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: total ? 'pointer' : 'default', opacity: total ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>{React.cloneElement(Ic.send, { size: 15 })} Send me this digest now</button>
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { DigestScreen });
