// CortexBuild Pro — Retention Ledger + per-invoice settings (Phase 107)
// Built on lib/retention.js — see that file for the core engine.

// ════════════════════════════════════════════════════════════════════
// PER-INVOICE RETENTION SHEET
// ════════════════════════════════════════════════════════════════════
function RetentionSheet({ accent, invoiceId, onClose }) {
  const invoices = useDB('invoices');
  const inv = invoices.find(i => i.id === invoiceId);
  const R = window.CortexRetention;

  const [pct, setPct] = React.useState(inv ? (inv.retentionPct || 0) * 100 : 5);
  const [pcDate, setPcDate] = React.useState(inv?.pcDate || '');
  const [defectsDays, setDefectsDays] = React.useState(inv?.defectsPeriodDays || 365);
  const [releaseAmt, setReleaseAmt] = React.useState('');

  if (!inv) return <ScreenBg accent={accent}><div style={{padding:40,textAlign:'center',color:T.t2}}>Invoice not found.</div></ScreenBg>;
  if (!R) return <ScreenBg accent={accent}><div style={{padding:40,textAlign:'center',color:T.t2}}>Retention engine not loaded.</div></ScreenBg>;

  const enriched = R.withRetention({ ...inv, retentionPct: pct / 100, pcDate, defectsPeriodDays: defectsDays });

  const save = async () => {
    await R.setPct(inv.id, pct / 100, { pcDate, defectsPeriodDays: Number(defectsDays) });
    if (window.cortexxToast) window.cortexxToast('Retention set: ' + pct + '%', 'success');
    onClose && onClose();
  };

  const release = async (kind) => {
    const amt = releaseAmt ? Number(releaseAmt) : null;
    await R.release(inv.id, kind, amt);
    setReleaseAmt('');
    if (window.cortexxToast) window.cortexxToast('Released ' + (amt ? '£'+amt.toLocaleString() : 'all outstanding'), 'success');
    onClose && onClose();
  };

  const PRESET = [0, 1.5, 2.5, 3, 5, 10];
  const fmt = n => '£' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const Stat = ({ l, v, c }) => (
    <div style={{ flex: 1, padding: 10, borderRadius: 8, background: T.bg1, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: T.t2, marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: c || T.t1, fontFamily: SFMono }}>{v}</div>
    </div>
  );

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="Retention" subtitle={inv.id + ' · ' + (inv.client || '') + ' · £' + (inv.amount || 0).toLocaleString()}/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>

        {/* Live preview */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Stat l="INVOICE TOTAL" v={fmt(inv.amount)}/>
            <Stat l="PAYABLE NOW" v={fmt(enriched.payableNow)} c={T.green}/>
            <Stat l="HELD BACK" v={fmt(enriched.retentionAmount)} c={T.amber}/>
          </div>
        </div>

        {/* Percentage chooser */}
        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>RETENTION %</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {PRESET.map(p => (
            <button key={p} onClick={() => setPct(p)}
              style={{ flex: '1 1 60px', padding: '10px 6px', borderRadius: 10,
                border: '1px solid ' + (pct === p ? accent : T.hair),
                background: pct === p ? accent + '22' : T.bg2,
                color: T.t1, fontFamily: SF, fontSize: 13, fontWeight: 700 }}>
              {p}%
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="number" min="0" max="20" step="0.5" value={pct}
            onChange={e => setPct(Number(e.target.value))}
            style={{ width: 90, padding: 10, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SFMono, fontSize: 14, textAlign: 'center' }}/>
          <span style={{ fontSize: 12, color: T.t2 }}>Custom % (UK typical: 3–5%, max usually 10%)</span>
        </div>

        {/* Dates */}
        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>RELEASE SCHEDULE</div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 11, color: T.t2, marginBottom: 4 }}>Practical completion date (50% released)</label>
          <input type="date" value={pcDate} onChange={e => setPcDate(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SFMono, fontSize: 13, boxSizing: 'border-box' }}/>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', fontSize: 11, color: T.t2, marginBottom: 4 }}>Defects liability period (days)</label>
          <input type="number" value={defectsDays} onChange={e => setDefectsDays(e.target.value)}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SFMono, fontSize: 13, boxSizing: 'border-box' }}/>
          <div style={{ fontSize: 11, color: T.t2, marginTop: 4 }}>
            {pcDate && <>Final release: <strong style={{ color: T.t1 }}>{(() => { const d=new Date(pcDate); d.setDate(d.getDate()+Number(defectsDays)); return d.toISOString().slice(0,10); })()}</strong></>}
          </div>
        </div>

        <button onClick={save}
          style={{ marginTop: 16, width: '100%', padding: 14, borderRadius: 12, border: 'none', background: accent, color: '#fff', fontFamily: SF, fontSize: 14, fontWeight: 700 }}>
          Save retention settings
        </button>

        {/* Release section — only if retention exists */}
        {(inv.retentionPct || 0) > 0 && (
          <div style={{ marginTop: 22, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 8 }}>RELEASE RETENTION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 10 }}>
              <div><div style={{ color: T.t2 }}>Currently released</div><div style={{ fontWeight: 700, fontFamily: SFMono }}>{fmt(inv.retentionReleased || 0)}</div></div>
              <div><div style={{ color: T.t2 }}>Still outstanding</div><div style={{ fontWeight: 700, fontFamily: SFMono, color: T.amber }}>{fmt(enriched.retentionOutstanding)}</div></div>
            </div>
            <input type="number" value={releaseAmt} onChange={e => setReleaseAmt(e.target.value)} placeholder="Amount (blank = all outstanding)"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SFMono, fontSize: 13, boxSizing: 'border-box' }}/>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => release('pc')}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontSize: 13, fontWeight: 600 }}>
                Release at PC
              </button>
              <button onClick={() => release('final')}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 13, fontWeight: 700 }}>
                Release (final)
              </button>
            </div>
          </div>
        )}
      </div>
    </ScreenBg>
  );
}

