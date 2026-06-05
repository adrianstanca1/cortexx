// Cortexx mobile dashboard — additional bolder variations (V7-V9)

// ═══════════════════════════════════════════════════════════════════
// V7 — TIMELINE / DAY VIEW (vertical day spine)
// ═══════════════════════════════════════════════════════════════════
function DashV7_Timeline({ accent = T.blue }) {
  const events = [
    { t: '07:30', n: 'Site arrival', d: 'Camden Mews', c: T.green, done: true, i: Ic.pin },
    { t: '08:30', n: 'Toolbox talk', d: '4 attended', c: T.green, done: true, i: Ic.team },
    { t: '10:00', n: 'First-fix sign-off', d: 'walk-through w/ Aisha', c: accent, now: true, i: Ic.check },
    { t: '11:30', n: 'Approve timesheet', d: 'Tom · 42.5h', c: T.amber, i: Ic.clock },
    { t: '13:00', n: 'Lunch · E. Lin', d: 'Hackney scope change', c: T.purple, i: Ic.team },
    { t: '15:00', n: 'Sign Camden RAMS', d: 'expires Sat', c: T.red, i: Ic.alert },
    { t: '17:00', n: 'Reconcile receipts', d: '3 items', c: T.cyan, i: Ic.receipt },
  ];
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Today"
          subtitle="Thu 30 Apr · 7 events · 1 now"
          right={<HeaderBtn icon={Ic.bell} badge accent={accent} onClick={() => window.cortexxNav && window.cortexxNav('inbox')}/>}
        />
        <div style={{ padding: '4px 16px 0', position: 'relative' }}>
          {/* spine */}
          <div style={{ position: 'absolute', left: 65, top: 6, bottom: 6, width: 1.5, background: T.hair }}/>
          {events.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              marginBottom: 12, position: 'relative',
            }}>
              <div style={{ width: 42, paddingTop: 12, textAlign: 'right' }}>
                <div style={{ fontFamily: SFMono, fontSize: 12, fontWeight: 600, color: e.now ? accent : (e.done ? T.t3 : T.t2), letterSpacing: -0.3 }}>{e.t}</div>
              </div>
              <div style={{ position: 'relative', width: 18, paddingTop: 14, flexShrink: 0 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7,
                  background: e.now ? accent : (e.done ? T.green : T.bg2),
                  border: `2px solid ${e.now ? '#fff' : (e.done ? T.green : T.hair)}`,
                  boxShadow: e.now ? `0 0 0 4px ${accent}33, 0 0 12px ${accent}` : 'none',
                  margin: '0 auto', position: 'relative', zIndex: 1,
                }}/>
                {e.now && <div style={{
                  position: 'absolute', top: 14, left: '50%', width: 14, height: 14, borderRadius: 7,
                  background: accent, transform: 'translateX(-50%)', opacity: 0.4,
                  animation: 'pulse 2s infinite',
                }}/>}
              </div>
              <div style={{
                flex: 1, background: e.now ? `linear-gradient(135deg, ${accent}22, ${accent}0a)` : T.bg2,
                border: e.now ? `0.5px solid ${accent}66` : `0.5px solid ${T.hair}`,
                borderRadius: 12, padding: '10px 12px',
                opacity: e.done ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: `${e.c}22`, color: e.c,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{React.cloneElement(e.i, { size: 13 })}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1,
                      textDecoration: e.done ? 'line-through' : 'none',
                      lineHeight: 1.2,
                    }}>{e.n}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{e.d}</div>
                  </div>
                  {e.now && <Pill c={accent} solid size="xs">NOW</Pill>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar accent={accent}/>
      <style>{'@keyframes pulse{0%{transform:translateX(-50%) scale(1);opacity:0.4}100%{transform:translateX(-50%) scale(2.5);opacity:0}}'}</style>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// V8 — FINANCIAL FOCUS (cash-first, money in your face)
// ═══════════════════════════════════════════════════════════════════
function DashV8_Money({ accent = T.green }) {
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Books"
          subtitle="Wk 17 · CIS aware"
          right={<HeaderBtn icon={Ic.bell} badge accent={accent} onClick={() => window.cortexxNav && window.cortexxNav('inbox')}/>}
        />
        {/* Big money number */}
        <div style={{ padding: '8px 20px 16px' }}>
          <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Net cashflow · April</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: SFMono, fontSize: 48, fontWeight: 700, color: T.t1, letterSpacing: -1.5, lineHeight: 1 }}>+£18.2k</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: SF, fontSize: 13, color: T.green, fontWeight: 500 }}>
            {React.cloneElement(Ic.trend, { size: 14 })} <span>+24% vs March</span>
            <span style={{ color: T.t3, marginLeft: 4 }}>· 5 days left</span>
          </div>
          {/* big sparkline */}
          <svg width="100%" height="80" viewBox="0 0 320 80" style={{ marginTop: 14 }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.4"/>
                <stop offset="100%" stopColor={accent} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {[0, 20, 40, 60].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke={T.hair} strokeWidth="0.5"/>)}
            <polyline
              points="0,55 30,50 60,52 90,40 120,45 150,30 180,35 210,22 240,28 270,15 300,18 320,8"
              fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline
              points="0,55 30,50 60,52 90,40 120,45 150,30 180,35 210,22 240,28 270,15 300,18 320,8 320,80 0,80"
              fill="url(#sparkfill)" stroke="none"/>
            <circle cx="320" cy="8" r="4" fill={accent}/>
            <circle cx="320" cy="8" r="8" fill={accent} opacity="0.3"/>
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 4 }}>
            {['Apr 1','7','14','21','28','30'].map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        {/* In/Out split */}
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: `${T.green}1a`, border: `0.5px solid ${T.green}33`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: 0.5 }}>IN</div>
              <span style={{ color: T.green }}>{React.cloneElement(Ic.arrowUp, { size: 14 })}</span>
            </div>
            <div style={{ fontFamily: SFMono, fontSize: 22, fontWeight: 700, color: T.t1, marginTop: 4, letterSpacing: -0.5 }}>£42.6k</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>4 invoices paid</div>
          </div>
          <div style={{ background: `${T.red}1a`, border: `0.5px solid ${T.red}33`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: SF, fontSize: 10, fontWeight: 700, color: T.red, textTransform: 'uppercase', letterSpacing: 0.5 }}>OUT</div>
              <span style={{ color: T.red, transform: 'rotate(180deg)' }}>{React.cloneElement(Ic.arrowUp, { size: 14 })}</span>
            </div>
            <div style={{ fontFamily: SFMono, fontSize: 22, fontWeight: 700, color: T.t1, marginTop: 4, letterSpacing: -0.5 }}>£24.4k</div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>materials + wages</div>
          </div>
        </div>

        {/* Live invoices */}
        <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Outstanding · £14.2k</span>
          <span style={{ fontFamily: SF, fontSize: 12, color: accent, fontWeight: 500 }}>Chase all</span>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { n: 'INV-2042', c: 'Camden Mews', a: '£8,420', d: '3d', col: T.amber },
            { n: 'INV-2039', c: 'Tonic Café', a: '£3,890', d: '14d late', col: T.red },
            { n: 'INV-2041', c: 'Hackney Loft', a: '£1,900', d: '12d', col: T.t1 },
          ].map((iv, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 10, padding: '10px 12px',
              border: `0.5px solid ${T.hair}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: iv.col }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2, fontWeight: 600 }}>{iv.n}</div>
                <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 500, marginTop: 1 }}>{iv.c}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: SFMono, fontSize: 14, color: iv.col, fontWeight: 700 }}>{iv.a}</div>
                <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, marginTop: 1 }}>{iv.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// V9 — STORIES (horizontal swipeable site cards, IG-style)
// ═══════════════════════════════════════════════════════════════════
function DashV9_Stories({ accent = T.purple }) {
  const stories = [
    { n: 'Camden', sub: '68%', c: accent, ring: true },
    { n: 'Hackney', sub: '22%', c: T.blue },
    { n: 'Brixton', sub: '90%', c: T.amber, ring: true },
    { n: 'Islington', sub: 'quote', c: T.cyan },
    { n: 'New', sub: '+', c: T.t3, plus: true },
  ];
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Sites"
          subtitle="Swipe through · 5 active"
          right={<HeaderBtn icon={Ic.bell} badge accent={accent} onClick={() => window.cortexxNav && window.cortexxNav('inbox')}/>}
        />
        {/* Story strip */}
        <div style={{
          padding: '4px 16px 16px', display: 'flex', gap: 14,
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {stories.map((s, i) => (
            <div key={i} style={{ flexShrink: 0, textAlign: 'center', width: 64 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 30,
                padding: 2.5,
                background: s.ring ? `conic-gradient(from 0deg, ${s.c}, ${T.purple}, ${s.c})` : (s.plus ? 'transparent' : T.hair),
                border: s.plus ? `1.5px dashed ${T.t3}` : 'none',
                boxSizing: 'border-box',
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: s.plus ? 'transparent' : `linear-gradient(135deg, ${s.c}, ${s.c}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: SF, fontSize: s.plus ? 24 : 16, fontWeight: 700, color: s.plus ? T.t3 : '#fff',
                }}>{s.plus ? '+' : s.n[0]}</div>
              </div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t1, fontWeight: 500, marginTop: 5 }}>{s.n}</div>
              <div style={{ fontFamily: SFMono, fontSize: 9, color: T.t3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Featured site card */}
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{
            background: `linear-gradient(160deg, ${accent}33, ${T.bg2} 60%)`,
            borderRadius: 18, padding: 16,
            border: `0.5px solid ${accent}44`, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Pill c={accent} solid size="xs">FEATURED</Pill>
                <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 700, color: T.t1, marginTop: 8, letterSpacing: -0.4 }}>Camden Mews Refurb</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>J. Patterson · NW1</div>
              </div>
              <div style={{ fontFamily: SFMono, fontSize: 28, fontWeight: 700, color: accent, letterSpacing: -1 }}>68<span style={{ fontSize: 16, color: T.t2 }}>%</span></div>
            </div>
            {/* progress chunks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginTop: 14 }}>
              {[1,1,1,0.5,0].map((p, i) => (
                <div key={i} style={{
                  height: 4, borderRadius: 2,
                  background: p === 0 ? T.hair : T.green,
                  opacity: p === 0.5 ? 0.5 : 1,
                }}/>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SFMono, fontSize: 9, color: T.t3, marginTop: 6 }}>
              {['Strip','1st fix','Plaster','2nd fix','Snag'].map(s => <span key={s}>{s}</span>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `0.5px solid ${T.hair}` }}>
              <div style={{ display: 'flex' }}>
                {['Tom Reilly','Aisha B','Jack M','Sara K'].map((n, i) => (
                  <div key={i} style={{ marginLeft: i ? -8 : 0, border: `2px solid ${T.bg0}`, borderRadius: '50%' }}>
                    <Avatar name={n} size={26} c={[T.blue, T.amber, T.green, T.purple][i]}/>
                  </div>
                ))}
              </div>
              <span style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>4 on site now</span>
              <div style={{ flex: 1 }}/>
              <button onClick={() => window.cortexxNav && window.cortexxNav('capture')} style={{
                background: '#fff', color: T.bg0, border: 'none',
                borderRadius: 10, padding: '7px 14px',
                fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>Open</button>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ padding: '0 20px 8px' }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Activity feed</span>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { who: 'Tom Reilly', act: 'uploaded 4 photos', loc: 'Camden Mews', t: '12 min', c: T.blue, i: Ic.camera },
            { who: 'Cortex AI', act: 'flagged margin slip on Brixton', loc: '−1.2% vs quote', t: '1 hr', c: T.purple, i: Ic.spark },
            { who: 'Aisha Begum', act: 'completed first-fix electrics', loc: 'Camden · kitchen', t: '2 hr', c: T.amber, i: Ic.check },
          ].map((a, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 12, padding: '10px 12px',
              border: `0.5px solid ${T.hair}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Avatar name={a.who} size={32} c={a.c}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 600 }}>{a.who}</span> <span style={{ color: T.t2 }}>{a.act}</span>
                </div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, marginTop: 1 }}>{a.loc} · {a.t} ago</div>
              </div>
              <div style={{ color: a.c, opacity: 0.7 }}>{React.cloneElement(a.i, { size: 14 })}</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

Object.assign(window, { DashV7_Timeline, DashV8_Money, DashV9_Stories });
