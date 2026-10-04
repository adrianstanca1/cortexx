// CortexBuild Admin — shared desktop UI primitives (React, global scope via window)
// Tokens live on window.AT (admin-core.js). All components are presentational.

const AT = window.AT;
const fmtGBP = (n) => '£' + Math.round(n).toLocaleString('en-GB');
const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
const timeAgo = (iso) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
};

// ── Icons (inline SVG, 1.6 stroke) ──────────────────────────────
function I({ d, size = 18, fill = 'none' }) {
  return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', fill, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
    Array.isArray(d) ? d.map((p, i) => React.createElement('path', { key: i, d: p })) : React.createElement('path', { d }));
}
const ICONS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  building: ['M3 21h18', 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16', 'M19 21V11a2 2 0 0 0-2-2h-2', 'M9 7h2M9 11h2M9 15h2'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  folder: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z',
  card: ['M2 5h20v14H2z', 'M2 10h20'],
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  dot: 'M12 12h.01',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  chevron: 'M9 18l6-6-6-6',
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
};
function Icon({ name, size }) { return React.createElement(I, { d: ICONS[name] || ICONS.dot, size }); }

// ── Badge ───────────────────────────────────────────────────────
function Badge({ kind, children }) {
  const map = {
    active: [AT.green, AT.greenDim], operational: [AT.green, AT.greenDim], paid: [AT.green, AT.greenDim], on_track: [AT.green, AT.greenDim],
    trial: [AT.blueL, AT.blueDim], open: [AT.blueL, AT.blueDim], invited: [AT.blueL, AT.blueDim],
    past_due: [AT.amber, AT.amberDim], degraded: [AT.amber, AT.amberDim], at_risk: [AT.amber, AT.amberDim], on_hold: [AT.amber, AT.amberDim],
    suspended: [AT.red, AT.redDim], overdue: [AT.red, AT.redDim], disabled: [AT.red, AT.redDim], delayed: [AT.red, AT.redDim],
    complete: [AT.purple, AT.purpleDim], Owner: [AT.purple, AT.purpleDim],
  };
  const [c, bg] = map[children] || map[kind] || [AT.t2, 'rgba(255,255,255,0.06)'];
  const label = String(children).replace(/_/g, ' ');
  return React.createElement('span', { style: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6,
    background: bg, color: c, fontSize: 11.5, fontWeight: 650, fontFamily: AT.sans,
    textTransform: 'capitalize', letterSpacing: 0.2, whiteSpace: 'nowrap',
  } },
    React.createElement('span', { style: { width: 5, height: 5, borderRadius: 5, background: c } }), label);
}

// ── StatCard ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, spark }) {
  return React.createElement('div', { style: {
    background: AT.card, border: `1px solid ${AT.hair}`, borderRadius: 14, padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', overflow: 'hidden', minWidth: 0,
  } },
    React.createElement('div', { style: { fontSize: 12.5, color: AT.t3, fontWeight: 600, fontFamily: AT.sans, letterSpacing: 0.2 } }, label),
    React.createElement('div', { style: { fontSize: 27, color: AT.t1, fontWeight: 720, fontFamily: AT.sans, letterSpacing: -0.5, lineHeight: 1.1 } }, value),
    sub && React.createElement('div', { style: { fontSize: 12, color: accent || AT.t2, fontWeight: 600, fontFamily: AT.sans } }, sub),
    spark && React.createElement('div', { style: { marginTop: 8 } }, React.createElement(Sparkline, { data: spark, color: accent || AT.blueL })));
}

// ── Sparkline ───────────────────────────────────────────────────
function Sparkline({ data, color, w = 200, h = 40 }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * (h - 6) - 3]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L${w} ${h} L0 ${h} Z`;
  const gid = 'sg_' + color.replace(/[^a-z0-9]/gi, '');
  return React.createElement('svg', { width: '100%', height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', style: { display: 'block' } },
    React.createElement('defs', null, React.createElement('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
      React.createElement('stop', { offset: 0, stopColor: color, stopOpacity: 0.25 }),
      React.createElement('stop', { offset: 1, stopColor: color, stopOpacity: 0 }))),
    React.createElement('path', { d: area, fill: `url(#${gid})` }),
    React.createElement('path', { d, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
}

// ── Bars (mini bar chart) ───────────────────────────────────────
function Bars({ data, color, h = 56 }) {
  const max = Math.max(...data) || 1;
  return React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 4, height: h } },
    data.map((v, i) => React.createElement('div', { key: i, title: String(v), style: {
      flex: 1, height: Math.max(4, (v / max) * h) + 'px', background: i === data.length - 1 ? color : color + '66',
      borderRadius: 3, transition: 'height .3s',
    } })));
}

