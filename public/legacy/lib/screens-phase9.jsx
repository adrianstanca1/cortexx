// Cortexx — Phase 9: Upload flow with progress, central Reviews hub, Database explorer

// ═══════════════════════════════════════════════════════════════════
// UPLOAD SHEET — animated progress + filetype simulation
// ═══════════════════════════════════════════════════════════════════
function UploadSheet({ onClose, accent, target = 'document' }) {
  const [stage, setStage] = React.useState('pick');
  const [progress, setProgress] = React.useState(0);
  const [fileMeta, setFileMeta] = React.useState(null);

  const FILES = {
    document: [
      { name: 'RAMS_Camden_v4.pdf', size: 2.4, type: 'pdf', icon: 'doc' },
      { name: 'Approval_Letter.pdf', size: 0.6, type: 'pdf', icon: 'doc' },
      { name: 'Floor_plans_v3.dwg', size: 4.8, type: 'dwg', icon: 'layers' },
      { name: 'Material_W22.xlsx', size: 0.1, type: 'xls', icon: 'box' },
    ],
    drawing: [
      { name: 'East elevation v2.dwg', size: 3.2, type: 'dwg', icon: 'layers' },
      { name: 'Section_AA.pdf', size: 1.4, type: 'pdf', icon: 'doc' },
      { name: 'Detail_window-cill.pdf', size: 0.8, type: 'pdf', icon: 'doc' },
    ],
    photo: [
      { name: 'IMG_2025_05_22_001.jpg', size: 3.1, type: 'jpg', icon: 'camera' },
      { name: 'IMG_2025_05_22_002.jpg', size: 2.8, type: 'jpg', icon: 'camera' },
      { name: 'IMG_2025_05_22_003.jpg', size: 4.2, type: 'jpg', icon: 'camera' },
    ],
  };

  // Real file picker via <input type="file">
  const inputRef = React.useRef(null);
  const handleRealFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    const iconMap = { pdf: 'doc', dwg: 'layers', xls: 'box', xlsx: 'box', jpg: 'camera', jpeg: 'camera', png: 'camera', heic: 'camera' };
    start({ name: f.name, size: +(f.size / 1024 / 1024).toFixed(2), type: ext, icon: iconMap[ext] || 'doc' });
  };

  const start = (file) => {
    setFileMeta(file);
    setStage('uploading');
    setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 15 + 5;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(t);
        setTimeout(async () => {
          if (target === 'document') {
            await Backend.db.documents.create({ name: file.name, type: file.type, size: file.size * 1000, projectId: 1, folder: 'Drawings', uploaded: '2026-05-22', updatedBy: 'You' });
          } else if (target === 'drawing') {
            await Backend.db.drawings.create({ name: file.name.replace(/\.[a-z]+$/i, ''), projectId: 1, version: 'v1', updated: '2026-05-22', markups: 0, type: 'plan' });
          }
          setStage('done');
          toast(`${file.name} uploaded`, 'success');
        }, 200);
      }
    }, 180);
  };

  const files = FILES[target] || FILES.document;

  return (
    <Sheet onClose={onClose} height="auto">
      <div style={{ padding: '8px 20px 14px', textAlign: 'center', fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1 }}>
        {stage === 'pick' && 'Upload file'}
        {stage === 'uploading' && 'Uploading…'}
        {stage === 'done' && 'Upload complete'}
      </div>

      <div style={{ padding: '0 16px 24px' }}>
        {stage === 'pick' && (
          <>
            <div onClick={() => inputRef.current?.click()} style={{
              border: `1.5px dashed ${T.hairStrong}`,
              borderRadius: 14, padding: '24px 16px', textAlign: 'center',
              background: T.bg2, marginBottom: 14, cursor: 'pointer',
            }}>
              <div style={{ color: accent, fontSize: 36, marginBottom: 8 }}>{React.cloneElement(Ic.upload, { size: 36 })}</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>Tap to pick a file</div>
              <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 4 }}>PDF, DWG, XLSX, JPG, PNG · up to 50 MB</div>
              <input ref={inputRef} type="file" onChange={handleRealFile} style={{ display: 'none' }}/>
            </div>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Or sample files</div>
            <GroupedList>
              {files.map((f, i, a) => (
                <Row key={i}
                  icon={React.cloneElement(Ic[f.icon] || Ic.doc)}
                  iconBg={f.type === 'pdf' ? T.red : f.type === 'dwg' ? T.cyan : f.type === 'jpg' ? T.purple : T.green}
                  title={f.name} sub={`${f.size} MB · ${f.type.toUpperCase()}`}
                  isLast={i === a.length - 1}
                  onClick={() => start(f)}/>
              ))}
            </GroupedList>
          </>
        )}

        {stage === 'uploading' && fileMeta && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accent}22`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(Ic[fileMeta.icon] || Ic.doc, { size: 22 })}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SF, fontSize: 13, color: T.t1, fontWeight: 600 }}>{fileMeta.name}</div>
                <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2 }}>{fileMeta.size} MB</div>
              </div>
              <span style={{ fontFamily: SFMono, fontSize: 13, color: accent, fontWeight: 700 }}>{Math.round(progress)}%</span>
            </div>
            <Bar pct={progress} c={accent} h={6}/>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textAlign: 'center', marginTop: 12 }}>
              {progress < 50 ? 'Encrypting…' : progress < 90 ? 'Uploading to cloud…' : 'Finalising…'}
            </div>
          </div>
        )}

        {stage === 'done' && fileMeta && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{
              width: 60, height: 60, margin: '0 auto 16px', borderRadius: 30,
              background: T.green, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{React.cloneElement(Ic.check, { size: 32, sw: 3 })}</div>
            <div style={{ fontFamily: SF, fontSize: 15, color: T.t1, fontWeight: 600 }}>{fileMeta.name}</div>
            <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 4 }}>Available in {target === 'drawing' ? 'Drawings' : 'Documents'}</div>
            <button onClick={onClose} style={{
              marginTop: 20, background: accent, color: '#fff', border: 'none',
              borderRadius: 12, padding: '12px 28px',
              fontFamily: SF, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>Done</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REVIEW HUB — central queue of things needing your sign-off
// ═══════════════════════════════════════════════════════════════════
function ReviewsScreen({ accent }) {
  const tasks = useDB('tasks');
  const cos = useDB('changeOrders');
  const timesheets = useDB('timesheets');
  const subInv = useDB('subInvoices');
  const permits = useDB('permits');
  const inspections = useDB('inspections');
  const invoices = useDB('invoices');
  const rfis = useDB('rfis');

  const queues = [
    { k: 'tasks',     l: 'Task approvals',         n: tasks.filter(t => !t.done && t.assignee === 'You').length, c: T.purple, i: Ic.check, route: 'tab', payload: 'tasks' },
    { k: 'co',        l: 'Variations pending',     n: cos.filter(c => c.status === 'pending').length,            c: T.amber,  i: Ic.swap,  route: 'changes' },
    { k: 'ts',        l: 'Timesheets to approve',  n: timesheets.filter(t => t.status === 'pending').length,     c: T.cyan,   i: Ic.clock, route: 'time' },
    { k: 'subInv',    l: 'Sub invoices to OK',     n: subInv.filter(s => s.status === 'pending').length,         c: T.green,  i: Ic.receipt, route: 'subinvoices' },
    { k: 'permits',   l: 'Permits to sign',        n: permits.filter(p => !p.signed).length,                     c: T.red,    i: Ic.shield, route: 'permits' },
    { k: 'inspect',   l: 'Inspections scheduled',  n: inspections.filter(i => i.status === 'scheduled').length,  c: T.blue,   i: Ic.list,  route: 'inspections' },
    { k: 'overdue',   l: 'Overdue invoices',       n: invoices.filter(i => i.status === 'overdue').length,       c: T.red,    i: Ic.money, route: 'money' },
    { k: 'rfis',      l: 'Open RFIs',              n: rfis.filter(r => r.status === 'open').length,              c: T.amber,  i: Ic.alert, route: 'rfis' },
  ];
  const totalActions = queues.reduce((s, q) => s + q.n, 0);

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Reviews" subtitle={`${totalActions} items waiting on you`}/>

        {/* Hero summary */}
        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{
            background: totalActions === 0 ? `linear-gradient(135deg, ${T.green}33, ${T.green}11)` : `linear-gradient(135deg, ${accent}22, ${T.purple}11)`,
            border: `0.5px solid ${totalActions === 0 ? T.green + '55' : accent + '44'}`,
            borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: totalActions === 0 ? T.green : accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${totalActions === 0 ? T.green : accent}55`,
            }}>
              {React.cloneElement(totalActions === 0 ? Ic.check : Ic.alert, { size: 28 })}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SFMono, fontSize: 32, fontWeight: 700, color: T.t1, letterSpacing: -0.8, lineHeight: 1 }}>{totalActions}</div>
              <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 4 }}>
                {totalActions === 0 ? 'Inbox zero · all clear' : `Items across ${queues.filter(q=>q.n>0).length} categories`}
              </div>
            </div>
          </div>
        </div>

        <Section title="Approvals queue">
          <GroupedList>
            {queues.filter(q => q.n > 0).map((q, i, a) => (
              <Row key={q.k} icon={q.i} iconBg={q.c}
                title={q.l}
                right={<Pill c={q.c}>{q.n}</Pill>}
                isLast={i === a.length - 1}
                onClick={() => q.route === 'tab' ? window.cortexxNav('tab', q.payload) : window.cortexxNav(q.route)}/>
            ))}
            {queues.every(q => q.n === 0) && (
              <div style={{ padding: 30, textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>
                Everything's reviewed. Nice work.
              </div>
            )}
          </GroupedList>
        </Section>

        <Section title="By category">
          <GroupedList>
            {queues.filter(q => q.n === 0).map((q, i, a) => (
              <Row key={q.k} icon={q.i} iconBg={T.t3}
                title={q.l} sub="All clear"
                right={<Pill c={T.green} size="xs">✓</Pill>}
                isLast={i === a.length - 1}
                onClick={() => q.route === 'tab' ? window.cortexxNav('tab', q.payload) : window.cortexxNav(q.route)}/>
            ))}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DATABASE EXPLORER — view raw data in each table
// ═══════════════════════════════════════════════════════════════════
function DatabaseScreen({ accent }) {
  const [activeTable, setActiveTable] = React.useState(null);
  const tableNames = [
    'projects', 'tasks', 'team', 'invoices', 'receipts', 'activity',
    'quotes', 'timesheets', 'materials', 'subs', 'documents', 'diary',
    'changeOrders', 'snags', 'equipment', 'notifications',
    'rfis', 'messages', 'purchaseOrders',
    'inspections', 'customers', 'leads', 'mileage',
    'auditLog', 'jobTemplates', 'forms',
    'drawings', 'permits', 'goals', 'subInvoices',
  ].filter(n => Backend.db[n]);

  if (activeTable) {
    const rows = Backend.db[activeTable].listSync();
    return (
      <ScreenBg accent={accent}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
          <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center' }}>
            <button onClick={() => setActiveTable(null)} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
              {Ic.chevL} <span>Tables</span>
            </button>
          </div>
          <MobileHeader title={activeTable} subtitle={`${rows.length} rows`} right={
            <HeaderBtn icon={Ic.download} onClick={() => {
              const blob = JSON.stringify(rows, null, 2);
              navigator.clipboard?.writeText(blob);
              toast('Copied JSON to clipboard', 'success');
            }}/>
          }/>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((row, i) => (
              <div key={i} style={{
                background: T.bg2, borderRadius: 10, padding: 10,
                border: `0.5px solid ${T.hair}`,
                fontFamily: SFMono, fontSize: 11, color: T.t2,
                overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                lineHeight: 1.5,
              }}>
                {Object.entries(row).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: T.blueL, minWidth: 80 }}>{k}:</span>
                    <span style={{ color: T.t1, wordBreak: 'break-all' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </ScreenBg>
    );
  }

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Database" subtitle={`${tableNames.length} tables · local-first`}
          right={<HeaderBtn icon={Ic.archive} onClick={() => { Backend.db.reset(); toast('All tables reset to seed data', 'success'); }}/>}/>
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${T.green}22, ${T.cyan}11)`,
            border: `0.5px solid ${T.green}44`, borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ color: T.green }}>{React.cloneElement(Ic.check, { size: 16 })}</div>
            <div style={{ flex: 1, fontFamily: SF, fontSize: 12, color: T.t1, lineHeight: 1.4 }}>
              All data lives on your device. No server, no tracking. Export to JSON any time.
            </div>
          </div>
        </div>
        <Section title="Tables">
          <GroupedList>
            {tableNames.map((t, i, a) => {
              const count = Backend.db[t].listSync().length;
              return (
                <Row key={t} icon={Ic.layers} iconBg={accent}
                  title={t} sub={`${count} row${count !== 1 ? 's' : ''}`}
                  right={<span style={{ fontFamily: SFMono, fontSize: 11, color: T.t3 }}>{count}</span>}
                  isLast={i === a.length - 1}
                  onClick={() => setActiveTable(t)}/>
              );
            })}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPACT DASHBOARD (Layout 13) — executive at-a-glance
// ═══════════════════════════════════════════════════════════════════
function DashV13_Exec({ accent = T.blue }) {
  const cash = useComputed('cashBalance');
  const outstanding = useComputed('outstanding');
  const active = useComputed('activeProjects');
  const pendingTS = useComputed('pendingTimesheets');
  const openRFIs = useComputed('openRFIs');
  const openSnags = useComputed('openSnags');

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <MobileHeader title="Executive" subtitle="Thu 30 Apr · Wk 17"
          right={<HeaderBtn icon={Ic.bell} badge accent={accent} onClick={() => window.cortexxNav && window.cortexxNav('inbox')}/>}/>

        {/* Big number — cash */}
        <div style={{ padding: '4px 16px 18px' }}>
          <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Cash position</div>
          <div style={{ fontFamily: SFMono, fontSize: 48, fontWeight: 700, color: T.t1, marginTop: 4, letterSpacing: -1.5, lineHeight: 1 }}>
            £{cash.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: SF, fontSize: 13, color: T.green, fontWeight: 500 }}>
            {React.cloneElement(Ic.trend, { size: 14 })} <span>+£8,420 this week</span>
            <span style={{ color: T.t3, marginLeft: 6 }}>£{outstanding.toLocaleString()} pending in</span>
          </div>
        </div>

        {/* Mini KPI grid */}
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { l: 'Active', v: active, c: T.blue },
            { l: 'Pending TS', v: pendingTS, c: T.amber },
            { l: 'Open RFIs', v: openRFIs, c: T.cyan },
            { l: 'Open snags', v: openSnags, c: T.red },
            { l: 'Margin %', v: useComputed('avgMargin').toFixed(0), c: T.green },
            { l: 'Team', v: useComputed('teamOnSite'), c: T.purple },
          ].map((k, i) => (
            <div key={i} style={{ background: T.bg2, borderRadius: 10, padding: '10px 12px', border: `0.5px solid ${T.hair}` }}>
              <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</div>
              <div style={{ fontFamily: SFMono, fontSize: 22, color: k.c, fontWeight: 700, marginTop: 4, letterSpacing: -0.5 }}>{k.v}</div>
            </div>
          ))}
        </div>

        <Section title="This week" pad={16}>
          <GroupedList>
            <Row icon={Ic.trend} iconBg={T.green} title="Revenue: £67,200" sub="Target £80,000 · 84%" onClick={() => window.cortexxNav('reports')}/>
            <Row icon={Ic.check} iconBg={T.blue} title="On-time delivery 88%" sub="Target 95% · slipping"/>
            <Row icon={Ic.shield} iconBg={T.amber} title="Safety score 92" sub="Target 95 · 3 to go" isLast onClick={() => window.cortexxNav('safety')}/>
          </GroupedList>
        </Section>
      </div>
      <TabBar accent={accent}/>
    </ScreenBg>
  );
}

Object.assign(window, { UploadSheet, ReviewsScreen, DatabaseScreen, DashV13_Exec });
