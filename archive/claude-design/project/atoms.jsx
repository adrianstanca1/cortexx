// Shared design tokens, icons and primitive components for CortexBuild iOS dashboard explorations.
// All variations consume from here so the visual language stays coherent.

const T = {
  // Layered surfaces (deeper → higher) — blueprint command center vibe but lighter than the design system
  // because mobile screenshots showed light-mode UI. We keep both worlds available via 'mode' on App.
  bg0: '#06101e', bg1: '#0c1a2e', bg2: '#152641', bg3: '#1a2f4e',
  // Accents
  blue: '#2563eb', blueL: '#60a5fa', blueGlow: 'rgba(37,99,235,0.2)',
  amber: '#f59e0b', amberDim: '#b45309',
  green: '#10b981', red: '#ef4444', purple: '#8b5cf6',
  // Text
  t1: '#eef3fa', t2: '#8ea8c5', t3: '#52749a',
  // Lines
  hair: 'rgba(255,255,255,0.07)', hairMid: 'rgba(255,255,255,0.13)',
  hairStrong: 'rgba(255,255,255,0.2)',
};

const SF = '-apple-system, "SF Pro Text", "SF Pro Display", "Instrument Sans", system-ui, sans-serif';
const SFMono = '"Fira Code", "SF Mono", "JetBrains Mono", ui-monospace, monospace';
const Display = '"Bebas Neue", -apple-system, "SF Pro Display", system-ui, sans-serif';

// ─── ICONS (Lucide-style stroke) ────────────────────────────────────────
const I = ({ d, size=22, sw=1.7, fill='none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const Ic = {
  dashboard: <I d={<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>}/>,
  projects: <I d={<><path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>}/>,
  tasks: <I d={<><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>}/>,
  team: <I d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}/>,
  shield: <I d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}/>,
  bell: <I d={<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>}/>,
  search: <I d={<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></>}/>,
  chevR: <I size={18} sw={2.2} d={<polyline points="9 6 15 12 9 18"/>}/>,
  chevL: <I size={18} sw={2.2} d={<polyline points="15 6 9 12 15 18"/>}/>,
  chevD: <I sw={2.2} d={<polyline points="6 9 12 15 18 9"/>}/>,
  plus: <I sw={2.5} d={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}/>,
  alert: <I d={<><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>}/>,
  check: <I sw={2.4} d={<polyline points="20 6 9 17 4 12"/>}/>,
  bot: <I d={<><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 7V4M9 4h6"/><circle cx="9" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="16" r="1" fill="currentColor"/></>}/>,
  send: <I sw={2} d={<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>}/>,
  doc: <I d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>}/>,
  hardhat: <I d={<><path d="M4 18V12a8 8 0 0 1 16 0v6M2 18h20M9 18V8a3 3 0 0 1 6 0v10"/></>}/>,
  pin: <I d={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>}/>,
  camera: <I d={<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>}/>,
  mic: <I d={<><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></>}/>,
  cog: <I d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>}/>,
  clock: <I d={<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>}/>,
  trend: <I d={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>}/>,
  receipt: <I d={<><path d="M4 2h16v20l-4-2-4 2-4-2-4 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="13" x2="14" y2="13"/></>}/>,
  calendar: <I d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>,
  layers: <I d={<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>}/>,
  weather: <I d={<><path d="M17.5 19a4.5 4.5 0 1 0-1.65-8.69 6 6 0 1 0-9.85 5.69"/></>}/>,
  zap: <I d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>}/>,
  truck: <I d={<><rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></>}/>,
  flame: <I d={<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.4 0 2.5-1 2.5-2.5 0-2-2.5-3-2.5-5 0-1.5 1-3 2.5-3 .5 2 2.5 4 2.5 7a4 4 0 0 1-4 4 4 4 0 0 1-4-4c0-1 1-1.5 1-2.5z"/>}/>,
  briefcase: <I d={<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>}/>,
  x: <I sw={2.2} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}/>,
  more: <I d={<><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/></>}/>,
  filter: <I d={<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>}/>,
};

// ─── ATOMS ──────────────────────────────────────────────────────────────
const Card = ({ children, onClick, p=14, style }) => (
  <div onClick={onClick} style={{
    background: T.bg2, borderRadius: 14, padding: p,
    border: `0.5px solid ${T.hair}`,
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }}>{children}</div>
);

const Pill = ({ children, c=T.blue, solid=false, mono=false }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: solid ? c : `${c}22`, color: solid ? '#fff' : c,
    fontFamily: mono ? SFMono : SF, fontSize: 10, fontWeight: 600,
    padding: '3px 7px', borderRadius: 5, letterSpacing: mono ? 0.4 : 0.1,
    textTransform: mono ? 'uppercase' : 'none',
  }}>{children}</span>
);