// ── Card wrapper ────────────────────────────────────────────────
function Card({ title, action, children, pad = true, style }) {
  return React.createElement('div', { style: { background: AT.card, border: `1px solid ${AT.hair}`, borderRadius: 14, overflow: 'hidden', ...style } },
    title && React.createElement('div', { style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: `1px solid ${AT.hair}`,
    } },
      React.createElement('div', { style: { fontSize: 14, fontWeight: 680, color: AT.t1, fontFamily: AT.sans } }, title),
      action),
    React.createElement('div', { style: { padding: pad ? 18 : 0 } }, children));
}

// ── DataTable ───────────────────────────────────────────────────
function DataTable({ columns, rows, onRowClick, empty = 'No records' }) {
  return React.createElement('div', { style: { overflowX: 'auto' } },
    React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontFamily: AT.sans } },
      React.createElement('thead', null, React.createElement('tr', null,
        columns.map((c, i) => React.createElement('th', { key: i, style: {
          textAlign: c.align || 'left', padding: '10px 16px', fontSize: 11.5, fontWeight: 650,
          color: AT.t3, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${AT.hairMid}`,
          whiteSpace: 'nowrap', position: 'sticky', top: 0, background: AT.card,
        } }, c.label)))),
      React.createElement('tbody', null,
        rows.length === 0
          ? React.createElement('tr', null, React.createElement('td', { colSpan: columns.length, style: { padding: 28, textAlign: 'center', color: AT.t3, fontSize: 13 } }, empty))
          : rows.map((row, ri) => React.createElement('tr', {
              key: row.id || ri,
              onClick: onRowClick ? () => onRowClick(row) : undefined,
              style: { cursor: onRowClick ? 'pointer' : 'default', transition: 'background .12s' },
              onMouseEnter: (e) => { e.currentTarget.style.background = AT.hover; },
              onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
            },
            columns.map((c, ci) => React.createElement('td', { key: ci, style: {
              padding: '12px 16px', fontSize: 13, color: AT.t1, borderBottom: `1px solid ${AT.hair}`,
              textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap',
            } }, c.render ? c.render(row) : row[c.key])))))));
}

// ── Drawer (right slide-over) ───────────────────────────────────
function Drawer({ open, title, onClose, children, width = 460 }) {
  if (!open) return null;
  return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 100 } },
    React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(4,10,20,0.6)', backdropFilter: 'blur(2px)' } }),
    React.createElement('div', { style: {
      position: 'absolute', top: 0, right: 0, bottom: 0, width, maxWidth: '90vw',
      background: AT.bg1, borderLeft: `1px solid ${AT.hairMid}`, boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', animation: 'admDrawer .22s cubic-bezier(.2,.8,.2,1)',
    } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${AT.hair}` } },
        React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: AT.t1, fontFamily: AT.sans } }, title),
        React.createElement('button', { onClick: onClose, style: { background: AT.card, border: `1px solid ${AT.hair}`, color: AT.t2, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center' } }, React.createElement(Icon, { name: 'x', size: 16 }))),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: 22 } }, children)));
}

// ── Button ──────────────────────────────────────────────────────
function Btn({ children, onClick, kind = 'default', size = 'md', icon, full, disabled }) {
  const kinds = {
    primary: { background: AT.blue, color: '#fff', border: 'none' },
    danger: { background: AT.redDim, color: AT.red, border: `1px solid ${AT.red}44` },
    ghost: { background: 'transparent', color: AT.t2, border: `1px solid ${AT.hairMid}` },
    default: { background: AT.card2, color: AT.t1, border: `1px solid ${AT.hairMid}` },
  };
  const sz = size === 'sm' ? { padding: '6px 11px', fontSize: 12.5 } : { padding: '9px 15px', fontSize: 13.5 };
  return React.createElement('button', {
    onClick, disabled,
    style: { ...kinds[kind], ...sz, borderRadius: 9, fontWeight: 640, fontFamily: AT.sans, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: full ? '100%' : 'auto', transition: 'filter .12s' },
    onMouseEnter: (e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.12)'; },
    onMouseLeave: (e) => { e.currentTarget.style.filter = 'none'; },
  }, icon && React.createElement(Icon, { name: icon, size: 15 }), children);
}

// ── Toast ───────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((msg, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  const node = React.createElement('div', { style: { position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 } },
    toasts.map((t) => React.createElement('div', { key: t.id, style: {
      background: AT.card2, border: `1px solid ${t.kind === 'success' ? AT.green + '55' : AT.hairMid}`,
      color: AT.t1, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontFamily: AT.sans, fontWeight: 600,
      boxShadow: '0 8px 30px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 9, minWidth: 200,
      animation: 'admToast .2s ease',
    } },
      React.createElement('span', { style: { color: t.kind === 'success' ? AT.green : AT.blueL } }, React.createElement(Icon, { name: t.kind === 'success' ? 'check' : 'dot', size: 16 })),
      t.msg)));
  return [push, node];
}

Object.assign(window, { fmtGBP, fmtK, timeAgo, Icon, Badge, StatCard, Sparkline, Bars, Card, DataTable, Drawer, Btn, useToast });
