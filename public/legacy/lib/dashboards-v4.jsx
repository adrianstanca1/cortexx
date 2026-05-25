// Cortexx — Dashboard V14: Broadsheet
//
// A hard commit to editorial broadsheet aesthetic: cream paper, charcoal ink,
// serif display masthead, two-column body with column rule, drop cap on the
// lead story, ornamental dividers, classified-ad-style KPI sidebar, weather
// strip. Same live data as every other dashboard — completely different
// world to live in.

(function () {
  // Lazy-load Playfair Display + Spectral + IBM Plex Mono on first paint of v14.
  // Idempotent.
  if (typeof document === 'undefined') return;
  if (!document.getElementById('v14-fonts')) {
    const pre = document.createElement('link'); pre.rel = 'preconnect'; pre.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link'); pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
    const l = document.createElement('link');
    l.id = 'v14-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Spectral:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;700&display=swap';
    document.head.append(pre, pre2, l);
  }
})();

const V14 = {
  paper:     '#f4ecdc',
  paperLo:   '#ede4ce',
  paperHi:   '#faf4e6',
  ink:       '#1a1814',
  ink2:      '#3d3a32',
  ink3:      '#6e6759',
  ink4:      '#a89d83',
  rule:      'rgba(26,24,20,0.18)',
  ruleMid:   'rgba(26,24,20,0.35)',
  ruleStr:   'rgba(26,24,20,0.7)',
  red:       '#8a1c1c',       // ink red for accents (recall classic editorial)
  green:     '#3d5a3d',
  gold:      '#7d6b3a',
};
const DISPLAY = '"Playfair Display", "Times New Roman", Georgia, serif';
const BODY    = 'Spectral, "Iowan Old Style", Georgia, serif';
const DATA    = '"IBM Plex Mono", "SF Mono", ui-monospace, monospace';