const Avatar = ({ name, size=32, c=T.blue, square=false }) => {
  const init = name.split(' ').map(n=>n[0]).slice(0,2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: square ? size*0.22 : size/2,
      background: `linear-gradient(135deg, ${c}, ${c}aa)`,
      color: '#fff', fontFamily: SF, fontSize: size*0.36, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{init}</div>
  );
};

const Bar = ({ pct, c=T.blue, h=4, bg='rgba(255,255,255,0.08)' }) => (
  <div style={{ width: '100%', height: h, background: bg, borderRadius: h/2, overflow: 'hidden' }}>
    <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: h/2 }} />
  </div>
);

const SectionTitle = ({ title, action, mono=false }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 20px 8px' }}>
    <div style={{
      fontFamily: mono ? SFMono : SF,
      fontSize: mono ? 10 : 12, fontWeight: 600, color: T.t2,
      textTransform: 'uppercase', letterSpacing: mono ? 1.2 : 0.6
    }}>{title}</div>
    {action && <button style={{ background: 'none', border: 'none', color: T.blueL, fontFamily: SF, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{action}</button>}
  </div>
);

// ─── BLUEPRINT GRID BACKGROUND (signature CortexBuild motif) ─────────────
const BlueprintBg = ({ accent = T.amber, opacity = 0.04, size = 24 }) => (
  <div style={{
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(${accent}${Math.round(opacity*255).toString(16).padStart(2,'0')} 1px, transparent 1px),
      linear-gradient(90deg, ${accent}${Math.round(opacity*255).toString(16).padStart(2,'0')} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
  }}/>
);

// Corner crosshair brackets — signature CortexBuild motif
const CornerBrackets = ({ size = 12, color = T.amber, opacity = 0.5, inset = 8 }) => {
  const sw = 1.5;
  const c = color;
  const Br = ({ style }) => (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', opacity, ...style }}>
      <path d={`M0 ${size/3} L0 0 L${size/3} 0`} stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round"/>
    </svg>
  );
  return <>
    <Br style={{ top: inset, left: inset }}/>
    <Br style={{ top: inset, right: inset, transform: 'scaleX(-1)' }}/>
    <Br style={{ bottom: inset, left: inset, transform: 'scaleY(-1)' }}/>
    <Br style={{ bottom: inset, right: inset, transform: 'scale(-1,-1)' }}/>
  </>;
};

// HEADER — small title bar at top of every screen
function Header({ title, subtitle, left, right, accent }) {
  return (
    <div style={{
      padding: '6px 18px 12px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: `0.5px solid ${T.hair}`, gap: 10,
      position: 'relative',
    }}>
      {accent && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.6 }}/>}
      {left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SF, fontSize: 22, fontWeight: 700, color: T.t1, letterSpacing: -0.4, lineHeight: 1.05 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

const HeaderBtn = ({ icon, badge, onClick, color, size=36 }) => (
  <button onClick={onClick} style={{
    width: size, height: size, borderRadius: size/2,
    background: T.bg2, border: `0.5px solid ${T.hair}`,
    color: color || T.t1, cursor: 'pointer', position: 'relative', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    {React.cloneElement(icon, { size: 18 })}
    {badge && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: T.red, border: `1.5px solid ${T.bg0}` }}/>}
  </button>
);

// TAB BAR — Dashboard / Projects / Tasks / Team / Safety
function TabBar({ tab, setTab, accent = T.amber }) {
  const tabs = [
    { k: 'dashboard', label: 'Dashboard', icon: Ic.dashboard },
    { k: 'projects', label: 'Projects', icon: Ic.projects },
    { k: 'tasks', label: 'Tasks', icon: Ic.tasks },
    { k: 'team', label: 'Team', icon: Ic.team },
    { k: 'safety', label: 'Safety', icon: Ic.shield },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(6,16,30,0.88)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderTop: `0.5px solid ${T.hair}`,
      paddingTop: 8, paddingBottom: 28,
      display: 'flex', alignItems: 'flex-start', zIndex: 10,
    }}>
      {tabs.map(t => {
        const active = tab === t.k;
        return (
          <button key={t.k} onClick={() => setTab && setTab(t.k)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            color: active ? accent : T.t3, padding: '4px 0',
            position: 'relative',
          }}>
            {active && <div style={{ position: 'absolute', top: -8, width: 28, height: 2, borderRadius: 1, background: accent }}/>}
            {React.cloneElement(t.icon, { size: 22 })}
            <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  T, SF, SFMono, Display, Ic,
  Card, Pill, Avatar, Bar, SectionTitle,
  BlueprintBg, CornerBrackets,
  Header, HeaderBtn, TabBar,
});
