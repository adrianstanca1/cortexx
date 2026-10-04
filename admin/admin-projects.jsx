// CortexBuild Admin — Projects (platform-wide, by workspace)
const AT_P = window.AT;

function ProjectsView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const [q, setQ] = React.useState('');
  const rows = AdminStore.projectsByWorkspace().filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const totalProjects = rows.reduce((s, r) => s + r.projects, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const maxP = Math.max(1, ...rows.map((r) => r.projects));

  const stats = React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 16 } },
    React.createElement(StatCard, { label: 'Total projects', value: totalProjects, sub: 'across all workspaces', accent: AT_P.blueL }),
    React.createElement(StatCard, { label: 'Combined ARR value', value: fmtGBP(totalValue), accent: AT_P.green }),
    React.createElement(StatCard, { label: 'Workspaces with projects', value: rows.filter((r) => r.projects > 0).length + '/' + rows.length, accent: AT_P.purple }));

  const columns = [
    { label: 'Workspace', key: 'name', render: (r) => React.createElement('span', { style: { fontWeight: 640, color: AT_P.t1 } }, r.name) },
    { label: 'Projects', key: 'projects', render: (r) => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement('span', { style: { fontFamily: AT_P.mono, fontSize: 13, color: AT_P.t1, minWidth: 22 } }, r.projects),
      React.createElement('div', { style: { flex: 1, maxWidth: 160, height: 6, background: AT_P.card2, borderRadius: 4, overflow: 'hidden' } },
        React.createElement('div', { style: { width: (r.projects / maxP * 100) + '%', height: '100%', background: AT_P.blueL, borderRadius: 4 } }))) },
    { label: 'ARR value', key: 'value', align: 'right', render: (r) => React.createElement('span', { style: { fontFamily: AT_P.mono } }, fmtGBP(r.value)) },
    { label: 'Status', key: 'status', render: (r) => React.createElement(Badge, null, r.status) },
  ];

  return React.createElement('div', null, stats,
    React.createElement('div', { style: { position: 'relative', maxWidth: 360, marginBottom: 16 } },
      React.createElement('div', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: AT_P.t3 } }, React.createElement(Icon, { name: 'search', size: 15 })),
      React.createElement('input', { value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Search workspaces…', style: { width: '100%', background: AT_P.card, border: `1px solid ${AT_P.hairMid}`, borderRadius: 9, padding: '9px 12px 9px 34px', color: AT_P.t1, fontSize: 13.5, fontFamily: AT_P.sans, outline: 'none' } })),
    React.createElement(Card, { title: 'Projects by workspace', pad: false }, React.createElement(DataTable, { columns, rows, empty: 'No projects' })));
}

window.ProjectsView = ProjectsView;