function DashV14_Broadsheet({ accent, dashboardId, setDashboardId }) {
  const projects   = useDB('projects');
  const tasks      = useDB('tasks');
  const team       = useDB('team');
  const messages   = useDB('messages');
  const activity   = useDB('activity');
  const receipts   = useDB('receipts');
  const outstanding = useComputed('outstanding');
  const weekMiles   = useComputed('weekMiles');
  const pipeline    = useComputed('pipelineValue');

  const todo = tasks.filter(t => !t.done);
  const onSite = team.filter(t => t.status === 'on-site').length;
  const active = projects.filter(p => p.status === 'active').slice(0, 4);
  const focus = todo.sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.prio] - { high: 0, med: 1, low: 2 }[b.prio]))[0];

  const today = new Date();
  const dateline = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const volNo = `VOL. ${(today.getFullYear() - 2020).toString().padStart(2,'0')} · NO. ${Math.floor((today - new Date(today.getFullYear(),0,0)) / 86400000)}`;

  // The "lead story" — synthesised from real numbers
  const leadHeadline = focus
    ? focus.t.length > 60 ? focus.t.slice(0, 58) + '…' : focus.t
    : 'A quiet day on the books';
  const leadDeck = focus
    ? `${focus.prio === 'high' ? 'High-priority' : focus.prio === 'med' ? 'Routine' : 'Backlog'} item awaits attention · ${onSite} hands on site this morning`
    : `${onSite} hands on site, ${todo.length} items in the queue, business as usual`;

  const setNav = (k, p) => window.cortexxNav && window.cortexxNav(k, p);

  return (
    <div style={{
      background: `
        radial-gradient(at 80% 10%, ${V14.paperHi}, ${V14.paper} 40%, ${V14.paperLo})
      `,
      color: V14.ink, height: '100%', overflowY: 'auto',
      fontFamily: BODY, fontSize: 14, lineHeight: 1.5,
      paddingBottom: 110,
      position: 'relative',
    }}>
      {/* paper grain — subtle SVG noise */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22, pointerEvents: 'none', mixBlendMode: 'multiply' }}>
        <defs>
          <filter id="v14-noise">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" stitchTiles="stitch"/>
            <feColorMatrix values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0   0 0 0 0.5 0"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#v14-noise)"/>
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* MASTHEAD */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{
            borderTop: `4px double ${V14.ink}`,
            borderBottom: `1px solid ${V14.ink}`,
            paddingTop: 4,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontFamily: DATA, fontSize: 9, letterSpacing: 1.4,
              color: V14.ink2,
              paddingBottom: 2,
              textTransform: 'uppercase',
            }}>
              <span>{dateline}</span>
              <span>{volNo}</span>
            </div>
          </div>
          <div style={{
            borderBottom: `2px solid ${V14.ink}`,
            paddingTop: 6, paddingBottom: 2,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <h1 style={{
              fontFamily: DISPLAY, fontWeight: 900,
              fontSize: 52, letterSpacing: -2.5,
              lineHeight: 0.9, margin: 0, color: V14.ink,
            }}>
              The <span style={{ fontStyle: 'italic', fontWeight: 700 }}>Cortexx</span> Daily
            </h1>
          </div>
          {/* tagline + chips */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0 4px',
            borderBottom: `1px solid ${V14.ink}`,
          }}>
            <div style={{
              fontFamily: BODY, fontSize: 11, fontStyle: 'italic', color: V14.ink2,
              letterSpacing: 0.3,
            }}>
              "Built on dirt and detail since 2021"
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setNav('search')} style={chipBtn14()}>{Ic.search} <span>SEARCH</span></button>
              <button onClick={() => setNav('inbox')} style={chipBtn14()}>{Ic.bell} <span>WIRE</span></button>
            </div>
          </div>
        </div>

        {/* WEATHER & CONDITIONS STRIP */}
        <div style={{
          margin: '6px 18px 0',
          padding: '4px 0',
          fontFamily: DATA, fontSize: 9.5,
          letterSpacing: 1.4, color: V14.ink2,
          display: 'flex', justifyContent: 'space-between',
          textTransform: 'uppercase',
        }}>
          <span>CAMDEN · 14°C · LIGHT CLOUD · WIND SW 12MPH</span>
          <span>SUNRISE 04:51 · SUNSET 20:48</span>
        </div>

        {/* TWO-COLUMN BODY */}
        <div style={{
          margin: '14px 18px 0',
          columnCount: 1,
          columnGap: 16,
        }}>
          {/* LEAD STORY */}
          <article style={{ breakInside: 'avoid', marginBottom: 14 }}>
            <div style={{
              fontFamily: DATA, fontSize: 9, letterSpacing: 1.6,
              color: V14.red, fontWeight: 700,
              marginBottom: 4, textTransform: 'uppercase',
            }}>◆ Today's report · lead</div>
            <h2 style={{
              fontFamily: DISPLAY, fontWeight: 900,
              fontSize: 30, letterSpacing: -1, lineHeight: 1.02,
              margin: '0 0 8px', color: V14.ink, textWrap: 'balance',
            }}>{leadHeadline}</h2>
            <div style={{
              fontFamily: BODY, fontStyle: 'italic', fontSize: 14,
              color: V14.ink2, lineHeight: 1.4, marginBottom: 10,
            }}>{leadDeck}</div>

            {/* Drop-cap body */}
            <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.55, color: V14.ink, textAlign: 'justify', hyphens: 'auto' }}>
              <span style={{
                fontFamily: DISPLAY, fontWeight: 900, fontSize: 64,
                float: 'left', lineHeight: 0.85,
                marginRight: 8, marginTop: 4, color: V14.ink,
              }}>{(focus?.t || 'A')[0].toUpperCase()}</span>
              s of dawn, <strong>{onSite}</strong> trades reported on site across the active portfolio.
              The book carries <strong>£{(pipeline / 1000).toFixed(0)}k</strong> of live pipeline against
              <strong> £{(outstanding / 1000).toFixed(0)}k</strong> outstanding on the ledger.
              {focus
                ? <> The desk recommends opening with <em>{focus.t.toLowerCase()}</em>; estimates put the work at less than the hour.</>
                : <> The desk recommends a clear-out morning — backlog grooming over fresh starts.</>}
            </div>

            {focus && (
              <button onClick={() => setNav('tab', 'tasks')} style={leadCTA14()}>
                Take it on →
              </button>
            )}
          </article>

          {/* SECTION DIVIDER */}
          <Dingbat14 label="DESK REPORTS"/>

          {/* PROJECTS — three short stories */}
          {active.slice(0, 3).map((p, i) => (
            <article key={p.id} onClick={() => setNav('project', p)} style={{
              breakInside: 'avoid', marginBottom: 12, cursor: 'pointer',
            }}>
              <div style={{
                fontFamily: DATA, fontSize: 8.5, letterSpacing: 1.4,
                color: V14.ink3, fontWeight: 700,
                textTransform: 'uppercase', marginBottom: 3,
              }}>{p.client?.toUpperCase() || 'PROJECT'} · {p.status?.toUpperCase()}</div>
              <h3 style={{
                fontFamily: DISPLAY, fontWeight: 700, fontSize: 19,
                letterSpacing: -0.4, lineHeight: 1.1,
                margin: '0 0 4px', color: V14.ink,
              }}>{p.name}</h3>
              <div style={{
                fontFamily: BODY, fontSize: 12.5, color: V14.ink2, lineHeight: 1.4,
              }}>
                <span style={{ fontFamily: DATA, fontWeight: 700, color: V14.ink }}>{p.pct ?? 0}%</span>
                {' '}complete · margin <span style={{ fontFamily: DATA, color: (p.margin ?? 0) >= 25 ? V14.green : V14.red }}>{p.margin ?? 0}%</span>
                {p.team ? <> · {p.team} on crew</> : null}
                {p.due ? <> · due {new Date(p.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</> : null}
              </div>
              {/* Progress as a typographic rule */}
              <div style={{ marginTop: 4, position: 'relative', height: 3 }}>
                <div style={{ position: 'absolute', inset: 0, background: V14.rule }}/>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.pct ?? 0}%`, background: V14.ink }}/>
              </div>
            </article>
          ))}

          {/* CLASSIFIEDS — KPIs as boxed ads */}
          <Dingbat14 label="THE LEDGER"/>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 8, marginBottom: 12,
          }}>
            <Classified14 label="Outstanding" value={`£${(outstanding/1000).toFixed(1)}k`} note="across the ledger"/>
            <Classified14 label="Live pipeline" value={`£${(pipeline/1000).toFixed(0)}k`} note={`${active.length} active`}/>
            <Classified14 label="Hands on site" value={onSite} note={`of ${team.length} on roll`}/>
            <Classified14 label="Miles, week" value={`${weekMiles.toFixed(0)} mi`} note={`£${(weekMiles*0.45).toFixed(2)} reimbursable`}/>
          </div>

          {/* LETTERS COLUMN — recent activity */}
          {activity.length > 0 && (
            <>
              <Dingbat14 label="DISPATCHES"/>
              <div style={{ marginBottom: 10 }}>
                {activity.slice(0, 4).map((a, i) => (
                  <div key={i} style={{
                    fontFamily: BODY, fontSize: 12.5, lineHeight: 1.45,
                    color: V14.ink, marginBottom: 5,
                    paddingBottom: 5,
                    borderBottom: i < 3 ? `1px dotted ${V14.rule}` : 'none',
                  }}>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: V14.ink }}>{a.who}</span>
                    {' '}<span style={{ color: V14.ink2 }}>{a.what}</span>
                    {a.where && <> <em style={{ color: V14.ink3 }}>{a.where}</em></>}
                    <span style={{ fontFamily: DATA, color: V14.ink4, fontSize: 9.5, marginLeft: 4 }}>
                      · {new Date(a.when).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* AGENDA — quick links styled as listing page */}
          <Dingbat14 label="THE DESK"/>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            border: `1px solid ${V14.ink}`,
            background: V14.paperHi,
          }}>
            <DeskLink14 label="Tasks" sub={`${todo.length} open`} onClick={() => setNav('tab', 'tasks')}/>
            <DeskLink14 label="Quotes" sub="ledger" onClick={() => setNav('quotes')} rightCol/>
            <DeskLink14 label="Receipts" sub={`${receipts.length} on file`} onClick={() => setNav('tab', 'money')} bottomRow/>
            <DeskLink14 label="Cortex" sub="AI desk" onClick={() => setNav('ai')} rightCol bottomRow/>
          </div>

          {/* COLOPHON */}
          <div style={{
            marginTop: 14, paddingTop: 10,
            borderTop: `4px double ${V14.ink}`,
            textAlign: 'center',
            fontFamily: DATA, fontSize: 9, color: V14.ink3,
            letterSpacing: 1.5, textTransform: 'uppercase',
          }}>
            — Filed from your handset — Cortexx · Print to keep —
          </div>
        </div>
      </div>
    </div>
  );
}

function chipBtn14() {
  return {
    background: 'transparent', border: `1px solid ${V14.ink}`,
    color: V14.ink, padding: '3px 8px', cursor: 'pointer',
    fontFamily: DATA, fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    textTransform: 'uppercase',
  };
}
function leadCTA14() {
  return {
    marginTop: 10, background: V14.ink, color: V14.paper,
    border: 'none', padding: '8px 14px', cursor: 'pointer',
    fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 700,
    fontSize: 14, letterSpacing: -0.2,
    display: 'inline-block',
  };
}

function Dingbat14({ label }) {
  return (
    <div style={{
      breakInside: 'avoid', textAlign: 'center',
      margin: '8px 0 10px',
      display: 'flex', alignItems: 'center', gap: 10,
      color: V14.ink2,
    }}>
      <div style={{ flex: 1, height: 1, background: V14.rule }}/>
      <span style={{ fontFamily: DATA, fontSize: 9, letterSpacing: 2, fontWeight: 700, color: V14.ink3 }}>❦ {label} ❦</span>
      <div style={{ flex: 1, height: 1, background: V14.rule }}/>
    </div>
  );
}

function Classified14({ label, value, note }) {
  return (
    <div style={{
      border: `1.5px solid ${V14.ink}`,
      padding: '8px 10px 10px',
      background: V14.paperHi,
      breakInside: 'avoid',
    }}>
      <div style={{
        fontFamily: DATA, fontSize: 8.5, letterSpacing: 1.4,
        color: V14.ink3, fontWeight: 700, textTransform: 'uppercase',
        borderBottom: `1px solid ${V14.ruleMid}`, paddingBottom: 3, marginBottom: 5,
      }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 22, lineHeight: 1, letterSpacing: -0.5, color: V14.ink }}>{value}</div>
      <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 10.5, color: V14.ink2, marginTop: 4 }}>{note}</div>
    </div>
  );
}

function DeskLink14({ label, sub, onClick, rightCol, bottomRow }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      borderLeft: rightCol ? `1px solid ${V14.ink}` : 'none',
      borderBottom: bottomRow ? 'none' : `1px solid ${V14.ink}`,
      padding: '12px 14px', textAlign: 'left',
      fontFamily: BODY, color: V14.ink,
    }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: -0.3, lineHeight: 1.1 }}>{label}</div>
      <div style={{ fontFamily: DATA, fontSize: 9.5, letterSpacing: 1.2, color: V14.ink3, marginTop: 2, textTransform: 'uppercase' }}>{sub} →</div>
    </button>
  );
}

Object.assign(window, { DashV14_Broadsheet });
