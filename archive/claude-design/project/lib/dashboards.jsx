// Cortexx mobile dashboard — 6 variations
// All consume tokens from window.* (T, SF, SFMono, Ic, etc.)

// ═══════════════════════════════════════════════════════════════════
// V1 — ACTION-FIRST
// "What do I need to do RIGHT NOW" — single hero CTA + priority queue
// ═══════════════════════════════════════════════════════════════════
function DashV1_ActionFirst({ accent = T.blue }) {
  const date = 'Thu, 30 Apr';
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Good morning, Adrian"
          subtitle={date + ' · Camden site, 14°'}
          right={<div style={{ display: 'flex', gap: 8 }}>
            <HeaderBtn icon={Ic.search}/>
            <HeaderBtn icon={Ic.bell} badge accent={accent}/>
          </div>}
        />

        {/* HERO — next thing to do */}
        <div style={{ padding: '4px 16px 12px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}aa 60%, ${T.purple}aa)`,
            borderRadius: 20, padding: 18, position: 'relative', overflow: 'hidden',
            boxShadow: `0 12px 32px ${accent}44`,
          }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, background: 'rgba(255,255,255,0.08)' }}/>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#fff', boxShadow: '0 0 8px #fff' }}/>
                <span style={{ fontFamily: SF, fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>NEXT UP · in 24 min</span>
              </div>
              <div style={{ fontFamily: SF, fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginBottom: 4 }}>Camden Mews — first fix sign-off</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>12 Camden Mews NW1 · Tom + 3 on site</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button style={{ flex: 1, background: '#fff', color: accent, border: 'none', borderRadius: 11, padding: '11px 12px', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {React.cloneElement(Ic.pin, { size: 15 })} Check in
                </button>
                <button style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.35)', borderRadius: 11, padding: '11px 14px', fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Route</button>
              </div>
            </div>
          </div>
        </div>

        {/* PRIORITY QUEUE */}
        <div style={{ padding: '4px 20px 8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Then today</span>
          <span style={{ fontFamily: SF, fontSize: 12, color: T.t3 }}>4 items</span>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { t: '11:30', task: 'Approve Tom\'s timesheet', sub: '42.5h · Wk 17', c: T.amber, i: Ic.clock },
            { t: '13:00', task: 'Lunch with E. Lin (Hackney)', sub: 'Discuss loft scope change', c: T.purple, i: Ic.team },
            { t: '15:00', task: 'Sign RAMS — Camden', sub: 'Expires in 2 days', c: T.red, i: Ic.alert },
            { t: '17:00', task: 'Reconcile 3 receipts', sub: 'Travis Perkins · Selco · B&Q', c: T.cyan, i: Ic.receipt },
          ].map((x, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 12, padding: '12px 14px',
              border: `0.5px solid ${T.hair}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 44, textAlign: 'center' }}>
                <div style={{ fontFamily: SFMono, fontSize: 13, fontWeight: 700, color: T.t1, letterSpacing: -0.3 }}>{x.t}</div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: T.hair }}/>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${x.c}22`, color: x.c, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(x.i, { size: 16 })}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, lineHeight: 1.2 }}>{x.task}</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>{x.sub}</div>
              </div>
              <div style={{ color: T.t3 }}>{Ic.chevR}</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// V2 — STATUS BOARD (live blueprint readout)
// ═══════════════════════════════════════════════════════════════════
function DashV2_StatusBoard({ accent = T.blue }) {
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Site Status"
          subtitle="LIVE · 09:41 BST"
          right={<HeaderBtn icon={Ic.bell} badge accent={accent}/>}
        />

        {/* Blueprint hero — Camden Mews live readout */}
        <div style={{ padding: '4px 16px 12px' }}>
          <div style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden',
            background: T.bg2, border: `0.5px solid ${T.hair}`,
          }}>
            {/* blueprint grid */}
            <svg width="100%" height="160" style={{ display: 'block', background: '#0a1830' }}>
              <defs>
                <pattern id="bp" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke={accent} strokeWidth="0.4" opacity="0.35"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#bp)"/>
              {/* floorplan */}
              <g transform="translate(30,20)" stroke={accent} strokeWidth="1.5" fill="none">
                <rect x="0" y="0" width="180" height="120" opacity="0.7"/>
                <line x1="80" y1="0" x2="80" y2="60" opacity="0.7"/>
                <line x1="80" y1="60" x2="180" y2="60" opacity="0.7"/>
                <line x1="0" y1="80" x2="80" y2="80" opacity="0.7"/>
              </g>
              {/* live dots */}
              <circle cx="80" cy="60" r="4" fill={T.green}><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/></circle>
              <circle cx="80" cy="60" r="10" fill="none" stroke={T.green} strokeWidth="1" opacity="0.4"/>
              <circle cx="160" cy="100" r="4" fill={T.amber}><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin="0.5s"/></circle>
              <circle cx="50" cy="120" r="4" fill={T.green}><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin="1s"/></circle>
              <circle cx="180" cy="40" r="4" fill={T.cyan}><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin="1.5s"/></circle>
            </svg>
            <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${T.hair}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>Camden Mews Refurb</div>
                  <div style={{ fontFamily: SFMono, fontSize: 11, color: T.green }}>● 4 ON SITE · 68% complete</div>
                </div>
                <div style={{ color: T.t3 }}>{Ic.chevR}</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip — telemetry */}
        <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { l: 'Active', v: '3', s: 'sites', c: accent, i: Ic.layers },
            { l: 'On time', v: '94', u: '%', s: 'avg', c: T.green, i: Ic.trend },
            { l: 'Owed', v: '14', u: 'k', s: '£', c: T.amber, i: Ic.receipt },
          ].map((k, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 12, padding: 12,
              border: `0.5px solid ${T.hair}`, position: 'relative',
            }}>
              <div style={{ color: k.c, opacity: 0.7, marginBottom: 4 }}>{React.cloneElement(k.i, { size: 14 })}</div>
              <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</div>
              <div style={{ fontFamily: SFMono, fontSize: 22, fontWeight: 700, color: k.c, marginTop: 2, letterSpacing: -0.5, lineHeight: 1 }}>
                {k.s && <span style={{ fontSize: 13, color: T.t2, marginRight: 1 }}>{k.s}</span>}
                {k.v}
                {k.u && <span style={{ fontSize: 13, color: T.t2 }}>{k.u}</span>}
              </div>
              <div style={{ fontFamily: SF, fontSize: 10, color: T.t3, marginTop: 2 }}>{k.s !== '£' ? k.s : 'this wk'}</div>
            </div>
          ))}
        </div>

        {/* Site list — compact telemetry rows */}
        <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>All sites</span>
          <span style={{ fontFamily: SFMono, fontSize: 11, color: T.green }}>●●●○○ live</span>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { n: 'Camden Mews', loc: 'NW1', team: 4, pct: 68, c: T.green, st: 'ON TRACK' },
            { n: 'Hackney Loft', loc: 'E8', team: 2, pct: 22, c: T.green, st: 'ON TRACK' },
            { n: 'Brixton Shopfront', loc: 'SW9', team: 3, pct: 90, c: T.amber, st: 'SNAGGING' },
          ].map((s, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 10, padding: '10px 12px',
              border: `0.5px solid ${T.hair}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{s.n}</span>
                  <span style={{ fontFamily: SFMono, fontSize: 10, color: T.t3 }}>{s.loc}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Bar pct={s.pct} c={s.c} h={3}/>
                  <span style={{ fontFamily: SFMono, fontSize: 10, color: s.c, fontWeight: 600 }}>{s.pct}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: SFMono, fontSize: 9, color: s.c, fontWeight: 700, letterSpacing: 0.4 }}>● {s.st}</div>
                <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, marginTop: 2 }}>{s.team} on site</div>
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
// V3 — CALM / MINIMAL
// ═══════════════════════════════════════════════════════════════════
function DashV3_Calm({ accent = T.blue }) {
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <div style={{ padding: '8px 24px 4px' }}>
          <div style={{ fontFamily: SF, fontSize: 13, color: T.t3, fontWeight: 500 }}>Thursday, 30 April</div>
        </div>
        <div style={{ padding: '0 24px 28px' }}>
          <div style={{ fontFamily: SF, fontSize: 30, fontWeight: 600, color: T.t1, letterSpacing: -0.8, lineHeight: 1.1 }}>
            Good morning,<br/>Adrian.
          </div>
        </div>

        {/* Single hero stat */}
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2 }}>Today</div>
          <div style={{ fontFamily: SF, fontSize: 44, fontWeight: 600, color: T.t1, marginTop: 6, letterSpacing: -1.2, lineHeight: 1 }}>
            3 things
          </div>
          <div style={{ fontFamily: SF, fontSize: 14, color: T.t2, marginTop: 8, lineHeight: 1.5 }}>
            One site visit, two approvals.<br/>Nothing on fire.
          </div>
        </div>

        {/* Three things */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column' }}>
          {[
            { t: 'Camden Mews — first fix sign-off', d: '10:00 · 24 minutes from now', n: '01' },
            { t: 'Approve Tom\'s timesheet', d: 'Wk 17 · 42.5h', n: '02' },
            { t: 'Sign Camden RAMS', d: 'Expires Saturday', n: '03' },
          ].map((x, i, a) => (
            <div key={i} style={{
              padding: '20px 0',
              borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
              display: 'flex', alignItems: 'flex-start', gap: 16,
            }}>
              <div style={{
                fontFamily: SFMono, fontSize: 11, color: accent, fontWeight: 600,
                marginTop: 2, letterSpacing: 0.3, width: 16, flexShrink: 0,
              }}>{x.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 17, fontWeight: 500, color: T.t1, lineHeight: 1.3, letterSpacing: -0.2 }}>{x.t}</div>
                <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 4 }}>{x.d}</div>
              </div>
              <div style={{ color: T.t3, marginTop: 4 }}>{Ic.chevR}</div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ padding: '32px 24px 0' }}>
          <div style={{ fontFamily: SF, fontSize: 12, color: T.t3, lineHeight: 1.5 }}>
            <span style={{ color: T.t2, fontWeight: 500 }}>Cortex</span> is watching 3 active sites for you. Quiet so far.
          </div>
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// V4 — BENTO GRID
// ═══════════════════════════════════════════════════════════════════
function DashV4_Bento({ accent = T.blue }) {
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Dashboard"
          subtitle="Adrian · CortexBuild Ltd"
          right={<div style={{ display: 'flex', gap: 8 }}>
            <HeaderBtn icon={Ic.bell} badge accent={accent}/>
            <HeaderBtn icon={Ic.search}/>
          </div>}
        />

        <div style={{ padding: '4px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Big — Active site */}
          <div style={{
            gridColumn: '1 / 3',
            background: `linear-gradient(135deg, ${accent}33, ${T.purple}22)`,
            borderRadius: 16, padding: 14,
            border: `0.5px solid ${accent}55`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Pill c={accent} solid size="xs">● ACTIVE NOW</Pill>
                <div style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: T.t1, marginTop: 8, letterSpacing: -0.3 }}>Camden Mews</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>4 on site · 68% done</div>
              </div>
              <div style={{ display: 'flex', marginRight: -8 }}>
                {['Tom Reilly', 'Aisha B', 'Jack M', 'Sara K'].map((n, i) => (
                  <div key={i} style={{ marginLeft: i ? -10 : 0, border: `2px solid ${T.bg0}`, borderRadius: '50%' }}>
                    <Avatar name={n} size={28} c={[T.blue, T.amber, T.green, T.purple][i]}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12 }}><Bar pct={68} c={accent} h={5}/></div>
          </div>

          {/* Cash */}
          <div style={{
            background: T.bg2, borderRadius: 14, padding: 12,
            border: `0.5px solid ${T.hair}`, gridRow: 'span 2',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ color: T.green, marginBottom: 4 }}>{React.cloneElement(Ic.trend, { size: 14 })}</div>
              <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cash</div>
              <div style={{ fontFamily: SFMono, fontSize: 22, color: T.t1, fontWeight: 700, marginTop: 2, letterSpacing: -0.5 }}>£42.1k</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.green, marginTop: 2, fontWeight: 500 }}>+£8.4k wk</div>
            </div>
            <svg width="100%" height="36" viewBox="0 0 100 36" preserveAspectRatio="none">
              <polyline points="0,28 14,24 28,26 42,16 56,20 70,8 84,12 100,4" fill="none" stroke={T.green} strokeWidth="1.6"/>
              <polyline points="0,28 14,24 28,26 42,16 56,20 70,8 84,12 100,4 100,36 0,36" fill={`${T.green}22`} stroke="none"/>
            </svg>
          </div>

          {/* Owed */}
          <div style={{
            background: T.bg2, borderRadius: 14, padding: 12,
            border: `0.5px solid ${T.hair}`,
          }}>
            <div style={{ color: T.amber, marginBottom: 4 }}>{React.cloneElement(Ic.receipt, { size: 14 })}</div>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Owed</div>
            <div style={{ fontFamily: SFMono, fontSize: 18, color: T.amber, fontWeight: 700, marginTop: 2 }}>£14.2k</div>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t3 }}>3 invoices</div>
          </div>

          {/* Hours */}
          <div style={{
            background: T.bg2, borderRadius: 14, padding: 12,
            border: `0.5px solid ${T.hair}`,
          }}>
            <div style={{ color: accent, marginBottom: 4 }}>{React.cloneElement(Ic.clock, { size: 14 })}</div>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hours</div>
            <div style={{ fontFamily: SFMono, fontSize: 18, color: T.t1, fontWeight: 700, marginTop: 2 }}>32.5h</div>
            <div style={{ fontFamily: SF, fontSize: 10, color: T.t3 }}>this week</div>
          </div>

          {/* AI shortcut — wide */}
          <div style={{
            gridColumn: '1 / 3',
            background: `linear-gradient(135deg, ${T.purple}26, ${accent}1a)`,
            borderRadius: 14, padding: '12px 14px',
            border: `0.5px solid ${T.purple}44`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{React.cloneElement(Ic.spark, { size: 18 })}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>Ask Cortex anything</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>"Forecast Camden cashflow"</div>
            </div>
            <div style={{ color: T.t3 }}>{Ic.chevR}</div>
          </div>

          {/* Alerts */}
          <div style={{
            gridColumn: '1 / 3',
            background: T.bg2, borderRadius: 14, padding: '12px 14px',
            border: `0.5px solid ${T.hair}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Needs attention</div>
              <Pill c={T.red} size="xs">3</Pill>
            </div>
            {[
              { t: 'RAMS expires in 2 days', s: 'Camden', c: T.amber, i: Ic.alert },
              { t: '3 receipts to assign', s: 'Auto-scanned', c: T.purple, i: Ic.receipt },
            ].map((x, i, a) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                borderTop: i ? `0.5px solid ${T.hair}` : 'none',
              }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `${x.c}22`, color: x.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(x.i, { size: 13 })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 500 }}>{x.t}</div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t2 }}>{x.s}</div>
                </div>
                <div style={{ color: T.t3 }}>{Ic.chevR}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// V5 — AI-FORWARD (Cortex agent center stage)
