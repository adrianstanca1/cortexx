// Cortexx — Phases 41-50 (batched): intelligence + ops depth

// ═══════════════════════════════════════════════════════════════════
// P41: Vera scheduled cron
// ═══════════════════════════════════════════════════════════════════
(function() {
  if (!window.Backend?.vera) return;
  let cronTimer = null;
  Backend.vera.startCron = (intervalMs = 300000) => {
    if (cronTimer) clearInterval(cronTimer);
    cronTimer = setInterval(async () => {
      const hour = new Date().getHours();
      if (hour === 6) await Backend.vera.briefing();
      if (hour === 9 || hour === 14) await Backend.vera.autoHealthCheck();
      if (hour === 16) await Backend.vera.autoChaseOverdue();
    }, intervalMs);
  };
  Backend.vera.stopCron = () => { if (cronTimer) clearInterval(cronTimer); cronTimer = null; };
})();

// ═══════════════════════════════════════════════════════════════════
// P42: Multi-agent personas
// ═══════════════════════════════════════════════════════════════════
(function() {
  if (!window.Backend) return;
  Backend.personas = {
    vera:    { name: 'Vera Stone',    role: 'CEO',                style: 'decisive, strategic, big picture', initials: 'VS', c: '#8b5cf6' },
    marcus:  { name: 'Marcus Pound',  role: 'CFO',                style: 'numbers-first, cautious, UK CIS expert', initials: 'MP', c: '#10b981' },
    pip:     { name: 'Pip Carter',    role: 'Site Manager',       style: 'practical, blunt, safety-aware', initials: 'PC', c: '#f59e0b' },
    ada:     { name: 'Ada Whitfield', role: 'Compliance Officer', style: 'meticulous, regulation-quoting', initials: 'AW', c: '#ef4444' },
    river:   { name: 'River Ng',      role: 'Sales Director',     style: 'warm, persuasive, customer-led', initials: 'RN', c: '#06b6d4' },
  };
  Backend.askPersona = async (key, question) => {
    const p = Backend.personas[key]; if (!p) return null;
    const b = Backend.brain.snapshot();
    const prompt = `You are ${p.name}, ${p.role} at ${b.company.name}. Style: ${p.style}. Live state: ${JSON.stringify(b)}. User asks: "${question}". Respond in your voice — 2-4 sentences max. UK English.`;
    return Backend.ai.ask('', { system: prompt, skipHistory: true });
  };
})();

// ═══════════════════════════════════════════════════════════════════
// P43: Predictive cashflow (P44 alias)
// ═══════════════════════════════════════════════════════════════════
Backend.ai.forecastCash = async (weeks = 8) => {
  const b = Backend.brain.snapshot();
  const prompt = `Forecast UK construction SMB 8-week cashflow. State: cash £${b.money.cash}, outstanding £${b.money.outstanding}, pipeline £${b.money.pipeline}. Reply ONLY JSON: [{"week":"Wk N","balance":NNNNN,"confidence":"high|med|low"}] for ${weeks} weeks ahead.`;
  try {
    const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
    return JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0]) || [];
  } catch (e) { return []; }
};

// ═══════════════════════════════════════════════════════════════════
// P45: Bid/no-bid scoring
// ═══════════════════════════════════════════════════════════════════
Backend.ai.bidScore = async (brief) => {
  const b = Backend.brain.snapshot();
  const prompt = `You are a UK construction estimator. Given a tender brief and our state, output ONLY JSON {"recommendation":"BID|NO BID","winProbability":0-100,"suggestedPrice":NNNNN,"reasoning":"1 sentence"}. State: ${b.projects.active} active, avg margin ${b.money.avgMargin}%. Brief: ${brief}.`;
  try {
    const raw = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]);
  } catch (e) { return null; }
};

// ═══════════════════════════════════════════════════════════════════
// P46: Sub performance scoring
// ═══════════════════════════════════════════════════════════════════
Backend.computed.subScore = (subId) => {
  const sub = Backend.db.snapshot().subs.find(s => s.id == subId);
  if (!sub) return 0;
  let score = 50;
  if (sub.insured) score += 15;
  if (sub.cscs) score += 15;
  score += Math.min(sub.rating * 4, 20);
  return Math.min(score, 100);
};

