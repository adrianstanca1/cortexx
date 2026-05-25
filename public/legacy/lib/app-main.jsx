// Cortexx — main app shell with interactive tabs and sheets

function InteractiveTabBar({ tab, setTab, onCapture, accent }) {
  const tabs = [
    { k: 'dashboard', l: 'Dashboard', i: Ic.dashboard },
    { k: 'projects', l: 'Projects', i: Ic.projects },
    { k: '_fab' },
    { k: 'tasks', l: 'Tasks', i: Ic.tasks },
    { k: 'team', l: 'Team', i: Ic.team },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(6,16,30,0.85)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderTop: `0.5px solid ${T.hair}`,
      paddingTop: 8, paddingBottom: 28,
      display: 'flex', alignItems: 'flex-start', zIndex: 10,
    }}>
      {tabs.map(t => {
        if (t.k === '_fab') {
          return (
            <div key="_fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <button onClick={onCapture} style={{
                width: 52, height: 52, borderRadius: 26,
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                border: 'none',
                boxShadow: `0 6px 20px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', marginTop: -22,
              }}>{React.cloneElement(Ic.plus, { size: 26 })}</button>
            </div>
          );
        }
        const isActive = tab === t.k;
        return (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            color: isActive ? accent : T.t3, padding: '4px 0',
            transition: 'color 0.15s',
          }}>
            {React.cloneElement(t.i, { size: 22 })}
            <span style={{ fontFamily: SF, fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{t.l}</span>
          </button>
        );
      })}
    </div>
  );
}

// Map of dashboard ids to components
const DASHBOARDS = {
  v1: { c: 'DashV1_ActionFirst', l: 'Action-first' },
  v2: { c: 'DashV2_StatusBoard', l: 'Status board' },
  v3: { c: 'DashV3_Calm', l: 'Calm' },
  v4: { c: 'DashV4_Bento', l: 'Bento' },
  v5: { c: 'DashV5_AIForward', l: 'AI-forward' },
  v6: { c: 'DashV6_Field', l: 'Field' },
  v7: { c: 'DashV7_Timeline', l: 'Timeline' },
  v8: { c: 'DashV8_Money', l: 'Books' },
  v9: { c: 'DashV9_Stories', l: 'Stories' },
  v10: { c: 'DashV10_Rings', l: 'Rings' },
  v11: { c: 'DashV11_Map', l: 'Map' },
  v12: { c: 'DashV12_Focus', l: 'Focus' },
  v13: { c: 'DashV13_Exec', l: 'Executive' },
  v14: { c: 'DashV14_Broadsheet', l: 'Broadsheet' },
  v15: { c: 'DashV15_SiteNotice', l: 'Site Notice' },
};

function CortexxApp({ dashboardId = 'v1', accent = T.blue, openAI, onChangeDashboard }) {
  const [tab, setTab] = React.useState('dashboard');
  const [sheet, setSheet] = React.useState(null);
  const [activeProject, setActiveProject] = React.useState(null);
  const [activeInvoice, setActiveInvoice] = React.useState(null);
  const [activeQuote, setActiveQuote] = React.useState(null);
  const user = useDB('user');

  // Cmd+K / Ctrl+K opens the command palette
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSheet('cmdk');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Global navigation exposed to all screens via window.cortexxNav
  React.useEffect(() => {
    window.cortexxNav = (key, payload) => {
      if (key === 'project') { setActiveProject(payload); setSheet('project'); }
      else if (key === 'quote') { setActiveQuote(payload); setSheet('quote'); }
      else if (key === 'chase') { setActiveInvoice(payload); setSheet('chase'); }
      else if (key === 'addtask') { setSheet('addtask'); }
      else if (key === 'addteam') { setSheet('addteam'); }
      else if (key === 'rfi') { setActiveProject(payload); setSheet('rfi'); }
      else if (key === 'msg') { setActiveProject(payload); setSheet('msg'); }
      else if (key === 'docgen') { setActiveProject(payload); setSheet('docgen'); }
      else if (key === 'improvement') { setActiveProject(payload); setSheet('improvement'); }
      else if (key === 'editfield') { setActiveProject(payload); setSheet('editfield'); }
      else if (key === 'smartparse' || key === 'parse') setSheet('smartparse');
      else if (key === 'phototosnag') setSheet('phototosnag');
      else if (key === 'starttrip') setSheet('starttrip');
      else if (key === 'addtag') setSheet('addtag');
      else if (key === 'addtemplate') setSheet('addtemplate');
      else if (key === 'addview') setSheet('addview');
      else if (key === 'addcost') setSheet('addcost');
      else if (key === 'tab') { setTab(payload); setSheet(null); }
      else { setSheet(key); }
    };
  }, []);

  const openProject = (p) => { setActiveProject(p); setSheet('project'); };
  const openChase = (iv) => { setActiveInvoice(iv); setSheet('chase'); };
  const openQuote = (q) => { setActiveQuote(q); setSheet('quote'); };
  const closeSheet = () => { setSheet(null); setActiveProject(null); setActiveInvoice(null); setActiveQuote(null); };

  // First-run onboarding trigger
  React.useEffect(() => {
    if (!localStorage.getItem('cortexx_onboarded')) {
      setTimeout(() => setSheet('onboarding'), 400);
    }
  }, []);

  // PWA shortcut launch — ?action=task|receipt|ai|clock opens that sheet on cold start
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (!action) return;
      const map = {
        task:    () => setSheet('addtask'),
        receipt: () => setSheet('scan'),
        ai:      () => setSheet('ai'),
        clock:   () => setSheet('clock'),
        photo:   () => setSheet('sitephoto'),
        voice:   () => setSheet('voice'),
      };
      const fn = map[action];
      if (fn) setTimeout(fn, 500);
      // Strip query so refresh doesn't re-open the sheet
      if (window.history?.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) {}
  }, []);

  // Sign out wires through to Login
  React.useEffect(() => {
    window.cortexxSignOut = () => {
      localStorage.removeItem('cortexx_onboarded');
      setSheet('login');
      toast('Signed out', 'info');
    };
  }, []);

  const handleCapture = (k) => {
    setSheet(null);
    setTimeout(() => {
      if (k === 'task') setSheet('addtask');
      else if (k === 'photo') setSheet('sitephoto');
      else if (k === 'incident') setSheet('incident');
      else if (k === 'estimate') setSheet('estimator');
      else if (k === 'voice') setSheet('voice');
      else if (k === 'receipt') setSheet('scan');
      else if (k === 'money') setSheet('money');
      else if (k === 'safety') setSheet('safety');
      else if (k === 'profile') setSheet('profile');
      else if (k === 'ai') setSheet('ai');
      else if (k === 'inbox') setSheet('inbox');
      else if (k === 'quotes') setSheet('quotes');
      else if (k === 'time') setSheet('time');
      else if (k === 'calendar') setSheet('calendar');
      else if (k === 'materials') setSheet('materials');
      else if (k === 'subs') setSheet('subs');
      else if (k === 'docs') setSheet('docs');
      else if (k === 'diary') setSheet('diary');
      else if (k === 'snags') setSheet('snags');
      else if (k === 'changes') setSheet('changes');
      else if (k === 'equipment') setSheet('equipment');
      else if (k === 'rfis') setSheet('rfis');
      else if (k === 'messages') setSheet('messages');
      else if (k === 'reports') setSheet('reports');
      else if (k === 'timeline') setSheet('timeline');
      else if (k === 'settings') setSheet('settings');
      else if (k === 'help') setSheet('help');
      else if (k === 'pos') setSheet('pos');
      else if (k === 'portal') setSheet('portal');
      else if (k === 'inspections') setSheet('inspections');
      else if (k === 'customers') setSheet('customers');
      else if (k === 'leads') setSheet('leads');
      else if (k === 'photos') setSheet('photos');
      else if (k === 'mileage') setSheet('mileage');
      else if (k === 'activity') setSheet('activity');
      else if (k === 'templates') setSheet('templates');
      else if (k === 'forms') setSheet('forms');
      else if (k === 'drawings') setSheet('drawings');
      else if (k === 'permits') setSheet('permits');
      else if (k === 'goals') setSheet('goals');
      else if (k === 'subinvoices') setSheet('subinvoices');
      else if (k === 'addcustomer') setSheet('addcustomer');
      else if (k === 'addlead') setSheet('addlead');
      else if (k === 'addpermit') setSheet('addpermit');
      else if (k === 'addgoal') setSheet('addgoal');
      else if (k === 'upload') setSheet('upload');
      else if (k === 'reviews') setSheet('reviews');
      else if (k === 'database') setSheet('database');
      else if (k === 'reminders') setSheet('reminders');
      else if (k === 'performance') setSheet('performance');
      else if (k === 'clock' || k === 'checkin2') setSheet('clock');
      else if (k === 'livestatus') setSheet('livestatus');
      else if (k === 'myday') setSheet('myday');
      else if (k === 'workspace') setSheet('workspace');
      else if (k === 'annotate') setSheet('annotate');
      else if (k === 'health') setSheet('health');
      else if (k === 'infrastructure') setSheet('infrastructure');
      else if (k === 'vera') setSheet('vera');
      else if (k === 'veraauto') setSheet('veraauto');
      else if (k === 'personas') setSheet('personas');
      else if (k === 'bank') setSheet('bank');
      else if (k === 'payroll') setSheet('payroll');
      else if (k === 'holiday') setSheet('holiday');
      else if (k === 'apprentice') setSheet('apprentice');
      else if (k === 'carbon') setSheet('carbon');
      else if (k === 'waste') setSheet('waste');
      else if (k === 'claims') setSheet('claims');
      else if (k === 'training') setSheet('training');
      else if (k === 'launch') setSheet('launch');
      else if (k === 'subportal') setSheet('subportal');
      else if (k === 'currency') setSheet('currency');
      else if (k === 'api') setSheet('api');
      else if (k === 'templatelib') setSheet('templatelib');
      else if (k === 'audittrail') setSheet('audittrail');
      else if (k === 'tags') setSheet('tags');
      else if (k === 'views') setSheet('views');
      else if (k === 'roles') setSheet('roles');
      else if (k === 'tour') setSheet('tour');
      else if (k === 'catalog') setSheet('catalog');
      else if (k === 'tomorrow') setSheet('tomorrow');
      else if (k === 'improve' || k === 'services' || k === 'processes' || k === 'kaizen') setSheet(k);
      else if (k === 'checkin') {
        setSheet('clock');
        return;
      }
      // other actions just close
    }, 220);
  };

  // Resolve once with a fallback so a stale persisted dashboardId can't crash the shell.
  const safeDashboardId = DASHBOARDS[dashboardId] ? dashboardId : 'v1';
  const activeDashboard = DASHBOARDS[safeDashboardId];
  const DashComp = window[activeDashboard.c];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.bg0, color: T.t1,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <IOSStatusBar dark={true}/>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'dashboard' && DashComp && (
          <div style={{ width: '100%', height: '100%' }}>
            {/* Render dashboard's content but strip its TabBar — we use the interactive one */}
            <DashComp accent={accent}/>
            {/* Cover the dashboard's static tab bar with a transparent overlay (the dashboard's bar is at z-index 10, ours is at z-index 11) */}
          </div>
        )}
        {tab === 'projects' && <ProjectsScreen openProject={openProject} accent={accent}/>}
        {tab === 'tasks' && <TasksScreen accent={accent} onAdd={() => setSheet('addtask')}/>}
        {tab === 'team' && <TeamScreen accent={accent}/>}
        {tab === 'money' && <MoneyScreen accent={accent} onChase={openChase}/>}
        {tab === 'safety' && <SafetyScreen accent={accent}/>}
      </div>

      {/* Responsive sidebar — visible at ≥768px */}
      <ResponsiveSidebar tab={tab} setTab={setTab} accent={accent}/>

      {/* Interactive tab bar (overlays dashboards' static ones) */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 11 }}>
        <InteractiveTabBar tab={tab} setTab={setTab} onCapture={() => setSheet('capture')} accent={accent}/>
      </div>

      {/* Floating upload pill — bottom left, partner to AI pill */}
      <FloatingUploadPill accent={accent}/>

      {/* Floating AI button — visible everywhere including dashboard */}
      {true && (
        <button onClick={() => setSheet('ai')} style={{
          position: 'absolute', right: 16, bottom: 96, zIndex: 9,
          width: 50, height: 50, borderRadius: 25,
          background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
          border: 'none', color: '#fff', cursor: 'pointer',
          boxShadow: `0 8px 24px ${T.purple}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{React.cloneElement(Ic.spark, { size: 22 })}</button>
      )}

      {/* Dashboard picker — small chip bottom-right above tab bar */}
      {tab === 'dashboard' && <CmdKHint accent={accent}/>}
      {tab === 'dashboard' && onChangeDashboard && (
        <button onClick={() => setSheet('dashpick')} style={{
          position: 'absolute', right: 12, bottom: 158, zIndex: 9,
          background: 'rgba(6,16,30,0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `0.5px solid ${T.hairMid}`,
          color: T.t1, fontFamily: SFMono, fontSize: 11, fontWeight: 600,
          padding: '7px 10px', borderRadius: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
        }}>
          <span style={{ color: accent }}>{React.cloneElement(Ic.layers, { size: 12 })}</span>
          {safeDashboardId.toUpperCase()}<span style={{ color: T.t3 }}>·</span>{activeDashboard.l}
          {React.cloneElement(Ic.chevDown, { size: 11 })}
        </button>
      )}

      {sheet === 'project' && <ProjectSheet project={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'capture' && <CaptureSheet onClose={closeSheet} accent={accent} onAction={handleCapture}/>}
      {sheet === 'ai' && <AISheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'safety' && <SheetWrap title="Safety" onClose={closeSheet} accent={accent}><SafetyScreen accent={accent}/></SheetWrap>}
      {sheet === 'money' && <SheetWrap title="Money" onClose={closeSheet} accent={accent}><MoneyScreen accent={accent} onChase={openChase}/></SheetWrap>}
      {sheet === 'profile' && <SheetWrap title="Profile" onClose={closeSheet} accent={accent}><ProfileScreen accent={accent} onSignOut={closeSheet}/></SheetWrap>}
      {sheet === 'inbox' && <SheetWrap title="Inbox" onClose={closeSheet} accent={accent}><InboxScreen accent={accent} onAction={(a) => { closeSheet(); setTimeout(() => setSheet(a), 200); }}/></SheetWrap>}
      {sheet === 'quotes' && <SheetWrap title="Quotes" onClose={closeSheet} accent={accent}><QuotesScreen accent={accent} onAdd={() => { closeSheet(); setTimeout(() => setSheet('estimator'), 200); }} onOpen={openQuote}/></SheetWrap>}
      {sheet === 'time' && <SheetWrap title="Timesheets" onClose={closeSheet} accent={accent}><TimesheetsScreen accent={accent}/></SheetWrap>}
      {sheet === 'calendar' && <SheetWrap title="Schedule" onClose={closeSheet} accent={accent}><CalendarScreen accent={accent}/></SheetWrap>}
      {sheet === 'materials' && <SheetWrap title="Materials" onClose={closeSheet} accent={accent}><MaterialsScreen accent={accent}/></SheetWrap>}
      {sheet === 'subs' && <SheetWrap title="Subcontractors" onClose={closeSheet} accent={accent}><SubsScreen accent={accent}/></SheetWrap>}
      {sheet === 'docs' && <SheetWrap title="Documents" onClose={closeSheet} accent={accent}><DocumentsScreen accent={accent}/></SheetWrap>}
      {sheet === 'diary' && <SheetWrap title="Site diary" onClose={closeSheet} accent={accent}><DiaryScreen accent={accent}/></SheetWrap>}
      {sheet === 'snags' && <SheetWrap title="Snags" onClose={closeSheet} accent={accent}><SnagsScreen accent={accent}/></SheetWrap>}
      {sheet === 'changes' && <SheetWrap title="Variations" onClose={closeSheet} accent={accent}><ChangeOrdersScreen accent={accent}/></SheetWrap>}
      {sheet === 'equipment' && <SheetWrap title="Equipment" onClose={closeSheet} accent={accent}><EquipmentScreen accent={accent}/></SheetWrap>}
      {sheet === 'addtask' && <AddTaskSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'scan' && <ReceiptScanSheetReal onClose={closeSheet} accent={accent}/>}
      {sheet === 'chase' && activeInvoice && <ChaseSheet invoice={activeInvoice} onClose={closeSheet} accent={accent}/>}
      {sheet === 'estimator' && <AIEstimatorSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'quote' && activeQuote && <QuoteDetailSheet quote={activeQuote} onClose={closeSheet} accent={accent}/>}
      {sheet === 'onboarding' && <OnboardingSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'search' && <SearchSheet onClose={closeSheet} accent={accent} onNavigate={(k, p) => { closeSheet(); setTimeout(() => window.cortexxNav(k, p), 200); }}/>}
      {sheet === 'addproject' && <AddProjectSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addmaterial' && <AddMaterialSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addsub' && <AddSubSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addequipment' && <AddEquipmentSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addsnag' && <AddSnagSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addchange' && <AddChangeOrderSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addinspection' && <AddInspectionSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'adddiary' && <AddDiarySheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addteam' && <AddTeamMemberSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'rfis' && <SheetWrap title="RFIs" onClose={closeSheet} accent={accent}><RFIsScreen accent={accent} onOpen={(r) => { setActiveProject(r); setSheet('rfi'); }}/></SheetWrap>}
      {sheet === 'rfi' && activeProject && <RFIDetailSheet rfi={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'addrfi' && <AddRFISheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'messages' && <SheetWrap title="Messages" onClose={closeSheet} accent={accent}><MessagesScreen accent={accent} onOpen={(m) => { setActiveProject(m); setSheet('msg'); }}/></SheetWrap>}
      {sheet === 'msg' && activeProject && <MessageThreadSheet thread={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'reports' && <SheetWrap title="Reports" onClose={closeSheet} accent={accent}><ReportsScreen accent={accent}/></SheetWrap>}
      {sheet === 'timeline' && <SheetWrap title="Timeline" onClose={closeSheet} accent={accent}><TimelineScreen accent={accent}/></SheetWrap>}
      {sheet === 'login' && <LoginSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'settings' && <SheetWrap title="Settings" onClose={closeSheet} accent={accent}><SettingsScreen accent={accent}/></SheetWrap>}
      {sheet === 'help' && <SheetWrap title="Help" onClose={closeSheet} accent={accent}><HelpScreen accent={accent}/></SheetWrap>}
      {sheet === 'pos' && <SheetWrap title="Purchase orders" onClose={closeSheet} accent={accent}><PurchaseOrdersScreen accent={accent}/></SheetWrap>}
      {sheet === 'portal' && <SheetWrap title="Client portal" onClose={closeSheet} accent={accent}><ClientPortalScreen accent={accent}/></SheetWrap>}
      {sheet === 'inspections' && <SheetWrap title="Inspections" onClose={closeSheet} accent={accent}><InspectionsScreen accent={accent} onOpen={(i) => { setActiveProject(i); setSheet('inspection'); }}/></SheetWrap>}
      {sheet === 'inspection' && activeProject && <InspectionDetailSheet inspection={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'customers' && <SheetWrap title="Customers" onClose={closeSheet} accent={accent}><CustomersScreen accent={accent} onOpen={(c) => { setActiveProject(c); setSheet('customer'); }}/></SheetWrap>}
      {sheet === 'customer' && activeProject && <CustomerDetailSheet customer={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'leads' && <SheetWrap title="Leads" onClose={closeSheet} accent={accent}><LeadsScreen accent={accent}/></SheetWrap>}
      {sheet === 'photos' && <SheetWrap title="Photos" onClose={closeSheet} accent={accent}><PhotosV2Screen accent={accent}/></SheetWrap>}
      {sheet === 'mileage' && <SheetWrap title="Mileage" onClose={closeSheet} accent={accent}><MileageScreen accent={accent}/></SheetWrap>}
      {sheet === 'activity' && <SheetWrap title="Activity" onClose={closeSheet} accent={accent}><ActivityScreen accent={accent}/></SheetWrap>}
      {sheet === 'templates' && <SheetWrap title="Job templates" onClose={closeSheet} accent={accent}><TemplatesScreen accent={accent}/></SheetWrap>}
      {sheet === 'forms' && <SheetWrap title="Forms" onClose={closeSheet} accent={accent}><FormsScreen accent={accent}/></SheetWrap>}
      {sheet === 'drawings' && <SheetWrap title="Drawings" onClose={closeSheet} accent={accent}><DrawingsScreen accent={accent} onOpen={(d) => { setActiveProject(d); setSheet('drawing'); }}/></SheetWrap>}
      {sheet === 'drawing' && activeProject && <DrawingViewerSheet drawing={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'permits' && <SheetWrap title="Permits" onClose={closeSheet} accent={accent}><PermitsScreen accent={accent}/></SheetWrap>}
      {sheet === 'goals' && <SheetWrap title="Goals" onClose={closeSheet} accent={accent}><GoalsScreen accent={accent}/></SheetWrap>}
      {sheet === 'voice' && <VoiceMemoSheetReal onClose={closeSheet} accent={accent}/>}
      {sheet === 'subinvoices' && <SheetWrap title="Sub invoices" onClose={closeSheet} accent={accent}><SubInvoicesScreen accent={accent}/></SheetWrap>}
      {sheet === 'addcustomer' && <AddCustomerSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addlead' && <AddLeadSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addpermit' && <AddPermitSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addgoal' && <AddGoalSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'upload' && <UploadSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'reviews' && <SheetWrap title="Reviews" onClose={closeSheet} accent={accent}><ReviewsScreen accent={accent}/></SheetWrap>}
      {sheet === 'database' && <SheetWrap title="Database" onClose={closeSheet} accent={accent}><DatabaseScreen accent={accent}/></SheetWrap>}
      {sheet === 'reminders' && <SheetWrap title="Reminders" onClose={closeSheet} accent={accent}><RemindersScreen accent={accent}/></SheetWrap>}
      {sheet === 'performance' && <SheetWrap title="Performance" onClose={closeSheet} accent={accent}><PerformanceScreen accent={accent}/></SheetWrap>}
      {sheet === 'clock' && <SheetWrap title="Check in" onClose={closeSheet} accent={accent}><CheckInScreen accent={accent}/></SheetWrap>}
      {sheet === 'livestatus' && <SheetWrap title="Live status" onClose={closeSheet} accent={accent}><LiveStatusScreen accent={accent}/></SheetWrap>}
      {sheet === 'myday' && <SheetWrap title="My day" onClose={closeSheet} accent={accent}><MyDayScreen accent={accent}/></SheetWrap>}
      {sheet === 'workspace' && <WorkspaceSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'annotate' && <PhotoAnnotateSheet snag={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'health' && activeProject && <HealthCheckSheet project={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'infrastructure' && <SheetWrap title="Infrastructure" onClose={closeSheet} accent={accent}><InfrastructureScreen accent={accent}/></SheetWrap>}
      {sheet === 'vera' && <SheetWrap title="Vera · CEO" onClose={closeSheet} accent={accent}><VeraScreen accent={accent}/></SheetWrap>}
      {sheet === 'veraauto' && <SheetWrap title="Vera · autopilot" onClose={closeSheet} accent={accent}><VeraActionsScreen accent={accent}/></SheetWrap>}
      {sheet === 'personas' && <SheetWrap title="Leadership" onClose={closeSheet} accent={accent}><PersonasScreen accent={accent}/></SheetWrap>}
      {sheet === 'bank' && <SheetWrap title="Banking" onClose={closeSheet} accent={accent}><BankScreen accent={accent}/></SheetWrap>}
      {sheet === 'payroll' && <SheetWrap title="Payroll" onClose={closeSheet} accent={accent}><PayrollScreen accent={accent}/></SheetWrap>}
      {sheet === 'holiday' && <SheetWrap title="Holiday" onClose={closeSheet} accent={accent}><HolidayScreen accent={accent}/></SheetWrap>}
      {sheet === 'apprentice' && <SheetWrap title="Apprentices" onClose={closeSheet} accent={accent}><ApprenticeScreen accent={accent}/></SheetWrap>}
      {sheet === 'carbon' && <SheetWrap title="Carbon" onClose={closeSheet} accent={accent}><CarbonScreen accent={accent}/></SheetWrap>}
      {sheet === 'waste' && <SheetWrap title="Waste" onClose={closeSheet} accent={accent}><WasteScreen accent={accent}/></SheetWrap>}
      {sheet === 'claims' && <SheetWrap title="Insurance claims" onClose={closeSheet} accent={accent}><ClaimsScreen accent={accent}/></SheetWrap>}
      {sheet === 'member' && activeProject && <TeamMemberSheet member={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'addcert' && activeProject && <AddCertSheet member={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'training' && <SheetWrap title="Training matrix" onClose={closeSheet} accent={accent}><TrainingMatrixScreen accent={accent}/></SheetWrap>}
      {sheet === 'launch' && <SheetWrap title="About & legal" onClose={closeSheet} accent={accent}><LaunchScreen accent={accent}/></SheetWrap>}
      {sheet === 'cmdk' && <CommandPalette onClose={closeSheet} accent={accent}/>}
      {sheet === 'aihistory' && <SheetWrap title="AI history" onClose={closeSheet} accent={accent}><AIHistoryScreen accent={accent}/></SheetWrap>}
      {sheet === 'signature' && <SignatureSheet subject={activeProject?.subject || 'Document'} signerName={activeProject?.signerName} onSigned={activeProject?.onSigned} onClose={closeSheet} accent={accent}/>}
      {sheet === 'approval' && <ApprovalSheet item={activeProject} onApproved={activeProject?.onApproved} onClose={closeSheet} accent={accent}/>}
      {sheet === 'subportal' && <SheetWrap title="Sub portal" onClose={closeSheet} accent={accent}><SubPortalScreen accent={accent}/></SheetWrap>}
      {sheet === 'currency' && <SheetWrap title="Currency" onClose={closeSheet} accent={accent}><CurrencyScreen accent={accent}/></SheetWrap>}
      {sheet === 'api' && <SheetWrap title="API" onClose={closeSheet} accent={accent}><APIScreen accent={accent}/></SheetWrap>}
      {sheet === 'templatelib' && <SheetWrap title="Templates" onClose={closeSheet} accent={accent}><TemplateLibScreen accent={accent}/></SheetWrap>}
      {sheet === 'audittrail' && <SheetWrap title="Audit trail" onClose={closeSheet} accent={accent}><AuditTrailScreen accent={accent}/></SheetWrap>}
      {sheet === 'tags' && <SheetWrap title="Tags" onClose={closeSheet} accent={accent}><TagsScreen accent={accent}/></SheetWrap>}
      {sheet === 'views' && <SheetWrap title="Saved views" onClose={closeSheet} accent={accent}><SavedViewsScreen accent={accent}/></SheetWrap>}
      {sheet === 'roles' && <SheetWrap title="Roles" onClose={closeSheet} accent={accent}><RolesScreen accent={accent}/></SheetWrap>}
      {sheet === 'tour' && <TourSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'catalog' && <SheetWrap title="Cost catalog" onClose={closeSheet} accent={accent}><CostCatalogScreen accent={accent}/></SheetWrap>}
      {sheet === 'tomorrow' && <TomorrowSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'improve' && <SheetWrap title="Improve" onClose={closeSheet} accent={accent}><ImproveHubScreen accent={accent}/></SheetWrap>}
      {sheet === 'services' && <SheetWrap title="Services" onClose={closeSheet} accent={accent}><ServiceCatalogScreen accent={accent}/></SheetWrap>}
      {sheet === 'processes' && <SheetWrap title="Processes" onClose={closeSheet} accent={accent}><ProcessLibraryScreen accent={accent}/></SheetWrap>}
      {sheet === 'kaizen' && <SheetWrap title="Kaizen" onClose={closeSheet} accent={accent}><KaizenBoardScreen accent={accent}/></SheetWrap>}
      {sheet === 'docgen' && <DocGenSheet docKind={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'addholiday' && <AddHolidaySheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addclaim' && <AddClaimSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addimprovement' && <AddImprovementSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'improvement' && activeProject && <ImprovementDetailSheet improvement={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'sitephoto' && <SiteProgressPhotoSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'incident' && <IncidentReportSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'editfield' && <EditFieldSheet params={activeProject} onClose={closeSheet} accent={accent}/>}
      {sheet === 'starttrip' && <StartTripSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addtag' && <AddTagSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addtemplate' && <AddTemplateSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addview' && <AddViewSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'addcost' && <AddCostItemSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'smartparse' && <SmartParseSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'phototosnag' && <PhotoToSnagSheet onClose={closeSheet} accent={accent}/>}
      {sheet === 'dashpick' && (
        <Sheet onClose={closeSheet} height="auto">
          <div style={{ padding: '8px 20px 14px', textAlign: 'center', fontFamily: SF, fontSize: 17, fontWeight: 600, color: T.t1 }}>Dashboard layout</div>
          <div style={{ padding: '0 16px 28px' }}>
            <GroupedList>
              {Object.entries(DASHBOARDS).map(([k, v], i, a) => (
                <Row key={k}
                  icon={Ic.layers} iconBg={dashboardId === k ? accent : T.t3}
                  title={`${k.toUpperCase()} · ${v.l}`}
                  sub={DASH_DESCRIPTIONS[k]}
                  right={dashboardId === k ? <span style={{ color: accent }}>{Ic.check}</span> : null}
                  isLast={i === a.length - 1}
                  onClick={() => { onChangeDashboard(k); closeSheet(); }}/>
              ))}
            </GroupedList>
          </div>
        </Sheet>
      )}
      {window.TaskBulkActionBar && <TaskBulkActionBar/>}
    </div>
  );
}

const DASH_DESCRIPTIONS = {
  v1: 'Hero CTA + priority queue',
  v2: 'Live blueprint readout',
  v3: 'Calm, typographic',
  v4: 'Bento grid',
  v5: 'Cortex AI front & center',
  v6: 'Big buttons for field',
  v7: 'Timeline day-spine',
  v8: 'Cashflow first',
  v9: 'Site stories + feed',
  v10: 'Activity rings',
  v11: 'Map of sites',
  v12: 'Zen focus mode',
  v13: 'Executive at-a-glance',
  v14: 'Broadsheet — daily paper',
  v15: 'Site Notice — brutalist plaque',
};

// SheetWrap — wraps any full screen in a sheet with a top close bar
function SheetWrap({ title, onClose, accent, children }) {
  return (
    <Sheet onClose={onClose} fullscreen>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `0.5px solid ${T.hair}`,
        background: T.bg0, position: 'relative', zIndex: 5,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: accent, fontFamily: SF, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
          {Ic.chevL} <span>Back</span>
        </button>
        <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 600, color: T.t1 }}>{title}</div>
        <div style={{ width: 50 }}/>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </Sheet>
  );
}

Object.assign(window, { CortexxApp, DASHBOARDS, DASH_DESCRIPTIONS, SheetWrap });
