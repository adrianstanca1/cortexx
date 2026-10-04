// CortexBuild Admin — Overview view
const AT_V = window.AT;

function OverviewView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const m = AdminStore.metrics();
  const ws = AdminStore.snapshot().workspaces;
  const events = AdminStore.events();
  const services = AdminStore.services();

  const statRow = React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 } },
    React.createElement(StatCard, { label: 'Monthly Recurring Revenue', value: fmtGBP(m.mrr), sub: '+4.2% vs last month', accent: AT_V.green, spark: AdminStore.mrrSeries() }),
    React.createElement(StatCard, { label: 'Annual Run Rate', value: fmtGBP(m.arr), sub: 'ARR', accent: AT_V.blueL }),
    React.createElement(StatCard, { label: 'Active Workspaces', value: m.active + '/' + m.total, sub: m.trials + ' trials · ' + m.pastDue + ' past-due', accent: AT_V.purple }),
    React.createElement(StatCard, { label: 'Seats In Use', value: m.seats + '/' + m.seatCap, sub: Math.round((m.seats / m.seatCap) * 100) + '% utilised', accent: AT_V.cyan }),
    React.createElement(StatCard, { label: 'New Signups', value: AdminStore.signupsSeries().slice(-1)[0], sub: 'this month', accent: AT_V.amber, spark: AdminStore.signupsSeries() }),
    React.createElement(StatCard, { label: 'Storage', value: m.storageGB.toFixed(1) + ' GB', sub: m.projects + ' projects', accent: AT_V.blueL }));

  const grid = React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 } },
    React.createElement(Card, { title: 'Signups — last 12 months' },
      React.createElement(Bars, { data: AdminStore.signupsSeries(), color: AT_V.blueL, h: 120 }),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: AT_V.t3, fontFamily: AT_V.sans } },
        ['Jul', 'Sep', 'Nov', 'Jan', 'Mar', 'May'].map((mo, i) => React.createElement('span', { key: i }, mo)))),
    React.createElement(Card, { title: 'System Health' },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
        services.map((s) => React.createElement('div', { key: s.id, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
            React.createElement('span', { style: { width: 7, height: 7, borderRadius: 7, background: s.status === 'operational' ? AT_V.green : AT_V.amber } }),
            React.createElement('span', { style: { fontSize: 13, color: AT_V.t1, fontFamily: AT_V.sans, fontWeight: 600 } }, s.name)),
          React.createElement('span', { style: { fontSize: 12, color: AT_V.t3, fontFamily: AT_V.mono } }, s.uptime + '% · ' + s.p95 + 'ms'))))));

  const activity = React.createElement('div', { style: { marginTop: 16 } },
    React.createElement(Card, { title: 'Platform Activity' },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
        events.map((e) => React.createElement('div', { key: e.id, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: `1px solid ${AT_V.hair}` } },
          React.createElement('span', { style: { width: 6, height: 6, borderRadius: 6, background: e.severity === 'warn' ? AT_V.amber : AT_V.blueL, flexShrink: 0 } }),
          React.createElement('span', { style: { fontSize: 13, color: AT_V.t1, fontFamily: AT_V.sans, flex: 1 } }, e.message),
          React.createElement('span', { style: { fontSize: 11.5, color: AT_V.t3, fontFamily: AT_V.mono, whiteSpace: 'nowrap' } }, timeAgo(e.at)))))));

  return React.createElement('div', null, statRow, grid, activity);
}

window.OverviewView = OverviewView;
