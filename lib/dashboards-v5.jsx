// Cortexx — Dashboard V15: Site Notice
//
// Brutalist construction-yard aesthetic. Hi-vis yellow on charcoal. No
// rounded corners, no shadows, no transparency. Oversized condensed-grotesk
// type, hard rectangles, stencil-style labels. The kind of plaque nailed to
// site hoarding. Same live data as every other dashboard.

(function () {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('v15-fonts')) {
    const pre = document.createElement('link'); pre.rel = 'preconnect'; pre.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link'); pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
    const l = document.createElement('link');
    l.id = 'v15-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter+Tight:wght@400;600;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap';
    document.head.append(pre, pre2, l);
  }
})();

const V15 = {
  bg: '#0e0e10',          // charcoal
  bg2: '#1a1a1e',
  hi: '#ffd60a',          // hi-vis yellow
  hi2: '#fbe34a',
  hiDk: '#a98700',        // dark amber for diagonal hazard
  fg: '#fafafa',
  mute: '#9b9b9f',
  ink: '#0a0a0c',
  green: '#33d17a',
  red: '#ff3b30',
  rule: 'rgba(255,255,255,0.12)',
};
const TITLE = '"Archivo Black", "Anton", Impact, sans-serif';
const SANS  = '"Inter Tight", -apple-system, system-ui, sans-serif';
const MONO  = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// Diagonal hazard stripes CSS (yellow/black 45°)
const HAZARD = `repeating-linear-gradient(45deg, ${V15.hi} 0 14px, ${V15.ink} 14px 28px)`;