// ═══════════════════════════════════════════════════════════════════
// P47: Customer LTV
// ═══════════════════════════════════════════════════════════════════
Backend.computed.customerLTV = (customerId) => {
  const c = Backend.db.snapshot().customers.find(c => c.id == customerId);
  return c ? c.totalValue : 0;
};

// ═══════════════════════════════════════════════════════════════════
// P49: Geofencing
// ═══════════════════════════════════════════════════════════════════
(function() {
  let watchId = null;
  window.cortexxGeofence = {
    sites: [
      { name: 'Camden Mews',  lat: 51.541, lng: -0.143, r: 100 },
      { name: 'Hackney Loft', lat: 51.546, lng: -0.057, r: 100 },
      { name: 'Brixton',      lat: 51.462, lng: -0.114, r: 100 },
    ],
    start() {
      if (!navigator.geolocation || watchId) return;
      watchId = navigator.geolocation.watchPosition(pos => {
        const { latitude, longitude } = pos.coords;
        for (const s of this.sites) {
          const dist = Math.sqrt((latitude - s.lat) ** 2 + (longitude - s.lng) ** 2) * 111000;
          if (dist <= s.r && window.cortexxToast) {
            window.cortexxToast(`Geofence: arrived at ${s.name}`, 'success');
          }
        }
      }, () => {}, { enableHighAccuracy: true });
    },
    stop() { if (watchId) navigator.geolocation.clearWatch(watchId); watchId = null; },
  };
})();

// ═══════════════════════════════════════════════════════════════════
// Persona consultation screen
// ═══════════════════════════════════════════════════════════════════
function PersonasScreen({ accent }) {
  const [active, setActive] = React.useState('vera');
  const [q, setQ] = React.useState('');
  const [a, setA] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true);
    const result = await Backend.askPersona(active, q);
    setA(result);
    setLoading(false);
  };
  const personas = Backend.personas;
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Leadership team" subtitle="5 AI personas · always available"/>
        <div style={{ padding: '4px 16px 14px', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {Object.entries(personas).map(([k, p]) => (
            <button key={k} onClick={() => { setActive(k); setA(null); }} style={{
              background: active === k ? `${p.c}33` : T.bg2,
              border: `0.5px solid ${active === k ? p.c : T.hair}`,
              borderRadius: 14, padding: '10px 12px', cursor: 'pointer', flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 78,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: p.c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 12, fontWeight: 700 }}>{p.initials}</div>
              <div style={{ fontFamily: SF, fontSize: 10, color: T.t1, fontWeight: 600 }}>{p.name.split(' ')[0]}</div>
              <div style={{ fontFamily: SF, fontSize: 9, color: T.t3 }}>{p.role}</div>
            </button>
          ))}
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: personas[active].c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{personas[active].role}</div>
            <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: T.t1, marginTop: 4 }}>{personas[active].name}</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 4 }}>{personas[active].style}</div>
          </div>
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Ask ${personas[active].name.split(' ')[0]} anything…`}
            onKeyDown={e => { if (e.key === 'Enter') ask(); }}
            style={{ width: '100%', boxSizing: 'border-box', background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '12px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none' }}/>
          <button onClick={ask} disabled={loading || !q.trim()} style={{
            width: '100%', marginTop: 8, background: personas[active].c, color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            opacity: loading || !q.trim() ? 0.5 : 1,
          }}>{loading ? 'Thinking…' : `Ask ${personas[active].name.split(' ')[0]}`}</button>
        </div>
        {a && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ background: `${personas[active].c}11`, border: `0.5px solid ${personas[active].c}33`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: personas[active].c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontSize: 10, fontWeight: 700 }}>{personas[active].initials}</div>
                <span style={{ fontFamily: SF, fontSize: 12, color: personas[active].c, fontWeight: 700 }}>{personas[active].name}</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.6 }}>{a}</div>
            </div>
          </div>
        )}
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { PersonasScreen });
