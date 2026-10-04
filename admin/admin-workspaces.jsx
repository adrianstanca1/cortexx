// CortexBuild Admin — Workspaces (tenants) view
const AT_W = window.AT;

function WorkspacesView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);

  const ws = AdminStore.snapshot().workspaces.filter((w) =>
    !q || w.name.toLowerCase().includes(q.toLowerCase()) || w.owner.toLowerCase().includes(q.toLowerCase()));

  const columns = [
    { label: 'Workspace', key: 'name', render: (r) => React.createElement('div', null,
      React.createElement('div', { style: { fontWeight: 650, color: AT_W.t1 } }, r.name),
      React.createElement('div', { style: { fontSize: 11.5, color: AT_W.t3 } }, r.owner + ' · ' + r.region)) },
    { label: 'Plan', key: 'plan', render: (r) => React.createElement('span', { style: { fontFamily: AT_W.mono, fontSize: 12.5, color: AT_W.t2 } }, r.plan) },
    { label: 'Seats', key: 'seats', render: (r) => r.seatsUsed + '/' + r.seats },
    { label: 'MRR', key: 'mrr', align: 'right', render: (r) => React.createElement('span', { style: { fontFamily: AT_W.mono } }, fmtGBP(r.mrr)) },
    { label: 'Projects', key: 'projects', align: 'right' },
    { label: 'Status', key: 'status', render: (r) => React.createElement(Badge, null, r.status) },
  ];

  const sub = sel;
  const drawer = React.createElement(Drawer, { open: !!sel, title: sel ? sel.name : '', onClose: () => setSel(null) },
    sub && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
      React.createElement('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
        React.createElement(Badge, null, sub.status),
        React.createElement('span', { style: { fontFamily: AT_W.mono, fontSize: 12.5, color: AT_W.t2, padding: '3px 9px', background: AT_W.card, borderRadius: 6 } }, sub.plan + ' plan')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        [['Owner', sub.owner], ['Region', sub.region], ['Seats', sub.seatsUsed + '/' + sub.seats], ['MRR', fmtGBP(sub.mrr)], ['Projects', sub.projects], ['Storage', (sub.storageMB / 1024).toFixed(2) + ' GB'], ['Created', sub.created]].map(([k, v], i) =>
          React.createElement('div', { key: i, style: { background: AT_W.card, border: `1px solid ${AT_W.hair}`, borderRadius: 10, padding: '11px 13px' } },
            React.createElement('div', { style: { fontSize: 11, color: AT_W.t3, fontFamily: AT_W.sans, marginBottom: 3 } }, k),
            React.createElement('div', { style: { fontSize: 14, color: AT_W.t1, fontFamily: AT_W.sans, fontWeight: 640 } }, v)))),
      React.createElement('div', { style: { height: 1, background: AT_W.hair } }),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 650, color: AT_W.t2, fontFamily: AT_W.sans } }, 'PLAN'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        ['Starter', 'Pro', 'Business'].map((p) => React.createElement(Btn, { key: p, size: 'sm', kind: sub.plan === p ? 'primary' : 'default', onClick: () => { AdminStore.setWorkspacePlan(sub.id, p); toast('Plan → ' + p, 'success'); } }, p))),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 650, color: AT_W.t2, fontFamily: AT_W.sans, marginTop: 4 } }, 'SEATS'),
      React.createElement(Btn, { size: 'sm', icon: 'users', onClick: () => { AdminStore.addSeat(sub.id, 1); toast('Seat added', 'success'); } }, 'Add seat'),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 650, color: AT_W.t2, fontFamily: AT_W.sans, marginTop: 4 } }, 'STATUS'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        sub.status !== 'active' && React.createElement(Btn, { size: 'sm', kind: 'primary', onClick: () => { AdminStore.setWorkspaceStatus(sub.id, 'active'); toast('Activated', 'success'); } }, 'Activate'),
        sub.status !== 'suspended' && React.createElement(Btn, { size: 'sm', kind: 'danger', onClick: () => { AdminStore.setWorkspaceStatus(sub.id, 'suspended'); toast('Suspended', 'info'); } }, 'Suspend')),
      React.createElement('div', { style: { height: 1, background: AT_W.hair, marginTop: 4 } }),
      React.createElement(Btn, { kind: 'danger', full: true, onClick: () => { if (confirm('Delete ' + sub.name + '? This removes its users too.')) { AdminStore.deleteWorkspace(sub.id); toast('Workspace deleted', 'info'); setSel(null); } } }, 'Delete workspace')));

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' } },
      React.createElement('div', { style: { position: 'relative', flex: 1, maxWidth: 360 } },
        React.createElement('div', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: AT_W.t3 } }, React.createElement(Icon, { name: 'search', size: 15 })),
        React.createElement('input', { value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Search workspaces…', style: { width: '100%', background: AT_W.card, border: `1px solid ${AT_W.hairMid}`, borderRadius: 9, padding: '9px 12px 9px 34px', color: AT_W.t1, fontSize: 13.5, fontFamily: AT_W.sans, outline: 'none' } })),
      React.createElement('div', { style: { flex: 1 } }),
      React.createElement(Btn, { kind: 'primary', icon: 'building', onClick: () => setShowNew(true) }, 'New workspace')),
    React.createElement(Card, { pad: false }, React.createElement(DataTable, { columns, rows: ws, onRowClick: setSel, empty: 'No workspaces match' })),
    drawer,
    showNew && React.createElement(NewWorkspaceModal, { onClose: () => setShowNew(false), toast }));
}

function NewWorkspaceModal({ onClose, toast }) {
  const [name, setName] = React.useState('');
  const [owner, setOwner] = React.useState('');
  const [plan, setPlan] = React.useState('Starter');
  const inp = { width: '100%', background: AT_W.card, border: `1px solid ${AT_W.hairMid}`, borderRadius: 9, padding: '10px 12px', color: AT_W.t1, fontSize: 14, fontFamily: AT_W.sans, outline: 'none', marginTop: 6 };
  const lbl = { fontSize: 12.5, color: AT_W.t2, fontWeight: 600, fontFamily: AT_W.sans };
  return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 150, display: 'grid', placeItems: 'center' } },
    React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(4,10,20,0.6)' } }),
    React.createElement('div', { style: { position: 'relative', width: 420, maxWidth: '92vw', background: AT_W.bg1, border: `1px solid ${AT_W.hairMid}`, borderRadius: 16, padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,0.5)' } },
      React.createElement('div', { style: { fontSize: 17, fontWeight: 720, color: AT_W.t1, fontFamily: AT_W.sans, marginBottom: 16 } }, 'New workspace'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Company name'), React.createElement('input', { style: inp, value: name, onChange: (e) => setName(e.target.value), placeholder: 'Acme Construction Ltd' })),
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Owner'), React.createElement('input', { style: inp, value: owner, onChange: (e) => setOwner(e.target.value), placeholder: 'Jane Doe' })),
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Plan'), React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 6 } },
          ['Starter', 'Pro', 'Business'].map((p) => React.createElement(Btn, { key: p, size: 'sm', kind: plan === p ? 'primary' : 'default', onClick: () => setPlan(p) }, p))))),
      React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 22 } },
        React.createElement(Btn, { kind: 'ghost', full: true, onClick: onClose }, 'Cancel'),
        React.createElement(Btn, { kind: 'primary', full: true, disabled: !name.trim(), onClick: () => { AdminStore.createWorkspace({ name, owner, plan }); toast('Workspace created', 'success'); onClose(); } }, 'Create'))));
}

window.WorkspacesView = WorkspacesView;