function DashV15_SiteNotice({ accent, dashboardId, setDashboardId }) {
  const projects = useDB('projects');
  const tasks    = useDB('tasks');
  const team     = useDB('team');
  const activity = useDB('activity');
  const incidents = useDB('incidents') || [];
  const outstanding = useComputed('outstanding');
  const pipeline    = useComputed('pipelineValue');

  const todo = tasks.filter(t => !t.done);
  const high = todo.filter(t => t.prio === 'high');
  const onSite = team.filter(t => t.status === 'on-site').length;
  const active = projects.filter(p => p.status === 'active');
  const focus = todo.sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.prio] - { high: 0, med: 1, low: 2 }[b.prio]))[0];

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dayNo = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);

  const setNav = (k, p) => window.cortexxNav && window.cortexxNav(k, p);

  return (
    <div style={{
      background: V15.bg, color: V15.fg, height: '100%', overflowY: 'auto',
      fontFamily: SANS, paddingBottom: 150,
    }}>
      {/* HAZARD STRIP — top */}
      <div style={{ height: 14, background: HAZARD }}/>

      {/* SITE NOTICE PLAQUE */}
      <div style={{ background: V15.hi, color: V15.ink, padding: '14px 16px 16px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 6,
          fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
        }}>
          <span>FORM 01 / DAILY SITE NOTICE</span>
          <span>{dateStr} · DAY {dayNo}</span>
        </div>
        <h1 style={{
          fontFamily: TITLE, fontWeight: 900, color: V15.ink,
          fontSize: 64, lineHeight: 0.86, letterSpacing: -3.5,
          margin: 0, textTransform: 'uppercase',
        }}>Site<br/>Notice</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 10, paddingTop: 8,
          borderTop: `2px solid ${V15.ink}`,
          fontFamily: MONO, fontSize: 11, fontWeight: 700,
        }}>
          <span style={{ background: V15.ink, color: V15.hi, padding: '2px 7px', letterSpacing: 1 }}>POSTED</span>
          <span>{timeStr}</span>
          <span style={{ flex: 1 }}/>
          <button onClick={() => setNav('switchworkspace')} title="Switch workspace" style={{
            background: V15.ink, color: V15.hi, border: 'none', cursor: 'pointer',
            fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase',
          }}>
            {(window.CortexTenant ? window.CortexTenant.activeRecord().name : 'CortexBuild Pro').slice(0, 14)} ▾
          </button>
          <span style={{ flex: 1 }}/>
          <span>{onSite}/{team.length} ON SITE</span>
        </div>
      </div>

      {/* SECTION 01 — ACTION REQUIRED */}
      <SectionLabel15 num="01" label="Action Required" extra={`${high.length} ITEM${high.length === 1 ? '' : 'S'}`}/>
      {focus ? (
        <button onClick={() => setNav('tab', 'tasks')} style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: focus.prio === 'high' ? V15.red : V15.bg2,
          border: 'none', borderBottom: `1px solid ${V15.rule}`,
          color: V15.fg, padding: '14px 16px',
          cursor: 'pointer', fontFamily: SANS,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              background: focus.prio === 'high' ? V15.fg : V15.hi,
              color: focus.prio === 'high' ? V15.red : V15.ink,
              padding: '2px 6px', fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2,
            }}>{(focus.prio || 'MED').toUpperCase()}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: V15.mute, letterSpacing: 1 }}>
              {focus.due ? `DUE ${new Date(focus.due).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }).toUpperCase()}` : 'UNDATED'}
            </span>
          </div>
          <div style={{
            fontFamily: TITLE, fontSize: 26, lineHeight: 1.0,
            letterSpacing: -1, textTransform: 'uppercase',
            color: focus.prio === 'high' ? V15.fg : V15.hi,
          }}>{focus.t}</div>
          <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, color: focus.prio === 'high' ? V15.fg : V15.fg }}>
            TAKE ACTION ▸
          </div>
        </button>
      ) : (
        <div style={{ padding: '20px 16px', fontFamily: MONO, fontSize: 12, color: V15.mute }}>NO ACTION ITEMS — BACKLOG CLEAR</div>
      )}

      {/* SECTION 02 — MEN ON ROLL */}
      <SectionLabel15 num="02" label="Hands on Site"/>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: V15.bg2, borderBottom: `1px solid ${V15.rule}`,
      }}>
        <StatBlock15 big={`${onSite}`} label="ON SITE NOW" sub={`OF ${team.length} ON ROLL`} accent={V15.green}/>
        <StatBlock15 big={`${active.length}`} label="ACTIVE PROJECTS" sub="PORTFOLIO" accent={V15.hi}/>
      </div>

      {/* SECTION 03 — MONEY (numerical, no decoration) */}
      <SectionLabel15 num="03" label="The Ledger"/>
      <div style={{ borderBottom: `1px solid ${V15.rule}`, background: V15.bg2 }}>
        <Bar15
          label="LIVE PIPELINE"
          value={`£${(pipeline / 1000).toFixed(0)}K`}
          fill={1}
          color={V15.hi}
          rightLabel={`${active.length} ACTIVE`}
          onClick={() => setNav('quotes')}
        />
        <Bar15
          label="OUTSTANDING"
          value={`£${(outstanding / 1000).toFixed(1)}K`}
          fill={Math.min(1, outstanding / Math.max(pipeline, 1))}
          color={V15.red}
          rightLabel="ON LEDGER"
          onClick={() => setNav('tab', 'money')}
        />
      </div>

      {/* SECTION 04 — TODAY'S JOBS */}
      <SectionLabel15 num="04" label="Today's Jobs" extra={`${active.length}`}/>
      {active.slice(0, 4).map((p, i) => (
        <button key={p.id} onClick={() => setNav('project', p)} style={{
          display: 'flex', alignItems: 'stretch', gap: 0,
          width: '100%', textAlign: 'left',
          background: i % 2 === 0 ? V15.bg2 : V15.bg, color: V15.fg,
          border: 'none', borderBottom: `1px solid ${V15.rule}`,
          cursor: 'pointer', padding: 0,
        }}>
          {/* Index number */}
          <div style={{
            width: 56, background: V15.hi, color: V15.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: TITLE, fontSize: 30, letterSpacing: -1,
          }}>{(i + 1).toString().padStart(2, '0')}</div>
          {/* Body */}
          <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
            <div style={{
              fontFamily: TITLE, fontSize: 18, lineHeight: 1.1,
              letterSpacing: -0.5, textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{p.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: 1, color: V15.mute, marginTop: 4 }}>
              <span style={{ color: V15.hi }}>{p.pct ?? 0}%</span>
              <span style={{ margin: '0 6px' }}>·</span>
              MARGIN {p.margin ?? 0}%
              <span style={{ margin: '0 6px' }}>·</span>
              {p.team || 0} CREW
            </div>
          </div>
          {/* Status block */}
          <div style={{
            width: 14,
            background: (p.margin ?? 0) >= 25 ? V15.green : (p.margin ?? 0) >= 15 ? V15.hi : V15.red,
          }}/>
        </button>
      ))}

      {/* SECTION 05 — DISPATCHES */}
      <SectionLabel15 num="05" label="Wire" extra={`${activity.length}`}/>
      <div style={{ padding: '10px 16px 16px' }}>
        {activity.slice(0, 4).map((a, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, padding: '7px 0',
            borderBottom: i < 3 ? `1px solid ${V15.rule}` : 'none',
            fontFamily: MONO, fontSize: 11, color: V15.fg, letterSpacing: 0.3,
          }}>
            <span style={{ color: V15.hi, minWidth: 38, fontWeight: 700 }}>
              {new Date(a.when).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700 }}>{(a.who || a.t || '').toUpperCase()}</span>{' '}
              <span style={{ color: V15.mute }}>{a.what || a.sub || ''}</span>
              {(a.where || a.location) && <span style={{ color: V15.fg }}> · {(a.where || a.location).toUpperCase()}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* SECTION 06 — INCIDENTS (only when present) */}
      {incidents.length > 0 && (
        <>
          <SectionLabel15 num="06" label="Safety log" extra={`${incidents.length}`} alert/>
          <div style={{ padding: '0 16px 14px' }}>
            {incidents.slice(0, 3).map((inc, i) => (
              <div key={i} style={{
                background: V15.bg2, borderLeft: `4px solid ${V15.red}`,
                padding: '10px 12px', marginBottom: 6,
                fontFamily: MONO, fontSize: 11,
              }}>
                <span style={{ color: V15.red, fontWeight: 700, letterSpacing: 1 }}>{(inc.severity || 'NEAR-MISS').toUpperCase()}</span>
                <span style={{ color: V15.mute, marginLeft: 6 }}>{inc.project}</span>
                <div style={{ color: V15.fg, marginTop: 4, lineHeight: 1.4 }}>{inc.what}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* SECTION 07 — DESK */}
      <SectionLabel15 num="07" label="Desk"/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: V15.bg2 }}>
        <DeskBtn15 label="Tasks"   sub={`${todo.length} OPEN`} onClick={() => setNav('tab', 'tasks')}/>
        <DeskBtn15 label="Quotes"  sub="LEDGER"                onClick={() => setNav('quotes')} rightCol/>
        <DeskBtn15 label="Money"   sub="P&L"                   onClick={() => setNav('tab', 'money')} bottomRow/>
        <DeskBtn15 label="Cortex"  sub="AI DESK"               onClick={() => setNav('ai')} rightCol bottomRow/>
      </div>

      {/* SIGN-OFF FOOTER */}
      <div style={{
        marginTop: 18, padding: '12px 16px',
        background: V15.hi, color: V15.ink,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.4,
          marginBottom: 4,
        }}>SIGNED OFF BY</div>
        <div style={{
          fontFamily: TITLE, fontSize: 22, letterSpacing: -1, textTransform: 'uppercase',
          color: V15.ink, lineHeight: 1,
        }}>SITE MANAGER</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, fontFamily: MONO, fontSize: 9.5, color: V15.ink, fontWeight: 700, letterSpacing: 1 }}>
          <span>FORM-01 · REV.{dayNo}</span>
          <span>CORTEXX</span>
        </div>
      </div>

      {/* HAZARD STRIP — bottom */}
      <div style={{ height: 14, background: HAZARD }}/>
    </div>
  );
}