// ═══════════════════════════════════════════════════════════════════
function DashV5_AIForward({ accent = T.purple }) {
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader
          title="Cortex"
          subtitle="Your AI site manager"
          right={<HeaderBtn icon={Ic.bell} badge accent={accent}/>}
        />

        {/* Agent card — what Cortex did this morning */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: T.bg2, borderRadius: 18, padding: 16,
            border: `0.5px solid ${T.hair}`, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70,
              background: `radial-gradient(circle, ${accent}55, transparent 70%)`, filter: 'blur(20px)',
            }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, position: 'relative' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `linear-gradient(135deg, ${accent}, ${T.blue})`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 16px ${accent}55`,
              }}>{React.cloneElement(Ic.spark, { size: 20 })}</div>
              <div>
                <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 700, color: T.t1 }}>Morning briefing</div>
                <div style={{ fontFamily: SF, fontSize: 11, color: T.green, fontWeight: 500 }}>● Updated 3 min ago</div>
              </div>
            </div>
            <div style={{ fontFamily: SF, fontSize: 14, color: T.t1, lineHeight: 1.5, position: 'relative' }}>
              You're <strong style={{ color: T.green }}>£8.4k up</strong> this week. Camden is on track for Friday handover.
              I flagged <strong style={{ color: T.amber }}>3 things</strong> needing your decision today.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, position: 'relative' }}>
              {['Show me', 'Read out loud', 'Skip today'].map((s, i) => (
                <button key={i} style={{
                  background: i === 0 ? accent : 'transparent',
                  color: i === 0 ? '#fff' : T.blueL,
                  border: i === 0 ? 'none' : `0.5px solid ${T.hairMid}`,
                  borderRadius: 16, padding: '6px 12px',
                  fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Decisions queue */}
        <div style={{ padding: '0 20px 8px' }}>
          <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>For your decision</div>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              q: 'Approve £1,450 plasterer rebooking?',
              ctx: 'Camden Mews · keeps timeline · margin still 24.5%',
              a: 'Approve', b: 'Hold',
              c: T.green,
            },
            {
              q: 'Send overdue chase to Tonic Café?',
              ctx: 'INV-2039 · £3,890 · 14 days late · Cortex drafted a polite note',
              a: 'Send', b: 'Edit first',
              c: accent,
            },
            {
              q: 'Move Tom from Hackney to Camden tomorrow?',
              ctx: 'Hackney can spare him · Camden needs +1 for plasterboard',
              a: 'Move him', b: 'Ask Tom',
              c: T.cyan,
            },
          ].map((x, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 14, padding: '12px 14px',
              border: `0.5px solid ${T.hair}`,
            }}>
              <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1, lineHeight: 1.3 }}>{x.q}</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 4, lineHeight: 1.4 }}>{x.ctx}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button style={{
                  flex: 1, background: x.c, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 12px',
                  fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>{x.a}</button>
                <button style={{
                  background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`,
                  borderRadius: 8, padding: '8px 14px',
                  fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{x.b}</button>
              </div>
            </div>
          ))}
        </div>

        {/* Ask anything */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            background: T.bg2, borderRadius: 22, padding: '10px 14px',
            border: `0.5px solid ${T.hairMid}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: T.t3 }}>{React.cloneElement(Ic.spark, { size: 16 })}</span>
            <span style={{ flex: 1, fontFamily: SF, fontSize: 14, color: T.t3 }}>Ask Cortex anything…</span>
            <span style={{ color: accent }}>{React.cloneElement(Ic.mic, { size: 16 })}</span>
          </div>
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// V6 — FIELD WORKER (big targets, glove-friendly)
// ═══════════════════════════════════════════════════════════════════
function DashV6_Field({ accent = T.amber }) {
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <div style={{ padding: '8px 20px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, fontWeight: 600, letterSpacing: 0.3 }}>SITE</div>
            <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, letterSpacing: -0.4, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 6 }}>
              Camden Mews {React.cloneElement(Ic.chevDown, { size: 18 })}
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: `${T.green}22`, color: T.green,
            padding: '6px 10px', borderRadius: 14,
            fontFamily: SF, fontSize: 12, fontWeight: 700,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: T.green, boxShadow: `0 0 6px ${T.green}` }}/>
            ON SITE
          </div>
        </div>

        {/* Big primary action */}
        <div style={{ padding: '0 16px 12px' }}>
          <button style={{
            width: '100%', background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
            border: 'none', borderRadius: 18, padding: '20px 18px',
            color: '#0a1830', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: `0 10px 24px ${accent}66`,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(0,0,0,0.18)', color: '#0a1830',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{React.cloneElement(Ic.camera, { size: 28, sw: 2.2 })}</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Capture progress</div>
              <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, opacity: 0.7, marginTop: 2 }}>Photo + voice note</div>
            </div>
          </button>
        </div>

        {/* 2x2 chunky tiles */}
        <div style={{ padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { l: 'Check in', s: 'GPS log hours', c: T.green, i: Ic.pin },
            { l: 'Receipt', s: 'Scan + assign', c: T.purple, i: Ic.receipt },
            { l: 'Voice RFI', s: 'Speak it', c: T.cyan, i: Ic.mic },
            { l: 'Incident', s: 'Report now', c: T.red, i: Ic.alert },
          ].map((x, i) => (
            <button key={i} style={{
              background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 16,
              padding: '16px 14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
              minHeight: 88,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: `${x.c}22`, color: x.c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(x.i, { size: 22, sw: 2 })}</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: T.t1 }}>{x.l}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 1 }}>{x.s}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Today on this site — chunky list */}
        <div style={{ padding: '4px 20px 8px' }}>
          <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Today's jobs · 3 left</div>
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { t: 'Plasterboard ground floor', d: 'Started 08:30', done: false, c: accent },
            { t: 'First-fix electrics — kitchen', d: 'Aisha · in progress', done: false, c: accent },
            { t: 'Skip swap', d: '14:00 today', done: false, c: T.t3 },
          ].map((x, i) => (
            <div key={i} style={{
              background: T.bg2, borderRadius: 14, padding: '14px 14px',
              border: `0.5px solid ${T.hair}`,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                border: `2px solid ${x.c}`, flexShrink: 0,
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: T.t1, lineHeight: 1.2 }}>{x.t}</div>
                <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

Object.assign(window, {
  DashV1_ActionFirst, DashV2_StatusBoard, DashV3_Calm,
  DashV4_Bento, DashV5_AIForward, DashV6_Field,
});
