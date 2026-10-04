// CortexBuild Admin — System Health, Audit Log, Feature Flags
const AT_S = window.AT;

function SystemView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const services = AdminStore.services();
  const events = AdminStore.events();
  const incidents = AdminStore.snapshot().incidents;

  const svcCards = React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 } },
    services.map((s) => React.createElement('div', { key: s.id, style: { background: AT_S.card, border: `1px solid ${AT_S.hair}`, borderRadius: 14, padding: '16px 18px' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 } },
        React.createElement('span', { style: { fontSize: 13.5, fontWeight: 660, color: AT_S.t1, fontFamily: AT_S.sans } }, s.name),
        React.createElement(Badge, null, s.status)),
      React.createElement('div', { style: { display: 'flex', gap: 16 } },
        React.createElement('div', null, React.createElement('div', { style: { fontSize: 11, color: AT_S.t3, fontFamily: AT_S.sans } }, 'Uptime'), React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: AT_S.t1, fontFamily: AT_S.mono } }, s.uptime + '%')),
        React.createElement('div', null, React.createElement('div', { style: { fontSize: 11, color: AT_S.t3, fontFamily: AT_S.sans } }, 'p95'), React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: AT_S.t1, fontFamily: AT_S.mono } }, s.p95 + 'ms'))))));

  const right = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement(Card, { title: 'Recent incidents' },
      incidents.length === 0
        ? React.createElement('div', { style: { color: AT_S.t3, fontSize: 13, fontFamily: AT_S.sans } }, 'No incidents — all clear')
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          incidents.map((i) => React.createElement('div', { key: i.id, style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement(Badge, null, i.sev),
            React.createElement('span', { style: { fontSize: 13, color: AT_S.t1, fontFamily: AT_S.sans, flex: 1 } }, i.title),
            React.createElement('span', { style: { fontSize: 11.5, color: AT_S.t3, fontFamily: AT_S.mono } }, i.dur))))),
    React.createElement(Card, { title: 'Event stream' },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
        events.map((e) => React.createElement('div', { key: e.id, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${AT_S.hair}` } },
          React.createElement('span', { style: { width: 6, height: 6, borderRadius: 6, background: e.severity === 'warn' ? AT_S.amber : AT_S.green, flexShrink: 0 } }),
          React.createElement('span', { style: { fontSize: 12.5, color: AT_S.t1, fontFamily: AT_S.sans, flex: 1 } }, e.message),
          React.createElement('span', { style: { fontSize: 11, color: AT_S.t3, fontFamily: AT_S.mono } }, timeAgo(e.at)))))));

  return React.createElement('div', null, svcCards,
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 } }, right));
}

function AuditView() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const [q, setQ] = React.useState('');
  const audit = AdminStore.snapshot().audit.filter((a) => !q || (a.action + a.target + a.actor).toLowerCase().includes(q.toLowerCase()));
  const columns = [
    { label: 'When', key: 'when', render: (r) => React.createElement('span', { style: { fontFamily: AT_S.mono, fontSize: 12, color: AT_S.t3 } }, timeAgo(r.when)) },
    { label: 'Actor', key: 'actor', render: (r) => React.createElement('span', { style: { fontFamily: AT_S.mono, fontSize: 12.5, color: AT_S.t2 } }, r.actor) },
    { label: 'Action', key: 'action', render: (r) => React.createElement('span', { style: { fontFamily: AT_S.mono, fontSize: 12.5, color: AT_S.blueL } }, r.action) },
    { label: 'Target', key: 'target', render: (r) => React.createElement('span', { style: { color: AT_S.t1 } }, r.target) },
    { label: 'Detail', key: 'meta', render: (r) => React.createElement('span', { style: { color: AT_S.t3, fontSize: 12.5 } }, r.meta) },
  ];
  return React.createElement('div', null,
    React.createElement('div', { style: { position: 'relative', maxWidth: 360, marginBottom: 16 } },
      React.createElement('div', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: AT_S.t3 } }, React.createElement(Icon, { name: 'search', size: 15 })),
      React.createElement('input', { value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Filter audit log…', style: { width: '100%', background: AT_S.card, border: `1px solid ${AT_S.hairMid}`, borderRadius: 9, padding: '9px 12px 9px 34px', color: AT_S.t1, fontSize: 13.5, fontFamily: AT_S.sans, outline: 'none' } })),
    React.createElement(Card, { pad: false }, React.createElement(DataTable, { columns, rows: audit, empty: 'No audit entries' })));
}

function FlagsView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const flags = AdminStore.flags();
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 } },
    flags.map((f) => React.createElement('div', { key: f.id, style: { background: AT_S.card, border: `1px solid ${AT_S.hair}`, borderRadius: 14, padding: 18 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 14.5, fontWeight: 680, color: AT_S.t1, fontFamily: AT_S.sans } }, f.name),
          React.createElement('div', { style: { fontSize: 12.5, color: AT_S.t3, fontFamily: AT_S.sans, marginTop: 3 } }, f.desc)),
        React.createElement('button', { onClick: () => { AdminStore.toggleFlag(f.id); toast(f.name + ' ' + (!f.enabled ? 'enabled' : 'disabled'), 'success'); }, style: {
          width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: f.enabled ? AT_S.green : AT_S.hairStrong, position: 'relative', transition: 'background .15s',
        } }, React.createElement('span', { style: { position: 'absolute', top: 3, left: f.enabled ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left .15s' } }))),
      React.createElement('div', { style: { marginTop: 14 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: AT_S.t3, fontFamily: AT_S.sans, marginBottom: 5 } },
          React.createElement('span', null, 'Rollout'), React.createElement('span', { style: { fontFamily: AT_S.mono, color: AT_S.t2 } }, f.rollout + '%')),
        React.createElement('input', { type: 'range', min: 0, max: 100, step: 5, value: f.rollout, onChange: (e) => AdminStore.setFlagRollout(f.id, +e.target.value), style: { width: '100%', accentColor: AT_S.blue } })))));
}

Object.assign(window, { SystemView, AuditView, FlagsView });
