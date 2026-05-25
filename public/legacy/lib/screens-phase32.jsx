// Cortexx — Phase 32: Cmd+K command palette (jump to anywhere)

function CommandPalette({ onClose, accent }) {
  const [q, setQ] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  // All routable destinations
  const ALL = [
    { l: 'Dashboard',     k: 'tab', payload: 'dashboard', i: Ic.dashboard, c: T.blue },
    { l: 'Projects',      k: 'tab', payload: 'projects',  i: Ic.projects,  c: T.blue },
    { l: 'Tasks',         k: 'tab', payload: 'tasks',     i: Ic.tasks,     c: T.purple },
    { l: 'Team',          k: 'tab', payload: 'team',      i: Ic.team,      c: T.cyan },
    { l: 'Global search', k: 'search', i: Ic.search, c: T.cyan },
    { l: 'Ask Cortex AI', k: 'ai',  i: Ic.spark,    c: T.purple },
    { l: 'Improve services & processes', k: 'improve', i: Ic.spark, c: T.purple },
    { l: 'Service catalog', k: 'services', i: Ic.layers, c: T.cyan },
    { l: 'Process library', k: 'processes', i: Ic.book, c: T.cyan },
    { l: 'Kaizen board', k: 'kaizen', i: Ic.flag, c: T.green },
    { l: 'Inbox',         k: 'inbox', i: Ic.inbox,  c: T.blue },
    { l: 'Messages',      k: 'messages', i: Ic.mail, c: T.cyan },
    { l: 'RFIs',          k: 'rfis', i: Ic.alert, c: T.amber },
    { l: 'Reports',       k: 'reports', i: Ic.trend, c: T.green },
    { l: 'Quotes',        k: 'quotes', i: Ic.calc,  c: T.cyan },
    { l: 'New quote (AI Estimator)', k: 'estimator', i: Ic.spark, c: T.purple },
    { l: 'Money',         k: 'money', i: Ic.money, c: T.green },
    { l: 'Timesheets',    k: 'time',  i: Ic.clock, c: T.purple },
    { l: 'Schedule',      k: 'calendar', i: Ic.calendar, c: T.cyan },
    { l: 'Timeline',      k: 'timeline', i: Ic.layers, c: T.blue },
    { l: 'Materials',     k: 'materials', i: Ic.box, c: T.amber },
    { l: 'Subs',          k: 'subs', i: Ic.briefcase, c: T.blue },
    { l: 'Sub invoices',  k: 'subinvoices', i: Ic.receipt, c: T.amber },
    { l: 'Equipment',     k: 'equipment', i: Ic.tool, c: T.t2 },
    { l: 'Documents',     k: 'docs', i: Ic.folder, c: T.red },
    { l: 'Drawings',      k: 'drawings', i: Ic.layers, c: T.blue },
    { l: 'Site diary',    k: 'diary', i: Ic.book, c: T.green },
    { l: 'Snags',         k: 'snags', i: Ic.list, c: T.red },
    { l: 'Variations',    k: 'changes', i: Ic.swap, c: T.purple },
    { l: 'Inspections',   k: 'inspections', i: Ic.check, c: T.green },
    { l: 'Permits',       k: 'permits', i: Ic.shield, c: T.amber },
    { l: 'Goals',         k: 'goals',  i: Ic.flag, c: T.green },
    { l: 'Safety',        k: 'safety', i: Ic.shield, c: T.amber },
    { l: 'Customers',     k: 'customers', i: Ic.team, c: T.blue },
    { l: 'Leads',         k: 'leads',   i: Ic.trend, c: T.cyan },
    { l: 'Photos',        k: 'photos',  i: Ic.camera, c: T.purple },
    { l: 'Mileage',       k: 'mileage', i: Ic.pin, c: T.cyan },
    { l: 'Purchase orders', k: 'pos', i: Ic.receipt, c: T.amber },
    { l: 'Client portal', k: 'portal', i: Ic.share, c: T.green },
    { l: 'Sub portal',    k: 'subportal', i: Ic.briefcase, c: T.purple },
    { l: 'My day',        k: 'myday', i: Ic.sun, c: T.amber },
    { l: 'Reviews',       k: 'reviews', i: Ic.check, c: T.purple },
    { l: 'Activity',      k: 'activity', i: Ic.trend, c: T.green },
    { l: 'Templates',     k: 'templates', i: Ic.copy, c: T.cyan },
    { l: 'Template library', k: 'templatelib', i: Ic.copy, c: T.cyan },
    { l: 'Forms',         k: 'forms', i: Ic.doc, c: T.blue },
    { l: 'Reminders',     k: 'reminders', i: Ic.bell, c: T.purple },
    { l: 'Performance',   k: 'performance', i: Ic.fire, c: T.amber },
    { l: 'Check in/out',  k: 'clock', i: Ic.clock, c: T.green },
    { l: 'Live status',   k: 'livestatus', i: Ic.pin, c: T.cyan },
    { l: 'Voice memo',    k: 'voice', i: Ic.mic, c: T.red },
    { l: 'Tomorrow brief', k: 'tomorrow', i: Ic.sun, c: T.amber },
    { l: 'Cost catalog',  k: 'catalog', i: Ic.box, c: T.cyan },
    { l: 'Saved views',   k: 'views', i: Ic.layers, c: T.cyan },
    { l: 'Tags',          k: 'tags', i: Ic.filter, c: T.amber },
    { l: 'Roles & permissions', k: 'roles', i: Ic.shield, c: T.blue },
    { l: 'Training matrix', k: 'training', i: Ic.hardhat, c: T.amber },
    { l: 'Workspace',     k: 'workspace', i: Ic.briefcase, c: T.blue },
    { l: 'Settings',      k: 'settings', i: Ic.cog, c: T.t2 },
    { l: 'Help & FAQ',    k: 'help', i: Ic.book, c: T.blue },
    { l: 'Profile',       k: 'profile', i: Ic.me, c: T.blue },
    { l: 'Database',      k: 'database', i: Ic.archive, c: T.t2 },
    { l: 'Infrastructure', k: 'infrastructure', i: Ic.zap, c: T.green },
    { l: 'Currency',      k: 'currency', i: Ic.money, c: T.green },
    { l: 'API & developer', k: 'api', i: Ic.zap, c: T.t2 },
    { l: 'Audit trail',   k: 'audittrail', i: Ic.archive, c: T.green },
    { l: 'Take tour',     k: 'tour', i: Ic.book, c: T.purple },
    { l: 'About & legal', k: 'launch', i: Ic.shield, c: T.green },
    { l: 'Backup data',   k: 'database', i: Ic.download, c: T.blue, action: () => window.cortexxBackup?.() },
    { l: 'Add project',   k: 'addproject', i: Ic.plus, c: T.green },
    { l: 'Add task',      k: 'addtask', i: Ic.plus, c: T.purple },
    { l: 'Add team member', k: 'addteam', i: Ic.plus, c: T.cyan },
    { l: 'Add customer',  k: 'addcustomer', i: Ic.plus, c: T.blue },
    { l: 'Add lead',      k: 'addlead', i: Ic.plus, c: T.cyan },
    { l: 'Add material',  k: 'addmaterial', i: Ic.plus, c: T.amber },
    { l: 'Add sub',       k: 'addsub', i: Ic.plus, c: T.blue },
    { l: 'Add equipment', k: 'addequipment', i: Ic.plus, c: T.t2 },
    { l: 'Add snag',      k: 'addsnag', i: Ic.plus, c: T.red },
    { l: 'Add variation', k: 'addchange', i: Ic.plus, c: T.purple },
    { l: 'Add diary entry', k: 'adddiary', i: Ic.plus, c: T.green },
    { l: 'Add RFI',       k: 'addrfi', i: Ic.plus, c: T.amber },
    { l: 'Add goal',      k: 'addgoal', i: Ic.plus, c: T.green },
    { l: 'Add permit',    k: 'addpermit', i: Ic.plus, c: T.amber },
  ];

  const query = q.toLowerCase().trim();
  const results = query
    ? ALL.filter(a => a.l.toLowerCase().includes(query)).slice(0, 12)
    : ALL.slice(0, 8);

  const run = (item) => {
    if (item.action) { item.action(); onClose(); return; }
    if (item.k === 'tab') window.cortexxNav('tab', item.payload);
    else window.cortexxNav(item.k);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[activeIdx] && run(results[activeIdx]); }
    else if (e.key === 'Escape') onClose();
  };

  React.useEffect(() => { setActiveIdx(0); }, [q]);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 60, animation: 'fade 0.15s',
    }}>
      <style>{`@keyframes fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: 380, background: T.bg1,
        borderRadius: 14, border: `0.5px solid ${T.hairStrong}`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `0.5px solid ${T.hair}` }}>
          <span style={{ color: T.t3 }}>{React.cloneElement(Ic.search, { size: 16 })}</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Jump to anywhere…"
            style={{ flex: 1, background: 'transparent', border: 'none', color: T.t1, fontFamily: SF, fontSize: 15, outline: 'none' }}/>
          <span style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, background: T.bg3, padding: '2px 6px', borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
          {results.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>No matches for "{q}"</div>
          )}
          {results.map((r, i) => (
            <button key={r.l} onClick={() => run(r)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                width: '100%', background: i === activeIdx ? T.bg3 : 'transparent',
                border: 'none', padding: '8px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                borderRadius: 8,
              }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: `${r.c}22`, color: r.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {React.cloneElement(r.i, { size: 14 })}
              </div>
              <span style={{ flex: 1, fontFamily: SF, fontSize: 14, color: T.t1, fontWeight: 500 }}>{r.l}</span>
              {i === activeIdx && <span style={{ fontFamily: SFMono, fontSize: 9, color: T.t3, background: T.bg2, padding: '2px 6px', borderRadius: 4 }}>↵</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: `0.5px solid ${T.hair}`, display: 'flex', justifyContent: 'space-between', fontFamily: SFMono, fontSize: 10, color: T.t3 }}>
          <span>↑↓ navigate · ↵ open</span>
          <span>{results.length} of {ALL.length}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
