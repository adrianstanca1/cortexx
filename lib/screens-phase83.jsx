// Cortexx — Per-tenant roles/permissions + org admin dashboard (Phase 83)

(function () {
  if (window.CortexRBAC) return;

  // Role → permission matrix
  const ROLE_PERMS = {
    Owner:      ['*'],
    Director:   ['*'],
    Manager:    ['projects', 'money', 'team', 'tasks', 'reports', 'safety', 'quotes', 'docs'],
    Foreman:    ['projects', 'tasks', 'team', 'safety', 'photos', 'diary', 'snags', 'clock'],
    Accountant: ['money', 'invoices', 'payroll', 'reports', 'quotes'],
    Worker:     ['myday', 'tasks', 'clock', 'photos'],
    Subcontractor: ['subportal', 'photos', 'docs'],
    Client:     ['portal'],
  };

  window.CortexRBAC = {
    roles() { return Object.keys(ROLE_PERMS); },
    perms(role) { return ROLE_PERMS[role] || []; },
    can(role, area) {
      const p = ROLE_PERMS[role] || [];
      return p.includes('*') || p.includes(area);
    },
  };

  // Per-tenant members store
  const KEY = () => 'cortexx_members__' + (window.CortexTenant ? window.CortexTenant.active() : 'default');
  const seed = [
    { id: 1, name: 'Adrian Stanca', email: 'adrian@cortexbuild.app', role: 'Director', status: 'active', color: '#2563eb' },
    { id: 2, name: 'Tom Reilly', email: 'tom@cortexbuild.app', role: 'Foreman', status: 'active', color: '#f59e0b' },
    { id: 3, name: 'Marcus Pound', email: 'marcus@cortexbuild.app', role: 'Accountant', status: 'active', color: '#10b981' },
    { id: 4, name: 'Aisha Begum', email: 'aisha@cortexbuild.app', role: 'Worker', status: 'active', color: '#8b5cf6' },
    { id: 5, name: 'Spark Electricals', email: 'vik@spark.co.uk', role: 'Subcontractor', status: 'invited', color: '#06b6d4' },
  ];
  window.CortexMembers = {
    list() { try { const r = localStorage.getItem(KEY()); if (r) return JSON.parse(r); } catch (e) {} try { localStorage.setItem(KEY(), JSON.stringify(seed)); } catch (e) {} return seed; },
    save(list) { try { localStorage.setItem(KEY(), JSON.stringify(list)); } catch (e) {} },
    setRole(id, role) { const l = this.list().map(m => m.id === id ? { ...m, role } : m); this.save(l); },
    invite(name, email, role) { const l = this.list(); l.push({ id: Date.now(), name, email, role, status: 'invited', color: '#2563eb' }); this.save(l); return l; },
    remove(id) { this.save(this.list().filter(m => m.id !== id)); },
  };
})();

