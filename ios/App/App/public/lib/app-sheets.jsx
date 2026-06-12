// Cortexx — sheets (Project detail, Capture, AI, Settings)

// Sheet shell with grabber
function Sheet({ onClose, height = '92%', children, fullscreen = false }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'flex-end',
      animation: 'sheet-fade 0.2s',
    }} onClick={onClose}>
      <div style={{
        width: '100%', height: fullscreen ? '100%' : height,
        background: T.bg0,
        borderRadius: fullscreen ? 0 : '20px 20px 0 0',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        animation: 'sheet-slide 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }} onClick={e => e.stopPropagation()}>
        {!fullscreen && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 5, borderRadius: 3, background: T.hairStrong }}/>
          </div>
        )}
        {children}
      </div>
      <style>{`
        @keyframes sheet-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sheet-slide { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT DETAIL SHEET
// ═══════════════════════════════════════════════════════════════════
function ProjectSheet({ project, onClose, accent }) {
  const [tab, setTab] = React.useState('Overview');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(project);
  React.useEffect(() => { setDraft(project); }, [project?.id]);
  const tabs = ['Overview', 'Tasks', 'Photos', 'Money', 'Docs'];
  const team = useDB('team');
  const tasks = useDB('tasks');
  const invoices = useDB('invoices');
  if (!project) return null;
  const projectTeam = team.filter(m => m.site === project.name || m.site === project.addr?.split(',')[0] || m.site.includes(project.name.split(' ')[0]));
  const projectTasks = tasks.filter(t => t.projectId == project.id);
  const projectInvoices = invoices.filter(iv => iv.projectId == project.id);

  return (
    <Sheet onClose={onClose}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Project</div>
        <button onClick={() => { window.cortexxNav('health', project); }} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          {React.cloneElement(Ic.spark, { size: 13 })} Health
        </button>
        <button style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, fontWeight: 600, cursor: 'pointer' }} onClick={async () => {
          if (editing) {
            await Backend.db.projects.update(project.id, {
              name: draft.name, client: draft.client, addr: draft.addr,
              value: parseInt(draft.value) || project.value, status: draft.status,
              pct: parseInt(draft.pct) || project.pct,
            });
            toast('Project updated', 'success');
            setEditing(false);
          } else {
            setEditing(true);
          }
        }}>{editing ? 'Save' : 'Edit'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Hero */}
        <div style={{ padding: '4px 20px 16px' }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormInput label="Name" v={draft.name} onChange={v => setDraft({...draft, name: v})}/>
              <FormInput label="Client" v={draft.client} onChange={v => setDraft({...draft, client: v})}/>
              <FormInput label="Address" v={draft.addr} onChange={v => setDraft({...draft, addr: v})}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <FormInput label="Value (£)" v={String(draft.value)} type="number" onChange={v => setDraft({...draft, value: v})}/>
                <FormInput label="Progress %" v={String(draft.pct)} type="number" onChange={v => setDraft({...draft, pct: v})}/>
                <FormSelect label="Status" v={draft.status} onChange={v => setDraft({...draft, status: v})} options={[
                  {v:'quoting',l:'Quoting'},{v:'active',l:'Active'},{v:'snagging',l:'Snagging'},{v:'complete',l:'Complete'}
                ]}/>
              </div>
            </div>
          ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Pill c={STATUS_C[project.status]}>{project.status}</Pill>
              <div style={{ fontFamily: SF, fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: -0.5, marginTop: 8, lineHeight: 1.15 }}>{project.name}</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 4 }}>{project.client} · {project.addr}</div>
            </div>
            <div style={{
              width: 64, height: 64, borderRadius: 14,
              background: `conic-gradient(${STATUS_C[project.status]} ${project.pct*3.6}deg, ${T.bg3} 0)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', inset: 5, borderRadius: 11, background: T.bg0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SFMono, fontSize: 16, fontWeight: 700, color: T.t1,
              }}>{project.pct}%</div>
            </div>
          </div>
          )}

          {!editing && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              { l: 'Value', v: fmt(project.value), c: T.t1 },
              { l: 'Margin', v: project.margin > 0 ? project.margin + '%' : '—', c: T.green },
              { l: 'Team', v: project.team || '—', c: accent },
              { l: 'Due', v: formatDue(project.due, project.status), c: T.amber },
            ].map((s, i) => (
              <div key={i} style={{ background: T.bg2, borderRadius: 10, padding: '8px 10px', border: `0.5px solid ${T.hair}` }}>
                <div style={{ fontFamily: SF, fontSize: 9, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.l}</div>
                <div style={{ fontFamily: SFMono, fontSize: 14, color: s.c, fontWeight: 700, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>}
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 16px', display: 'flex', gap: 4, borderBottom: `0.5px solid ${T.hair}`, position: 'sticky', top: 0, background: T.bg0, zIndex: 5 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none',
              padding: '10px 12px',
              fontFamily: SF, fontSize: 13, fontWeight: 600,
              color: tab === t ? T.t1 : T.t2,
              borderBottom: tab === t ? `2px solid ${accent}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '14px 0' }}>
          {tab === 'Overview' && <>
            <Section title="Milestones">
              <GroupedList>
                {[
                  { t: 'Strip-out & demo', s: 'Apr 8 · 3 days', state: 'done' },
                  { t: 'First fix electrical', s: 'Apr 18 · 8 days', state: 'done' },
                  { t: 'Plastering', s: 'In progress · 4 days left', state: 'active' },
                  { t: 'Second fix + finishes', s: 'May 7-15', state: 'pending' },
                  { t: 'Snagging & handover', s: 'May 18-22', state: 'pending' },
                ].map((m,i,a)=>(
                  <Row
                    key={i}
                    icon={m.state === 'done' ? Ic.check : Ic.clock}
                    iconBg={m.state === 'done' ? T.green : m.state === 'active' ? accent : T.t3}
                    title={m.t}
                    sub={m.s}
                    right={m.state === 'active' ? <Pill c={accent} size="xs">NOW</Pill> : null}
                    isLast={i === a.length - 1}
                  />
                ))}
              </GroupedList>
            </Section>
            <Section title="Team on site">
              <div style={{ display: 'flex', gap: 10 }}>
                {projectTeam.slice(0, 4).map((p, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <Avatar name={p.n} size={44} c={p.color}/>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t1, fontWeight: 600, marginTop: 6 }}>{p.n.split(' ')[0]}</div>
                    <div style={{ fontFamily: SF, fontSize: 10, color: T.t2 }}>{p.r}</div>
                  </div>
                ))}
                {projectTeam.length === 0 && (
                  <div style={{ flex: 1, padding: '20px 0', textAlign: 'center', fontFamily: SF, fontSize: 12, color: T.t3 }}>No one assigned yet</div>
                )}
                {projectTeam.length > 0 && projectTeam.length < 4 && Array.from({length: 4 - projectTeam.length}).map((_,i) => <div key={`s${i}`} style={{ flex: 1 }}/>)}
              </div>
            </Section>
            <Section title="Recent activity">
              <GroupedList>
                <Row icon={Ic.camera} iconBg={T.blue} title="Tom uploaded 4 photos" sub="First-fix kitchen · 12 min ago"/>
                <Row icon={Ic.check} iconBg={T.green} title="Aisha completed first-fix electrics" sub="2 hours ago"/>
                <Row icon={Ic.receipt} iconBg={T.amber} title="£342 Travis Perkins receipt" sub="Plasterboard order · yesterday" isLast/>
              </GroupedList>
            </Section>
          </>}

          {tab === 'Tasks' && <Section title={`Tasks · ${projectTasks.filter(t=>!t.done).length} open`}>
            <GroupedList>
              {projectTasks.length === 0 && <div style={{ padding: 20, fontFamily: SF, fontSize: 13, color: T.t3, textAlign: 'center' }}>No tasks yet</div>}
              {projectTasks.map((task, i, a) => (
                <Row
                  key={task.id}
                  icon={task.done ? Ic.check : Ic.clock}
                  iconBg={task.done ? T.green : PRIO_C[task.prio]}
                  title={task.t}
                  sub={`${task.assignee} · ${formatTaskWhen(task.due)}`}
                  isLast={i === a.length - 1}
                  onClick={() => Backend.db.tasks.update(task.id, { done: !task.done })}
                />
              ))}
            </GroupedList>
          </Section>}

          {tab === 'Photos' && <div style={{ padding: '0 16px' }}>
            <button onClick={() => window.cortexxNav('photos')} style={{
              width: '100%', background: T.bg2, border: `0.5px dashed ${T.hairMid}`,
              color: T.t1, borderRadius: 12, padding: '14px',
              fontFamily: SF, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginBottom: 10,
            }}>{React.cloneElement(Ic.camera, { size: 14 })} Upload photo to {project.name.split(' ')[0]}</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{
                  aspectRatio: '1',
                  background: `linear-gradient(135deg, ${['#1a3a5c','#2c4a3e','#3a2c5c','#5c3a2c','#2c3a5c','#3a5c2c'][i%6]}, ${T.bg2})`,
                  borderRadius: 6, border: `0.5px solid ${T.hair}`, position: 'relative', overflow: 'hidden',
                }}>
                  <svg width="100%" height="100%" viewBox="0 0 60 60" style={{ opacity: 0.3 }}>
                    <rect x="10" y="20" width="40" height="30" fill="none" stroke="#fff" strokeWidth="0.5"/>
                    <line x1="10" y1="35" x2="50" y2="35" stroke="#fff" strokeWidth="0.5"/>
                  </svg>
                  <div style={{ position: 'absolute', bottom: 4, right: 4, fontFamily: SFMono, fontSize: 8, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 3 }}>{16+i}:0{i%9}</div>
                </div>
              ))}
            </div>
          </div>}

          {tab === 'Money' && <>
            <Section title="Cashflow">
              <div style={{
                background: T.bg2, borderRadius: 14, padding: 14, border: `0.5px solid ${T.hair}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Margin</div>
                    <div style={{ fontFamily: SFMono, fontSize: 24, color: T.green, fontWeight: 700, letterSpacing: -0.5 }}>{project.margin}%</div>
                    <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>vs quoted 26.5%</div>
                  </div>
                  <svg width="100" height="50" viewBox="0 0 100 50">
                    <polyline points="0,40 14,38 28,30 42,28 56,32 70,20 84,18 100,10" fill="none" stroke={T.green} strokeWidth="2"/>
                  </svg>
                </div>
              </div>
            </Section>
            <Section title={`Invoices · ${projectInvoices.length}`}>
              <GroupedList>
                {projectInvoices.length === 0 && <div style={{ padding: 20, fontFamily: SF, fontSize: 13, color: T.t3, textAlign: 'center' }}>No invoices yet</div>}
                {projectInvoices.map((iv, i, a) => {
                  const c = iv.status === 'paid' ? T.green : iv.status === 'overdue' ? T.red : T.amber;
                  return (
                    <Row key={iv.id}
                      icon={Ic.doc} iconBg={c}
                      title={`${iv.id} · ${fmt(iv.amount)}${iv.retentionPct ? ' · ' + (iv.retentionPct*100).toFixed(1) + '% ret' : ''}`}
                      sub={iv.status === 'paid' ? `Paid ${formatTaskWhen(iv.paid)}` : `${iv.status} · ${formatTaskWhen(iv.due)}`}
                      right={iv.status === 'paid' ? <span style={{ fontFamily: SFMono, fontSize: 11, color: c, fontWeight: 700, textTransform: 'uppercase' }}>{iv.status}</span> : (
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <button onClick={(e)=>{e.stopPropagation(); window.__cortexxRetentionInv=iv.id; if(window.cortexxNav) window.cortexxNav('retentioninv');}}
                            style={{ padding:'5px 8px', borderRadius: 6, border:'1px solid '+T.hair, background:T.bg1, color:T.t2, fontFamily: SF, fontSize: 10, fontWeight: 700, textTransform:'uppercase', letterSpacing: 0.4, cursor:'pointer' }}>Ret</button>
                          <button onClick={(e)=>{e.stopPropagation(); if(window.cortexxNav) window.cortexxNav('payinvoice:'+iv.id);}}
                            style={{ padding:'5px 10px', borderRadius: 6, border:'1px solid '+T.hair, background:c, color:'#fff', fontFamily: SF, fontSize: 11, fontWeight: 700, textTransform:'uppercase', letterSpacing: 0.4, cursor:'pointer' }}>Pay</button>
                        </div>
                      )}
                      isLast={i === a.length - 1}/>
                  );
                })}
              </GroupedList>
            </Section>
          </>}

          {tab === 'Docs' && <Section title="Project documents">
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button onClick={() => window.cortexxNav('upload')} style={{
                flex: 1, background: T.bg2, border: `0.5px dashed ${T.hairMid}`,
                color: T.t1, borderRadius: 10, padding: '10px',
                fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>{React.cloneElement(Ic.upload, { size: 13 })} Document</button>
              <button onClick={() => window.cortexxNav('drawings')} style={{
                flex: 1, background: T.bg2, border: `0.5px dashed ${T.hairMid}`,
                color: T.t1, borderRadius: 10, padding: '10px',
                fontFamily: SF, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>{React.cloneElement(Ic.layers, { size: 13 })} Drawing</button>
            </div>
            <GroupedList>
              {[
                { n: 'RAMS_Camden_v3.pdf', s: '2.4 MB · Updated 2 days ago' },
                { n: 'Building_Reg_Approval.pdf', s: '890 KB' },
                { n: 'Quote_Final_Signed.pdf', s: '1.1 MB' },
                { n: 'Material_Order_W17.xlsx', s: '34 KB' },
                { n: 'Floor_plans_v2.dwg', s: '4.2 MB' },
              ].map((f, i, a) => (
                <Row key={i} icon={Ic.doc} iconBg={T.red} title={f.n} sub={f.s} isLast={i === a.length - 1} onClick={() => toast(`Opening ${f.n}…`, 'info')}/>
              ))}
            </GroupedList>
          </Section>}
        </div>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CAPTURE SHEET
// ═══════════════════════════════════════════════════════════════════
function CaptureSheet({ onClose, accent, onAction }) {
  const unread = useComputed('unreadNotifications');
  const pendingTS = useComputed('pendingTimesheets');
  const lowStock = useComputed('lowStock');
  const openSnags = useComputed('openSnags');
  const pendingCO = useComputed('pendingChanges');
  const openRFIs = useComputed('openRFIs');
  const unreadMsgs = useComputed('unreadMessages');
  const captureOpts = [
    { k: 'smartparse', t: 'Smart parse',         d: 'Paste anything → structured records', i: Ic.spark, c: T.purple, ai: true },
    { k: 'triage',   t: 'Inbox triage',          d: 'Email in → categorised + filed',  i: Ic.spark,   c: T.purple, ai: true },
    { k: 'task',     t: 'New task',              d: 'Quick add to your queue',        i: Ic.tasks,   c: T.purple },
    { k: 'estimate', t: 'AI estimate',           d: 'Brief in → quote out',           i: Ic.calc,    c: T.blue, ai: true },
    { k: 'photomention', t: 'Photo → actions',   d: 'Drop a photo · AI extracts tasks/snags/RFIs', i: Ic.camera, c: T.cyan, ai: true },
    { k: 'photo',    t: 'Site progress photo',   d: 'Geo-tagged · added to project',  i: Ic.camera,  c: T.blue },
    { k: 'phototosnag', t: 'Snag from photo',    d: 'AI detects defects · auto-files',i: Ic.alert,   c: T.amber, ai: true },
    { k: 'receipt',  t: 'Scan receipt',          d: 'AI OCR + auto-file',             i: Ic.receipt, c: T.amber, ai: true },
    { k: 'voice',    t: 'Voice note / RFI',      d: 'Transcribed by Cortex',          i: Ic.mic,     c: T.cyan },
    { k: 'checkin',  t: 'Site check-in',         d: 'GPS verified · logs hours',      i: Ic.pin,     c: T.green },
    { k: 'attendance', t: 'On site now',         d: 'Live attendance board',          i: Ic.team || Ic.users, c: T.green },
    { k: 'nfctags',  t: 'NFC site tags',         d: 'Tap-to-check-in at the gate',    i: Ic.pin,     c: T.cyan },
    { k: 'labels',   t: 'Label printer',         d: 'Delivery, asset & QR labels',    i: Ic.print || Ic.doc, c: T.cyan },
    { k: 'sitemap',  t: 'Site map',              d: 'Offline map + markup',           i: Ic.pin || Ic.map, c: T.green },
    { k: 'incident', t: 'Report incident',       d: 'Notify HSE if required',         i: Ic.alert,   c: T.red },
  ];
  const appGroups = [
    { title: '◆ Inbox & comms', items: [
      { k: 'inbox',     t: 'Inbox',         i: Ic.inbox,    c: T.blue,   badge: unread },
      { k: 'messages',  t: 'Messages',      i: Ic.mail,     c: T.cyan,   badge: unreadMsgs },
      { k: 'rfis',      t: 'RFIs',          i: Ic.alert,    c: T.amber,  badge: openRFIs },
      { k: 'ai',        t: 'Ask Cortex',    i: Ic.spark,    c: T.purple, ai: true },
    ]},
    { title: '◆ Sales & CRM', items: [
      { k: 'leads',     t: 'Leads',         i: Ic.trend,    c: T.cyan,   badge: useComputed('newLeads') },
      { k: 'customers', t: 'Customers',     i: Ic.team,     c: T.blue },
      { k: 'quotes',    t: 'Quotes',        i: Ic.calc,     c: T.cyan },
      { k: 'portal',    t: 'Client view',   i: Ic.share,    c: T.green },
    ]},
    { title: '◆ Project & site', items: [
      { k: 'timeline',  t: 'Timeline',      i: Ic.layers,   c: T.blue },
      { k: 'calendar',  t: 'Schedule',      i: Ic.calendar, c: T.cyan },
      { k: 'diary',     t: 'Site diary',    i: Ic.book,     c: T.green },
      { k: 'photos',    t: 'Photos',        i: Ic.camera,   c: T.purple },
      { k: 'photoreview', t: 'Photo review', i: Ic.check,    c: T.green },
      { k: 'drawings',  t: 'Drawings',      i: Ic.layers,   c: T.blue },
      { k: 'docs',      t: 'Documents',     i: Ic.folder,   c: T.red },
      { k: 'snags',     t: 'Snags',         i: Ic.list,     c: T.red, badge: openSnags },
      { k: 'changes',   t: 'Variations',    i: Ic.swap,     c: T.purple, badge: pendingCO },
    ]},
    { title: '◆ Money & ops', items: [
      { k: 'money',     t: 'Money',         i: Ic.money,    c: T.green },
      { k: 'pos',       t: 'POs',           i: Ic.receipt,  c: T.amber, badge: useComputed('openPOs') },
      { k: 'subinvoices', t: 'Sub invoices', i: Ic.receipt, c: T.amber, badge: useComputed('pendingSubInvoices') },
      { k: 'materials', t: 'Materials',     i: Ic.box,      c: T.amber, badge: lowStock, badgeC: T.red },
      { k: 'subs',      t: 'Subs',          i: Ic.briefcase, c: T.blue },
      { k: 'equipment', t: 'Equipment',     i: Ic.tool,     c: T.t2 },
      { k: 'catalog',   t: 'Cost catalog',  i: Ic.box,      c: T.cyan },
      { k: 'mileage',   t: 'Mileage',       i: Ic.pin,      c: T.cyan },
    ]},
    { title: '◆ People & time', items: [
      { k: 'time',      t: 'Timesheets',    i: Ic.clock,    c: T.purple, badge: pendingTS },
      { k: 'clock',     t: 'Check in/out',  i: Ic.clock,    c: T.green },
      { k: 'livestatus', t: 'Live status',  i: Ic.pin,      c: T.cyan },
      { k: 'training',  t: 'Training',      i: Ic.hardhat,  c: T.amber, badge: useComputed('certExpiring') },
      { k: 'roles',     t: 'Roles',         i: Ic.shield,   c: T.blue },
      { k: 'subportal', t: 'Sub portal',    i: Ic.briefcase, c: T.purple },
    ]},
    { title: '◆ Safety & compliance', items: [
      { k: 'safety',    t: 'Safety',        i: Ic.shield,   c: T.amber },
      { k: 'permits',   t: 'Permits',       i: Ic.shield,   c: T.amber },
      { k: 'inspections', t: 'Inspections', i: Ic.check,    c: T.green, badge: useComputed('openInspections') },
      { k: 'audittrail', t: 'Audit trail',  i: Ic.archive,  c: T.green },
    ]},
    { title: '◆ AI & insights', items: [
      { k: 'vera',      t: 'Vera CEO',      i: Ic.star,     c: T.purple, ai: true },
      { k: 'veraauto',  t: 'Vera autopilot', i: Ic.zap,     c: T.purple, ai: true },
      { k: 'personas',  t: 'Leadership',    i: Ic.team,     c: T.purple, ai: true },
      { k: 'improve',   t: 'Improve',       i: Ic.spark,    c: T.purple, ai: true },
      { k: 'services',  t: 'Services',      i: Ic.layers,   c: T.cyan },
      { k: 'processes', t: 'Processes',     i: Ic.book,     c: T.cyan },
      { k: 'kaizen',    t: 'Kaizen',        i: Ic.flag,     c: T.green },
      { k: 'reports',   t: 'Reports',       i: Ic.trend,    c: T.green, ai: true },
      { k: 'tomorrow',  t: 'Tomorrow',      i: Ic.sun,      c: T.amber, ai: true },
      { k: 'performance', t: 'Performance', i: Ic.fire,     c: T.amber },
      { k: 'goals',     t: 'Goals',         i: Ic.flag,     c: T.green },
      { k: 'activity',  t: 'Activity',      i: Ic.trend,    c: T.green },
      { k: 'reviews',   t: 'Reviews',       i: Ic.check,    c: T.purple },
      { k: 'aihistory', t: 'AI history',    i: Ic.spark,    c: T.purple, ai: true },
      { k: 'myday',     t: 'My day',        i: Ic.sun,      c: T.amber },
    ]},
    { title: '◆ Intelligence (v1.7)', items: [
      { k: 'resourceplan', t: 'Resourcing',  i: Ic.calendar, c: T.blue },
      { k: 'finintel',  t: 'Fin. intel',     i: Ic.trend,    c: T.green, ai: true },
      { k: 'bids',      t: 'Bids & tender',  i: Ic.briefcase, c: T.purple },
      { k: 'procurement', t: 'Procurement',  i: Ic.receipt,  c: T.amber },
      { k: 'handover',  t: 'Quality',        i: Ic.shield,   c: T.cyan },
      { k: 'hscommand', t: 'H&S centre',     i: Ic.hardhat,  c: T.red },
      { k: 'clientexp', t: 'Client XP',      i: Ic.star,     c: T.green },
    ]},
    { title: '◆ Tools', items: [
      { k: 'templates', t: 'Templates',     i: Ic.copy,     c: T.cyan },
      { k: 'templatelib', t: 'Tpl library', i: Ic.copy,     c: T.cyan },
      { k: 'forms',     t: 'Forms',         i: Ic.doc,      c: T.blue },
      { k: 'tags',      t: 'Tags',          i: Ic.filter,   c: T.amber },
      { k: 'views',     t: 'Saved views',   i: Ic.layers,   c: T.cyan },
      { k: 'reminders', t: 'Reminders',     i: Ic.bell,     c: T.purple },
      { k: 'upload',    t: 'Upload',        i: Ic.upload,   c: T.cyan },
      { k: 'voice',     t: 'Voice memo',    i: Ic.mic,      c: T.red, ai: true },
    ]},
    { title: '◆ System', items: [
      { k: 'bank',      t: 'Banking',       i: Ic.money,    c: T.green },
      { k: 'payroll',   t: 'Payroll',       i: Ic.money,    c: T.green },
      { k: 'holiday',   t: 'Holiday',       i: Ic.sun,      c: T.amber },
      { k: 'apprentice', t: 'Apprentices',  i: Ic.hardhat,  c: T.purple },
      { k: 'carbon',    t: 'Carbon',        i: Ic.cloud,    c: T.green },
      { k: 'waste',     t: 'Waste',         i: Ic.archive,  c: T.amber },
      { k: 'claims',    t: 'Claims',        i: Ic.shield,   c: T.red },
      { k: 'workspace', t: 'Workspace',     i: Ic.briefcase, c: T.blue },
      { k: 'tenant',    t: 'Workspaces',    i: Ic.layers,   c: T.purple },
      { k: 'admin',     t: 'Org admin',     i: Ic.shield,   c: T.blue },
      { k: 'billing',   t: 'Billing',       i: Ic.money,    c: T.green },
      { k: 'auditlog',  t: 'Audit log',     i: Ic.archive,  c: T.purple },
      { k: 'dataexport', t: 'Export data',  i: Ic.download, c: T.cyan },
      { k: 'ledger',    t: 'Ledger export', i: Ic.receipt,  c: T.green },
      { k: 'notifprefs', t: 'Notifications', i: Ic.bell,    c: T.blue },
      { k: 'digests',   t: 'Digests',       i: Ic.send,    c: T.purple },
      { k: 'newworkspace', t: 'New workspace', i: Ic.plus,  c: accent },
      { k: 'sso',       t: 'Sign in / SSO', i: Ic.shield,   c: T.blue },
      { k: 'cloudsync', t: 'Cloud sync',    i: Ic.zap,      c: T.cyan },
      { k: 'aiengine',  t: 'AI engine',     i: Ic.spark,    c: T.purple },
      { k: 'payinvoice',t: 'Pay invoice',   i: Ic.money,    c: T.green },
      { k: 'bankrec',   t: 'Bank reconciliation', i: Ic.zap, c: T.cyan },
      { k: 'pushset',   t: 'Push notifications', i: Ic.bell,  c: T.amber },
      { k: 'e2ee',      t: 'End-to-end encryption', i: Ic.shield, c: T.purple },
      { k: 'cis300',    t: 'CIS300 return',      i: Ic.money,    c: T.green },
      { k: 'language',  t: 'Language',           i: Ic.book,     c: T.blue },
      { k: 'riddor',    t: 'RIDDOR report',      i: Ic.shield,   c: T.red },
      { k: 'retention', t: 'Retention ledger',   i: Ic.money,    c: T.amber },
      { k: 'subscription', t: 'Subscription',    i: Ic.spark,    c: T.purple },
      { k: 'observability', t: 'Observability', i: Ic.zap,       c: T.cyan },
      { k: 'currency',  t: 'Currency',      i: Ic.money,    c: T.green },
      { k: 'database',  t: 'Database',      i: Ic.archive,  c: T.t2 },
      { k: 'infrastructure', t: 'Infra',    i: Ic.zap,      c: T.green },
      { k: 'api',       t: 'API',           i: Ic.zap,      c: T.t2 },
      { k: 'settings',  t: 'Settings',      i: Ic.cog,      c: T.t2 },
      { k: 'help',      t: 'Help',          i: Ic.book,     c: T.blue },
      { k: 'profile',   t: 'Me',            i: Ic.me,       c: T.blue },
      { k: 'tour',      t: 'Take tour',     i: Ic.book,     c: T.purple },
      { k: 'launch',    t: 'About & legal', i: Ic.shield,   c: T.green },
    ]},
  ];
  const AppTile = ({ a }) => a.k === '_blank' ? <div/> : (
    <button onClick={() => onAction(a.k)} style={{
      background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 14,
      padding: '12px 8px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      position: 'relative', minHeight: 76,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${a.c}22`, color: a.c,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{React.cloneElement(a.i, { size: 20 })}</div>
      <span style={{ fontFamily: SF, fontSize: 11, fontWeight: 600, color: T.t1 }}>{a.t}</span>
      {a.ai && (
        <span style={{
          position: 'absolute', top: 5, left: 5,
          fontFamily: SF, fontSize: 8, fontWeight: 700, color: T.purple,
          letterSpacing: 0.4,
        }}>AI</span>
      )}
      {a.badge > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 8, background: a.badgeC || T.red, color: '#fff',
          fontFamily: SF, fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{a.badge}</span>
      )}
    </button>
  );
  return (
    <Sheet onClose={onClose} height="92%">
      <div style={{ padding: '8px 20px 14px', textAlign: 'center', fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1 }}>Quick actions</div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        {/* Capture group */}
        <div style={{ padding: '0 20px 8px', fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>Capture</div>
        <div style={{ padding: '0 16px 18px' }}>
          <GroupedList>
            {captureOpts.map((o, i, a) => (
              <Row key={o.k} icon={o.i} iconBg={o.c} title={o.t}
                sub={o.d}
                right={o.ai && <span style={{ color: T.purple, fontSize: 10, fontFamily: SF, fontWeight: 600 }}>AI</span>}
                isLast={i === a.length - 1}
                onClick={() => onAction ? onAction(o.k) : onClose()}/>
            ))}
          </GroupedList>
        </div>

        {/* Apps grid — filtered by the active member's role permissions */}
        <div style={{ padding: '0 20px 8px', fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}>All apps</div>
        {appGroups.map((g, gi) => {
          const items = (window.__cortexxRoleFilter ? g.items.filter(window.__cortexxRoleFilter) : g.items);
          if (items.length === 0) return null;
          return (
          <div key={gi} style={{ marginBottom: 16 }}>
            <div style={{ padding: '0 20px 8px', fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, letterSpacing: 0.4 }}>{g.title}</div>
            <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {items.map((a) => <AppTile key={a.k} a={a}/>)}
            </div>
          </div>
          );
        })}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AI SHEET — uses window.claude.complete
// ═══════════════════════════════════════════════════════════════════
function AISheet({ onClose, accent }) {
  const [messages, setMessages] = React.useState([
    { who: 'ai', t: "Morning Adrian. Camden is on track for Friday handover. You're £8.4k up this week. What can I help you decide?" },
  ]);
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [tier, setTier] = React.useState(null);
  const [listening, setListening] = React.useState(false);
  const [speakingIdx, setSpeakingIdx] = React.useState(null);
  const recogRef = React.useRef(null);

  const speak = (text, idx) => {
    if (!('speechSynthesis' in window)) { toast('Text-to-speech not supported here', 'info'); return; }
    if (speakingIdx === idx) { window.speechSynthesis.cancel(); setSpeakingIdx(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; u.rate = 1.02; u.pitch = 1;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  };
  const scrollRef = React.useRef(null);

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice input not supported on this device', 'info'); return; }
    if (listening) { recogRef.current && recogRef.current.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = 'en-GB'; r.interimResults = true; r.continuous = false;
    r.onresult = (e) => {
      const txt = Array.from(e.results).map(x => x[0].transcript).join('');
      setInput(txt);
    };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); toast('Voice input stopped', 'info'); };
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  const suggestions = [
    "What's my margin on Camden so far?",
    "Forecast next month's cashflow",
    "Who's available to cover Brixton?",
  ];

  const send = async (text) => {
    if (!text.trim() || thinking) return;
    const userMsg = { who: 'user', t: text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setThinking(true);

    try {
      const agent = window.CortexLocalAgent;
      const response = agent ? await agent.respond(text) : await Backend.ai.ask(text);
      if (agent) {
        const st = agent.status();
        setTier(st.cloud ? 'cloud' : st.webllm ? 'webllm' : 'local');
      }
      setMessages(m => [...m, { who: 'ai', t: response }]);
    } catch (e) {
      // Last-resort floor — never leaves the user hanging
      const fallback = window.CortexLocalAgent ? await window.CortexLocalAgent.respond(text) : "Here's what I can see — ask me about cash, projects, tasks, or team.";
      setTier('local');
      setMessages(m => [...m, { who: 'ai', t: fallback }]);
    }
    setThinking(false);
  };

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}` }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{React.cloneElement(Ic.spark, { size: 13 })}</div>
            <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Cortex AI</div>
          </div>
          <div style={{ fontFamily: SF, fontSize: 11, fontWeight: 500, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            color: tier === 'local' ? T.amber : tier === 'webllm' ? T.cyan : T.green }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }}/>
            {tier === 'local' ? 'On-device · offline ready' : tier === 'webllm' ? 'Local model' : tier === 'cloud' ? 'Cloud · online' : 'Ready · never offline'}
          </div>
        </div>
        <div style={{ width: 50 }}/>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: m.who === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              background: m.who === 'user' ? accent : T.bg2,
              color: m.who === 'user' ? '#fff' : T.t1,
              borderRadius: 18,
              borderBottomRightRadius: m.who === 'user' ? 4 : 18,
              borderBottomLeftRadius: m.who === 'ai' ? 4 : 18,
              padding: '10px 14px',
              fontFamily: SF, fontSize: 14, lineHeight: 1.45,
              border: m.who === 'ai' ? `0.5px solid ${T.hair}` : 'none',
              whiteSpace: 'pre-wrap',
            }}>{m.t}</div>
            {m.who === 'ai' && (
              <button onClick={() => speak(m.t, i)} title="Read aloud" style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', marginTop: 2,
                color: speakingIdx === i ? accent : T.t3, fontFamily: SF, fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>{React.cloneElement(Ic.mic, { size: 12 })} {speakingIdx === i ? 'Stop' : 'Read aloud'}</button>
            )}
          </div>
        ))}
        {thinking && (
          <div style={{
            alignSelf: 'flex-start', background: T.bg2, borderRadius: 18, borderBottomLeftRadius: 4,
            padding: '12px 14px', border: `0.5px solid ${T.hair}`,
            display: 'flex', gap: 4, alignItems: 'center',
          }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 7, height: 7, borderRadius: 4, background: T.t2,
                animation: `bounce 1.4s infinite ${i * 0.15}s`,
              }}/>
            ))}
            <style>{`@keyframes bounce { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
          </div>
        )}
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{
                background: T.bg2, border: `0.5px solid ${T.hairMid}`,
                color: T.blueL, padding: '8px 14px', borderRadius: 12,
                fontFamily: SF, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                textAlign: 'left',
              }}>{s}</button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={e => { e.preventDefault(); send(input); }}
        style={{ padding: '8px 12px 30px', borderTop: `0.5px solid ${T.hair}`, display: 'flex', gap: 8, alignItems: 'center', background: T.bg0 }}>
        <button type="button" onClick={toggleVoice} title="Voice input" style={{
          width: 36, height: 36, borderRadius: 18, flexShrink: 0,
          background: listening ? T.red : T.bg2,
          border: `0.5px solid ${listening ? T.red : T.hairMid}`,
          color: listening ? '#fff' : T.t2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: listening ? 'micpulse 1.2s infinite' : 'none',
        }}>{React.cloneElement(Ic.mic, { size: 16 })}</button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={listening ? 'Listening…' : 'Ask Cortex anything…'}
          style={{
            flex: 1, background: T.bg2, border: `0.5px solid ${listening ? T.red + '66' : T.hairMid}`, borderRadius: 18,
            padding: '10px 14px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none',
          }}
        />
        <button type="submit" disabled={!input.trim() || thinking} style={{
          width: 36, height: 36, borderRadius: 18, flexShrink: 0,
          background: input.trim() && !thinking ? accent : T.bg3, border: 'none',
          color: '#fff', cursor: input.trim() && !thinking ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: input.trim() && !thinking ? 1 : 0.5,
        }}>{React.cloneElement(Ic.send, { size: 16 })}</button>
        <style>{`@keyframes micpulse { 0%,100% { box-shadow: 0 0 0 0 ${T.red}66 } 50% { box-shadow: 0 0 0 6px ${T.red}00 } }`}</style>
      </form>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SAFETY SHEET (accessible from header on dashboard)
// ═══════════════════════════════════════════════════════════════════
function SafetySheet({ onClose, accent }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 10px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 16, cursor: 'pointer' }}>Close</button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>Safety & H&S</div>
        <div style={{ width: 50 }}/>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
        <div style={{ padding: '8px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.green}33, ${T.green}11)`,
            border: `0.5px solid ${T.green}55`, borderRadius: 16, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: T.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {React.cloneElement(Ic.shield, { size: 24 })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SFMono, fontSize: 32, fontWeight: 700, color: T.t1, letterSpacing: -1, lineHeight: 1 }}>92<span style={{ fontSize: 16, color: T.t2 }}>/100</span></div>
              <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 4 }}>Safety score · last 30d</div>
            </div>
          </div>
        </div>
        <Section title="Action needed">
          <GroupedList>
            <Row icon={Ic.alert} iconBg={T.amber} title="Camden RAMS expires" sub="Sat 2 May · sign-off required"/>
            <Row icon={Ic.alert} iconBg={T.amber} title="Sara Khan CSCS expires" sub="In 6 weeks · book renewal" isLast/>
          </GroupedList>
        </Section>
        <Section title="Recent">
          <GroupedList>
            <Row icon={Ic.check} iconBg={T.green} title="Toolbox talk delivered" sub="Camden · 4 attended · this morning"/>
            <Row icon={Ic.check} iconBg={T.green} title="Brixton site induction" sub="Lila Owusu · 2 days ago"/>
            <Row icon={Ic.doc} iconBg={T.blue} title="Q1 incident report" sub="0 RIDDOR · 1 near-miss logged" isLast/>
          </GroupedList>
        </Section>
        <Section title="Quick actions">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { l: 'Report incident', i: Ic.alert, c: T.red },
              { l: 'New RAMS', i: Ic.doc, c: T.blue },
              { l: 'Toolbox talk', i: Ic.team, c: T.amber },
              { l: 'Site induction', i: Ic.hardhat, c: T.green },
            ].map((a, i) => (
              <button key={i} style={{
                background: T.bg2, border: `0.5px solid ${T.hair}`, borderRadius: 12,
                padding: '14px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${a.c}22`, color: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(a.i, { size: 17 })}
                </div>
                <span style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{a.l}</span>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </Sheet>
  );
}

Object.assign(window, { Sheet, ProjectSheet, CaptureSheet, AISheet, SafetySheet });
