// Cortexx — Phases 51-70 batched: operations/finance/people/compliance

(function() {
  if (!window.Backend) return;
  const s = Backend.db.snapshot();

  // P51 pour scheduler · P52 snag vision (via AI) · P53 drawing diff · P54 bid library
  // P55-60 finance · P61-64 people · P65-70 compliance

  // P55: bank accounts — initialise empty arrays for real data
  if (!s.bankAccounts) {
    s.bankAccounts = [];
    s.payroll = [];
    s.holidays = [];
    s.apprentices = [];
    s.carbon = [];
    s.waste = [];
    s.claims = [];
    try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {}
  }
  const mk = (n) => ({
    listSync: () => [...Backend.db.snapshot()[n]],
    list: async () => [...Backend.db.snapshot()[n]],
    getSync: (id) => Backend.db.snapshot()[n].find(x => x.id == id),
    get: async (id) => Backend.db.snapshot()[n].find(x => x.id == id),
    create: async (d) => { const s = Backend.db.snapshot(); const ids = s[n].map(x => typeof x.id === 'number' ? x.id : 0); s[n] = [{...d, id: Math.max(0, ...ids) + 1}, ...s[n]]; try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {} Backend.db.user.update({}); },
    update: async (id, p) => { const s = Backend.db.snapshot(); s[n] = s[n].map(x => x.id == id ? {...x, ...p} : x); try { localStorage.setItem('cortexx_db_v1', JSON.stringify(s)); } catch (e) {} Backend.db.user.update({}); },
    remove: async () => {},
  });
  ['bankAccounts', 'payroll', 'holidays', 'apprentices', 'carbon', 'waste', 'claims'].forEach(n => { Backend.db[n] = mk(n); });
})();

// P55: Bank accounts
function BankScreen({ accent }) {
  const accounts = useDB('bankAccounts');
  const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const connectBank = () => { window.location.href = '/api/banking/connect'; };
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Banking" subtitle={`${accounts.length} accounts · £${total.toLocaleString()} total`}
      right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={connectBank}/>}/>
    {accounts.length === 0 ? (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: SF, fontSize: 15, color: T.t2, marginBottom: 20 }}>
          Connect your business bank account via TrueLayer Open Banking to automatically import transactions.
        </div>
        <button onClick={connectBank} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 24px', fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Connect Bank Account
        </button>
        <div style={{ marginTop: 16, fontFamily: SF, fontSize: 13, color: T.t3 }}>
          Or <span style={{ color: accent, cursor: 'pointer' }} onClick={() => toast('Manual upload coming soon', 'info')}>upload statements manually</span>
        </div>
      </div>
    ) : (
      <>
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{ background: `linear-gradient(135deg, ${T.green}22, ${accent}11)`, border: `0.5px solid ${T.green}44`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total balance</div>
            <div style={{ fontFamily: SFMono, fontSize: 32, fontWeight: 700, color: T.t1, marginTop: 4, letterSpacing: -0.8 }}>£{total.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accounts.map(a => (
            <div key={a.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{a.name}</div>
                  <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2, marginTop: 2 }}>{a.provider} ····{a.last4}</div>
                </div>
                <div style={{ fontFamily: SFMono, fontSize: 18, color: (a.balance || 0) > 5000 ? T.green : T.amber, fontWeight: 700 }}>£{(a.balance || 0).toLocaleString()}</div>
              </div>
              <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 6 }}>{a.txCount || 0} transactions this month</div>
            </div>
          ))}
        </div>
      </>
    )}
  </div></ScreenBg>;
}