function AdminScreen({ accent }) {
  const tenant = window.CortexTenant ? window.CortexTenant.activeRecord() : { name: 'Workspace', plan: 'Pro' };
  const [members, setMembers] = React.useState(window.CortexMembers.list());
  const [editing, setEditing] = React.useState(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [iName, setIName] = React.useState(''); const [iEmail, setIEmail] = React.useState(''); const [iRole, setIRole] = React.useState('Worker');
  const roles = window.CortexRBAC.roles();
  const refresh = () => setMembers(window.CortexMembers.list());

  const roleC = { Owner: T.purple, Director: T.purple, Manager: T.blue, Foreman: T.amber, Accountant: T.green, Worker: T.cyan, Subcontractor: T.t2, Client: T.t3 };

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Org admin" subtitle={`${tenant.name} · ${members.length} members`}
          right={<button onClick={() => setInviteOpen(!inviteOpen)} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(Ic.plus, { size: 20 })}</button>}/>

        {/* Org summary */}
        <div style={{ padding: '4px 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { l: 'Members', v: members.length, c: accent },
            { l: 'Active', v: members.filter(m => m.status === 'active').length, c: T.green },
            { l: 'Invited', v: members.filter(m => m.status === 'invited').length, c: T.amber },
          ].map((s, i) => (
            <div key={i} style={{ background: T.bg2, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${T.hair}` }}>
              <div style={{ fontFamily: SF, fontSize: 9, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.l}</div>
              <div style={{ fontFamily: SFMono, fontSize: 22, color: s.c, fontWeight: 700, marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Invite form */}
        {inviteOpen && (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ background: T.bg2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={iName} onChange={e => setIName(e.target.value)} placeholder="Name" style={inp()}/>
              <input value={iEmail} onChange={e => setIEmail(e.target.value)} placeholder="Email" style={inp()}/>
              <select value={iRole} onChange={e => setIRole(e.target.value)} style={{ ...inp(), appearance: 'none' }}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select>
              <button onClick={() => { if (!iName.trim()) { toast('Name required', 'error'); return; } window.CortexMembers.invite(iName.trim(), iEmail.trim(), iRole); refresh(); setInviteOpen(false); setIName(''); setIEmail(''); toast('Invitation sent', 'success'); }} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Send invite</button>
            </div>
          </div>
        )}

        {/* Members + roles */}
        <Section title="Members & roles">
          <GroupedList>
            {members.map((m, i) => (
              <div key={m.id} style={{ padding: '12px 14px', borderBottom: i === members.length - 1 ? 'none' : `0.5px solid ${T.hair}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={m.name} size={38} c={m.color}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{m.name}</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{m.email}</div>
                  </div>
                  {m.status === 'invited' && <Pill c={T.amber} size="xs">invited</Pill>}
                  <button onClick={() => setEditing(editing === m.id ? null : m.id)} style={{ background: `${roleC[m.role] || accent}22`, color: roleC[m.role] || accent, border: 'none', borderRadius: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 700 }}>{m.role} ▾</button>
                </div>
                {editing === m.id && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {roles.map(r => (
                      <button key={r} onClick={() => { window.CortexMembers.setRole(m.id, r); refresh(); setEditing(null); toast(`${m.name.split(' ')[0]} → ${r}`, 'success'); }} style={{ background: m.role === r ? (roleC[r] || accent) : T.bg3, color: m.role === r ? '#fff' : T.t1, border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 600 }}>{r}</button>
                    ))}
                    <button onClick={() => { window.CortexMembers.remove(m.id); refresh(); setEditing(null); toast('Member removed', 'info'); }} style={{ background: 'transparent', color: T.red, border: `0.5px solid ${T.red}44`, borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontFamily: SF, fontSize: 11, fontWeight: 600 }}>Remove</button>
                  </div>
                )}
                {/* Permission preview */}
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {window.CortexRBAC.can(m.role, '*') || window.CortexRBAC.perms(m.role)[0] === '*'
                    ? <span style={{ fontFamily: SFMono, fontSize: 9, color: T.green }}>full access</span>
                    : window.CortexRBAC.perms(m.role).slice(0, 6).map(p => <span key={p} style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, background: T.bg3, padding: '2px 6px', borderRadius: 4 }}>{p}</span>)}
                </div>
              </div>
            ))}
          </GroupedList>
        </Section>

        {/* Role reference */}
        <Section title="Role permissions">
          <GroupedList>
            {roles.map((r, i) => (
              <Row key={r} icon={Ic.shield} iconBg={roleC[r] || accent} title={r}
                sub={window.CortexRBAC.perms(r)[0] === '*' ? 'Full access to everything' : window.CortexRBAC.perms(r).join(', ')}
                isLast={i === roles.length - 1}/>
            ))}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

function inp() { return { width: '100%', boxSizing: 'border-box', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 10, padding: '10px 12px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none' }; }

Object.assign(window, { AdminScreen });
