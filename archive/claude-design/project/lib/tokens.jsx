// Cortexx mobile — shared tokens, icons, atoms
// Used by all 6 dashboard variations.

const T = {
  // Layered surfaces
  bg0: '#06101e',
  bg1: '#0c1a2e',
  bg2: '#152641',
  bg3: '#1a2f4e',
  // Brand
  blue: '#2563eb', blueL: '#60a5fa', blueGlow: 'rgba(37,99,235,0.2)',
  // Status
  green: '#10b981', amber: '#f59e0b', red: '#ef4444', purple: '#8b5cf6', cyan: '#06b6d4',
  // Text
  t1: '#eef3fa', t2: '#8ea8c5', t3: '#52749a',
  // Lines
  hair: 'rgba(255,255,255,0.07)',
  hairMid: 'rgba(255,255,255,0.13)',
  hairStrong: 'rgba(255,255,255,0.22)',
};

const SF = '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';
const SFMono = '"SF Mono", "JetBrains Mono", ui-monospace, monospace';

// ── Icons ───────────────────────────────────────────────────
const I = ({ d, size = 22, sw = 1.7, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const Ic = {
  dashboard: <I d={<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>}/>,
  projects: <I d={<><path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>}/>,
  tasks: <I d={<><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>}/>,
  team: <I d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}/>,
  safety: <I d={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}/>,
  bell: <I d={<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>}/>,
  search: <I d={<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></>}/>,
  chevR: <I size={18} sw={2.2} d={<polyline points="9 6 15 12 9 18"/>}/>,
  chevL: <I size={18} sw={2.2} d={<polyline points="15 6 9 12 15 18"/>}/>,
  chevDown: <I size={16} sw={2.2} d={<polyline points="6 9 12 15 18 9"/>}/>,
  plus: <I sw={2.5} d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}/>,
  alert: <I d={<><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}/>,
  check: <I sw={2.4} d={<polyline points="20 6 9 17 4 12"/>}/>,
  bot: <I d={<><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 7V4M9 4h6"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/></>}/>,
  spark: <I d={<><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></>}/>,
  send: <I sw={2} d={<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>}/>,
  mic: <I d={<><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></>}/>,
  doc: <I d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>}/>,
  hardhat: <I d={<><path d="M4 18V12a8 8 0 0 1 16 0v6M2 18h20M9 18V8a3 3 0 0 1 6 0v10"/></>}/>,
  pin: <I d={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>}/>,
  camera: <I d={<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>}/>,
  receipt: <I d={<><path d="M4 2h16v20l-4-2-4 2-4-2-4 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="13" x2="14" y2="13"/></>}/>,
  clock: <I d={<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>}/>,
  trend: <I d={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>}/>,
  trendDown: <I d={<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>}/>,
  weather: <I d={<><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></>}/>,
  truck: <I d={<><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>}/>,
  wrench: <I d={<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>}/>,
  flag: <I d={<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>}/>,
  layers: <I d={<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>}/>,
  zap: <I fill="currentColor" d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>}/>,
  arrowUp: <I sw={2.2} d={<><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>}/>,
  arrowRight: <I sw={2.2} d={<><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>}/>,
  cloud: <I d={<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>}/>,
  sun: <I d={<><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></>}/>,
  filter: <I d={<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>}/>,
  more: <I d={<><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/></>}/>,
  fire: <I d={<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.7 0 3-1.3 3-3 0-2-3-2.5-3-5.5 0-3 2-5 2-5s-3 1-5 4-3 5.5-3 7c0 3 2 5.5 5 5.5"/>}/>,
};

// ── Atoms ───────────────────────────────────────────────────
const Avatar = ({ name, size = 32, c = T.blue }) => {
  const init = name.split(' ').map(n => n[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `linear-gradient(135deg, ${c}, ${c}aa)`,
      color: '#fff', fontFamily: SF, fontSize: size * 0.38, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{init}</div>
  );
};

const Pill = ({ children, c = T.blue, solid = false, size = 'sm' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: solid ? c : `${c}22`,
    color: solid ? '#fff' : c,
    fontFamily: SF, fontWeight: 600,
    fontSize: size === 'xs' ? 10 : 11,
    padding: size === 'xs' ? '2px 6px' : '3px 8px',
    borderRadius: 6, letterSpacing: 0.1, whiteSpace: 'nowrap',
  }}>{children}</span>
);

const Bar = ({ pct, c = T.blue, h = 4, bg = 'rgba(255,255,255,0.08)' }) => (
  <div style={{ width: '100%', height: h, background: bg, borderRadius: h / 2, overflow: 'hidden' }}>
    <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: h / 2, transition: 'width 0.3s' }}/>
  </div>
);

// Shared chrome — every variation gets these so they feel like the same app.
function MobileHeader({ title, subtitle, accent = T.blue, right }) {
  return (
    <div style={{
      padding: '4px 20px 12px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, letterSpacing: -0.4, lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

const HeaderBtn = ({ icon, badge, onClick, accent = T.blue }) => (
  <button onClick={onClick} style={{
    width: 36, height: 36, borderRadius: 18,
    background: T.bg2, border: `0.5px solid ${T.hair}`,
    color: T.t1, cursor: 'pointer', position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    {React.cloneElement(icon, { size: 18 })}
    {badge && <span style={{
      position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4,
      background: accent === T.blue ? T.red : accent,
      border: `1.5px solid ${T.bg0}`,
    }}/>}
  </button>
);

// Tab bar — shared across all variations, "Dashboard / Projects / + / Tasks / Team"
function TabBar({ active = 'dashboard', accent = T.blue, onCapture }) {
  const tabs = [
    { k: 'dashboard', l: 'Dashboard', i: Ic.dashboard },
    { k: 'projects', l: 'Projects', i: Ic.projects },
    { k: '_fab' },
    { k: 'tasks', l: 'Tasks', i: Ic.tasks },
    { k: 'team', l: 'Team', i: Ic.team },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(6,16,30,0.85)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderTop: `0.5px solid ${T.hair}`,
      paddingTop: 8, paddingBottom: 28,
      display: 'flex', alignItems: 'flex-start', zIndex: 10,
    }}>
      {tabs.map(t => {
        if (t.k === '_fab') {
          return (
            <div key="_fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <button onClick={onCapture} style={{
                width: 52, height: 52, borderRadius: 26,
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                border: 'none',
                boxShadow: `0 6px 20px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', marginTop: -22,
              }}>{React.cloneElement(Ic.plus, { size: 26 })}</button>
            </div>
          );
        }
        const isActive = active === t.k;
        return (
          <button key={t.k} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            color: isActive ? accent : T.t3, padding: '4px 0',
          }}>
            {React.cloneElement(t.i, { size: 22 })}
            <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{t.l}</span>
          </button>
        );
      })}
    </div>
  );
}

// Background — subtle radial wash for the device interior
const ScreenBg = ({ children, accent = T.blue }) => (
  <div style={{
    width: '100%', height: '100%',
    background: `radial-gradient(ellipse at 0% 0%, ${accent}1a, transparent 50%), ${T.bg0}`,
    color: T.t1, position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  }}>{children}</div>
);

Object.assign(window, {
  T, SF, SFMono, Ic, I,
  Avatar, Pill, Bar,
  MobileHeader, HeaderBtn, TabBar, ScreenBg,
});
