// CortexBuild Admin — Users view
const AT_U = window.AT;

function UsersView({ toast }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => AdminStore.subscribe(force), []);
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [invite, setInvite] = React.useState(false);

  const users = AdminStore.snapshot().users.filter((u) =>
    !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || AdminStore.wsName(u.ws).toLowerCase().includes(q.toLowerCase()));

  const columns = [
    { label: 'User', key: 'name', render: (r) => React.createElement('div', null,
      React.createElement('div', { style: { fontWeight: 650, color: AT_U.t1 } }, r.name),
      React.createElement('div', { style: { fontSize: 11.5, color: AT_U.t3, fontFamily: AT_U.mono } }, r.email)) },
    { label: 'Workspace', key: 'ws', render: (r) => AdminStore.wsName(r.ws) },
    { label: 'Role', key: 'role', render: (r) => React.createElement(Badge, null, r.role) },
    { label: 'MFA', key: 'mfa', render: (r) => React.createElement('span', { style: { fontSize: 12, color: r.mfa ? AT_U.green : AT_U.t3, fontWeight: 600 } }, r.mfa ? 'On' : 'Off') },
    { label: 'Last seen', key: 'lastSeen', render: (r) => React.createElement('span', { style: { fontFamily: AT_U.mono, fontSize: 12, color: AT_U.t3 } }, timeAgo(r.lastSeen)) },
    { label: 'Status', key: 'status', render: (r) => React.createElement(Badge, null, r.status) },
  ];

  const u = sel;
  const drawer = React.createElement(Drawer, { open: !!sel, title: u ? u.name : '', onClose: () => setSel(null), width: 420 },
    u && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
      React.createElement('div', { style: { fontFamily: AT_U.mono, fontSize: 13, color: AT_U.t2 } }, u.email),
      React.createElement('div', { style: { display: 'flex', gap: 9, flexWrap: 'wrap' } },
        React.createElement(Badge, null, u.status), React.createElement(Badge, null, u.role),
        React.createElement('span', { style: { fontSize: 12, color: AT_U.t2, padding: '3px 9px', background: AT_U.card, borderRadius: 6, fontFamily: AT_U.sans } }, AdminStore.wsName(u.ws))),
      React.createElement('div', { style: { height: 1, background: AT_U.hair } }),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 650, color: AT_U.t2, fontFamily: AT_U.sans } }, 'ROLE'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        ['Owner', 'Admin', 'Manager', 'Member'].map((r) => React.createElement(Btn, { key: r, size: 'sm', kind: u.role === r ? 'primary' : 'default', onClick: () => { AdminStore.setUserRole(u.id, r); toast('Role → ' + r, 'success'); } }, r))),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 650, color: AT_U.t2, fontFamily: AT_U.sans, marginTop: 4 } }, 'SECURITY'),
      React.createElement(Btn, { size: 'sm', icon: 'shield', onClick: () => { AdminStore.resetMfa(u.id); toast('MFA reset — user must re-enrol', 'info'); } }, 'Reset MFA'),
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 650, color: AT_U.t2, fontFamily: AT_U.sans, marginTop: 4 } }, 'ACCESS'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        u.status !== 'active' && React.createElement(Btn, { size: 'sm', kind: 'primary', onClick: () => { AdminStore.setUserStatus(u.id, 'active'); toast('Enabled', 'success'); } }, 'Enable'),
        u.status !== 'disabled' && React.createElement(Btn, { size: 'sm', kind: 'danger', onClick: () => { AdminStore.setUserStatus(u.id, 'disabled'); toast('Disabled', 'info'); } }, 'Disable'))));

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' } },
      React.createElement('div', { style: { position: 'relative', flex: 1, maxWidth: 360 } },
        React.createElement('div', { style: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: AT_U.t3 } }, React.createElement(Icon, { name: 'search', size: 15 })),
        React.createElement('input', { value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Search users…', style: { width: '100%', background: AT_U.card, border: `1px solid ${AT_U.hairMid}`, borderRadius: 9, padding: '9px 12px 9px 34px', color: AT_U.t1, fontSize: 13.5, fontFamily: AT_U.sans, outline: 'none' } })),
      React.createElement('div', { style: { flex: 1 } }),
      React.createElement(Btn, { kind: 'primary', icon: 'users', onClick: () => setInvite(true) }, 'Invite user')),
    React.createElement(Card, { pad: false }, React.createElement(DataTable, { columns, rows: users, onRowClick: setSel, empty: 'No users match' })),
    drawer,
    invite && React.createElement(InviteUserModal, { onClose: () => setInvite(false), toast }));
}

function InviteUserModal({ onClose, toast }) {
  const wss = AdminStore.snapshot().workspaces;
  const [email, setEmail] = React.useState('');
  const [ws, setWs] = React.useState(wss[0] ? wss[0].id : '');
  const [role, setRole] = React.useState('Member');
  const inp = { width: '100%', background: AT_U.card, border: `1px solid ${AT_U.hairMid}`, borderRadius: 9, padding: '10px 12px', color: AT_U.t1, fontSize: 14, fontFamily: AT_U.sans, outline: 'none', marginTop: 6 };
  const lbl = { fontSize: 12.5, color: AT_U.t2, fontWeight: 600, fontFamily: AT_U.sans };
  const valid = /\S+@\S+\.\S+/.test(email);
  return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 150, display: 'grid', placeItems: 'center' } },
    React.createElement('div', { onClick: onClose, style: { position: 'absolute', inset: 0, background: 'rgba(4,10,20,0.6)' } }),
    React.createElement('div', { style: { position: 'relative', width: 420, maxWidth: '92vw', background: AT_U.bg1, border: `1px solid ${AT_U.hairMid}`, borderRadius: 16, padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,0.5)' } },
      React.createElement('div', { style: { fontSize: 17, fontWeight: 720, color: AT_U.t1, fontFamily: AT_U.sans, marginBottom: 16 } }, 'Invite user'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Email'), React.createElement('input', { style: inp, value: email, onChange: (e) => setEmail(e.target.value), placeholder: 'name@company.com' })),
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Workspace'), React.createElement('select', { style: inp, value: ws, onChange: (e) => setWs(e.target.value) }, wss.map((w) => React.createElement('option', { key: w.id, value: w.id, style: { background: AT_U.bg1 } }, w.name)))),
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Role'), React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 6 } },
          ['Admin', 'Manager', 'Member'].map((r) => React.createElement(Btn, { key: r, size: 'sm', kind: role === r ? 'primary' : 'default', onClick: () => setRole(r) }, r))))),
      React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 22 } },
        React.createElement(Btn, { kind: 'ghost', full: true, onClick: onClose }, 'Cancel'),
        React.createElement(Btn, { kind: 'primary', full: true, disabled: !valid, onClick: () => { AdminStore.inviteUser({ email, ws, role }); toast('Invite sent', 'success'); onClose(); } }, 'Send invite'))));
}

window.UsersView = UsersView;