// ════════════════════════════════════════════════════════════════════
// RETENTION LEDGER — aggregate view of ALL held-back retention
// ════════════════════════════════════════════════════════════════════
function RetentionLedgerScreen({ accent }) {
  const invoices = useDB('invoices');
  const projects = useDB('projects');
  const R = window.CortexRetention;
  if (!R) return <ScreenBg accent={accent}><div style={{padding:40,textAlign:'center',color:T.t2}}>Retention engine not loaded.</div></ScreenBg>;

  const led = R.ledger(invoices, projects);
  const fmt = n => '£' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const remindAll = () => {
    // Push a notification + activity entry per upcoming release
    const upcoming = led.upcoming.filter(u => !u.overdue || u.overdue);
    let n = 0;
    upcoming.forEach(u => {
      try {
        if (window.Backend.db.activity && window.Backend.db.activity.create) {
          window.Backend.db.activity.create({
            id: 'act-rmnd-' + u.invoice + '-' + Date.now() + '-' + n,
            t: 'Retention reminder',
            sub: fmt(u.amount) + ' due from ' + (u.client || u.invoice) + ' on ' + u.dueDate + ' (' + u.kind + ')',
            when: 'now', icon: '🔔', kind: 'reminder',
          });
        }
        if (window.Backend.db.notifications && window.Backend.db.notifications.create) {
          window.Backend.db.notifications.create({
            id: 'notif-rmnd-' + u.invoice + '-' + Date.now() + '-' + n,
            title: 'Retention ' + (u.overdue ? 'OVERDUE' : 'reminder'),
            body: fmt(u.amount) + ' due from ' + (u.client || u.invoice) + ' on ' + u.dueDate,
            kind: 'reminder', read: false,
          });
        }
        n++;
      } catch (e) {}
    });
    if (window.cortexxToast) window.cortexxToast('Reminded all ' + n + ' upcoming release' + (n===1?'':'s'), 'success');
  };

  const navInv = (id) => {
    window.__cortexxRetentionInv = id;
    if (window.cortexxNav) window.cortexxNav('retentioninv');
  };

  const RowCard = ({ children, onClick, accent: accentCol }) => (
    <div onClick={onClick} style={{ marginTop: 8, padding: 12, borderRadius: 10, background: T.bg2, border: '1px solid ' + (accentCol || T.hair), cursor: onClick ? 'pointer' : 'default' }}>{children}</div>
  );

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="Retention ledger" subtitle="All held-back retention across projects"/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>

        {/* Headline totals */}
        <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, '+accent+'22, '+T.bg2+')', border: '1px solid ' + T.hair }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 6 }}>OUTSTANDING RETENTION</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: SFMono, color: T.amber, letterSpacing: -0.5 }}>{fmt(led.totals.outstanding)}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: T.t2 }}>
            <span>Held: <span style={{ fontWeight: 700, color: T.t1 }}>{fmt(led.totals.held)}</span></span>
            <span>Released: <span style={{ fontWeight: 700, color: T.green }}>{fmt(led.totals.released)}</span></span>
            <span>{led.rows.length} invoice{led.rows.length===1?'':'s'}</span>
          </div>
        </div>

        {led.upcoming.length === 0 && led.rows.length === 0 && (
          <div style={{ marginTop: 24, textAlign: 'center', color: T.t2 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🪙</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>No retention held yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Open an invoice and set a retention % to start tracking.</div>
          </div>
        )}

        {/* Upcoming releases */}
        {led.upcoming.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>UPCOMING RELEASES · {led.upcoming.length}</div>
              <button onClick={remindAll}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid '+T.hair, background: accent, color: '#fff', fontFamily: SF, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                🔔 Remind all
              </button>
            </div>
            {led.upcoming.slice(0, 10).map((u, i) => (
              <RowCard key={i} accent={u.overdue ? T.red + '60' : null} onClick={() => navInv(u.invoice)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{u.invoice} · {u.client || '—'}</div>
                    <div style={{ fontSize: 11, color: T.t2, marginTop: 2 }}>{u.kind}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: u.overdue ? T.red : T.t1, fontFamily: SFMono }}>{fmt(u.amount)}</div>
                    <div style={{ fontSize: 11, color: u.overdue ? T.red : T.t2, fontFamily: SFMono, marginTop: 2 }}>
                      {u.overdue ? 'OVERDUE · ' : ''}{u.dueDate}
                    </div>
                  </div>
                </div>
              </RowCard>
            ))}
            {led.upcoming.length > 10 && <div style={{ marginTop: 6, fontSize: 11, color: T.t2, textAlign: 'center' }}>… and {led.upcoming.length - 10} more</div>}
          </>
        )}

        {/* By project */}
        {led.byProject.length > 0 && (
          <>
            <div style={{ marginTop: 22, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>BY PROJECT</div>
            {led.byProject.map(p => (
              <RowCard key={p.projectId || 'unassigned'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{p.projectName || ('Project ' + p.projectId)}</div>
                    <div style={{ fontSize: 11, color: T.t2, marginTop: 2 }}>{p.invoiceCount} invoice{p.invoiceCount===1?'':'s'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, fontFamily: SFMono }}>{fmt(p.totalHeld - p.totalReleased)}</div>
                    <div style={{ fontSize: 10, color: T.t2, fontFamily: SFMono, marginTop: 2 }}>of {fmt(p.totalHeld)}</div>
                  </div>
                </div>
              </RowCard>
            ))}
          </>
        )}

        {/* All retention invoices */}
        {led.rows.length > 0 && (
          <>
            <div style={{ marginTop: 22, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>ALL INVOICES WITH RETENTION</div>
            {led.rows.map(r => (
              <RowCard key={r.id} onClick={() => navInv(r.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{r.id} · {r.client || '—'}</div>
                    <div style={{ fontSize: 11, color: T.t2, marginTop: 2 }}>
                      {(r.retentionPct * 100).toFixed(1)}% of {fmt(r.amount)} ·
                      <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: r.retentionStatus === 'final_released' ? T.green+'30' : r.retentionStatus === 'pc_released' ? T.amber+'30' : T.bg1, color: r.retentionStatus === 'final_released' ? T.green : r.retentionStatus === 'pc_released' ? T.amber : T.t2, fontFamily: SFMono, fontSize: 9, letterSpacing: 0.4 }}>
                        {(r.retentionStatus || 'held').toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, fontFamily: SFMono }}>{fmt(r.retentionOutstanding)}</div>
                  </div>
                </div>
              </RowCard>
            ))}
          </>
        )}
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { RetentionSheet, RetentionLedgerScreen });