function SectionLabel15({ num, label, extra, alert }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 16px 8px',
      background: V15.bg,
    }}>
      <span style={{
        fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
        background: alert ? V15.red : V15.hi, color: V15.ink,
        padding: '2px 7px',
      }}>{num}</span>
      <span style={{ fontFamily: TITLE, fontSize: 16, color: V15.fg, letterSpacing: -0.4, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: V15.rule }}/>
      {extra && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: V15.mute }}>{extra}</span>}
    </div>
  );
}

function StatBlock15({ big, label, sub, accent }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRight: `1px solid ${V15.rule}`,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: V15.mute, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: TITLE, fontSize: 48, lineHeight: 0.9, letterSpacing: -2, color: accent }}>{big}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: V15.mute, marginTop: 4, letterSpacing: 1 }}>{sub}</div>
    </div>
  );
}

function Bar15({ label, value, fill, color, rightLabel, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'transparent', border: 'none',
      borderBottom: `1px solid ${V15.rule}`,
      padding: '12px 16px', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: V15.mute }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: V15.mute, letterSpacing: 1.2 }}>{rightLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <span style={{ fontFamily: TITLE, fontSize: 32, color: V15.fg, letterSpacing: -1.5, lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ marginTop: 8, position: 'relative', height: 6, background: V15.bg, border: `1px solid ${V15.rule}` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: color }}/>
      </div>
    </button>
  );
}

function DeskBtn15({ label, sub, onClick, rightCol, bottomRow }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', color: V15.fg,
      border: 'none',
      borderLeft: rightCol ? `1px solid ${V15.rule}` : 'none',
      borderBottom: bottomRow ? 'none' : `1px solid ${V15.rule}`,
      padding: '16px', textAlign: 'left',
      cursor: 'pointer',
    }}>
      <div style={{ fontFamily: TITLE, fontSize: 26, letterSpacing: -1, lineHeight: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: V15.hi, marginTop: 6 }}>{sub} ▸</div>
    </button>
  );
}

Object.assign(window, { DashV15_SiteNotice });