// P61: Payroll
function PayrollScreen({ accent }) {
  const periods = useDB('payroll');
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Payroll" subtitle="UK CIS-aware"/>
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {periods.map(p => (
        <div key={p.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <Pill c={p.status === 'submitted' ? T.green : T.amber}>{p.status}</Pill>
              <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1, marginTop: 6 }}>{p.period}</div>
            </div>
            <div style={{ fontFamily: SFMono, fontSize: 18, color: T.t1, fontWeight: 700 }}>£{p.gross.toLocaleString()}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.hair}` }}>
            <div><div style={{ fontFamily: SFMono, fontSize: 12, color: T.green, fontWeight: 600 }}>£{p.netPaid.toLocaleString()}</div><div style={{ fontFamily: SF, fontSize: 9, color: T.t2 }}>Net paid</div></div>
            <div><div style={{ fontFamily: SFMono, fontSize: 12, color: T.purple, fontWeight: 600 }}>£{p.cisDeducted.toLocaleString()}</div><div style={{ fontFamily: SF, fontSize: 9, color: T.t2 }}>CIS deducted</div></div>
            <div><div style={{ fontFamily: SFMono, fontSize: 12, color: T.amber, fontWeight: 600 }}>£{p.tax.toLocaleString()}</div><div style={{ fontFamily: SF, fontSize: 9, color: T.t2 }}>Tax</div></div>
          </div>
        </div>
      ))}
    </div>
  </div></ScreenBg>;
}

// P62: Holiday
function HolidayScreen({ accent }) {
  const holidays = useDB('holidays');
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Leave & holidays" subtitle={`${holidays.filter(h=>h.status==='pending').length} pending approval`}
      right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('addholiday')}/>}/>
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {holidays.map(h => (
        <div key={h.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={h.name} size={40}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{h.name}</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{h.start} → {h.end} · {h.days} days</div>
          </div>
          <Pill c={h.status === 'approved' ? T.green : T.amber}>{h.status}</Pill>
        </div>
      ))}
    </div>
  </div></ScreenBg>;
}

// P63: Apprentice progression
function ApprenticeScreen({ accent }) {
  const apps = useDB('apprentices');
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Apprentices" subtitle={`${apps.length} on programme`}/>
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {apps.map(a => (
        <div key={a.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={a.name} size={44} c={T.purple}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{a.name}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{a.course} · Year {a.year}</div>
            </div>
            <div style={{ fontFamily: SFMono, fontSize: 18, color: T.green, fontWeight: 700 }}>{a.progress}%</div>
          </div>
          <div style={{ marginTop: 10 }}><Bar pct={a.progress} c={T.green} h={4}/></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: SFMono, fontSize: 10, color: T.t3 }}>
            <span>{a.hours} / {a.target} hrs</span>
            <span>Next review {a.nextReview}</span>
          </div>
        </div>
      ))}
    </div>
  </div></ScreenBg>;
}

// P67: Carbon footprint
function CarbonScreen({ accent }) {
  const data = useDB('carbon');
  const total = data.reduce((s, c) => s + c.total, 0);
  const projects = useDB('projects');
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Carbon footprint" subtitle={`${total.toFixed(1)} tCO₂e Q2 2026`}/>
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(c => {
        const p = projects.find(pr => pr.id === c.projectId);
        return (
          <div key={c.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{p?.name}</div>
              <div style={{ fontFamily: SFMono, fontSize: 18, color: T.green, fontWeight: 700 }}>{c.total.toFixed(1)} tCO₂e</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
              <div><div style={{ fontFamily: SFMono, fontSize: 13, color: T.red }}>{c.scope1}</div><div style={{ fontFamily: SF, fontSize: 9, color: T.t2 }}>Scope 1 (direct)</div></div>
              <div><div style={{ fontFamily: SFMono, fontSize: 13, color: T.amber }}>{c.scope2}</div><div style={{ fontFamily: SF, fontSize: 9, color: T.t2 }}>Scope 2 (energy)</div></div>
              <div><div style={{ fontFamily: SFMono, fontSize: 13, color: T.cyan }}>{c.scope3}</div><div style={{ fontFamily: SF, fontSize: 9, color: T.t2 }}>Scope 3 (supply)</div></div>
            </div>
          </div>
        );
      })}
    </div>
  </div></ScreenBg>;
}

// P68: Waste tracking
function WasteScreen({ accent }) {
  const items = useDB('waste');
  const total = items.reduce((s, w) => s + w.tonnes, 0);
  const avgRecycled = items.length ? items.reduce((s, w) => s + w.recycled, 0) / items.length : 0;
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Waste" subtitle={`${total.toFixed(1)}t · ${avgRecycled.toFixed(0)}% recycled`}/>
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(w => (
        <div key={w.id} style={{ background: T.bg2, borderRadius: 12, padding: 12, border: `0.5px solid ${T.hair}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{w.kind}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{w.carrier} · {w.when}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: SFMono, fontSize: 14, color: T.t1, fontWeight: 700 }}>{w.tonnes}t</div>
              <div style={{ fontFamily: SFMono, fontSize: 10, color: T.green }}>{w.recycled}% recycled</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div></ScreenBg>;
}

// P70: Insurance claims
function ClaimsScreen({ accent }) {
  const claims = useDB('claims');
  const projects = useDB('projects');
  return <ScreenBg accent={accent}><div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
    <MobileHeader title="Insurance claims" subtitle={`${claims.filter(c=>c.status!=='closed').length} active`}
      right={<HeaderBtn icon={Ic.plus} accent={accent} onClick={() => window.cortexxNav('addclaim')}/>}/>
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {claims.map(c => {
        const p = projects.find(pr => pr.id === c.projectId);
        return (
          <div key={c.id} style={{ background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Pill c={c.status === 'closed' ? T.green : T.amber}>{c.status}</Pill>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, marginTop: 6 }}>{c.kind} · {c.id}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{p?.name} · {c.insurer} · {c.when}</div>
              </div>
              <div style={{ fontFamily: SFMono, fontSize: 16, color: T.t1, fontWeight: 700 }}>£{c.amount.toLocaleString()}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div></ScreenBg>;
}

Object.assign(window, { BankScreen, PayrollScreen, HolidayScreen, ApprenticeScreen, CarbonScreen, WasteScreen, ClaimsScreen });
