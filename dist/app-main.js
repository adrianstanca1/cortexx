function InteractiveTabBar({
  tab,
  setTab,
  onCapture,
  accent
}) {
  const tabs = [{
    k: 'dashboard',
    l: 'Dashboard',
    i: Ic.dashboard
  }, {
    k: 'projects',
    l: 'Projects',
    i: Ic.projects
  }, {
    k: '_fab'
  }, {
    k: 'tasks',
    l: 'Tasks',
    i: Ic.tasks
  }, {
    k: 'team',
    l: 'Team',
    i: Ic.team
  }];
  return React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(6,16,30,0.85)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderTop: `0.5px solid ${T.hair}`,
      paddingTop: 8,
      paddingBottom: 28,
      display: 'flex',
      alignItems: 'flex-start',
      zIndex: 10
    }
  }, tabs.map(t => {
    if (t.k === '_fab') {
      return React.createElement("div", {
        key: "_fab",
        style: {
          flex: 1,
          display: 'flex',
          justifyContent: 'center'
        }
      }, React.createElement("button", {
        onClick: onCapture,
        style: {
          width: 52,
          height: 52,
          borderRadius: 26,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          border: 'none',
          boxShadow: `0 6px 20px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginTop: -22
        }
      }, React.cloneElement(Ic.plus, {
        size: 26
      })));
    }
    const isActive = tab === t.k;
    return React.createElement("button", {
      key: t.k,
      onClick: () => setTab(t.k),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: isActive ? accent : T.t3,
        padding: '4px 0',
        transition: 'color 0.15s'
      }
    }, React.cloneElement(t.i, {
      size: 22
    }), React.createElement("span", {
      style: {
        fontFamily: SF,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.2
      }
    }, t.l));
  }));
}
const DASHBOARDS = {
  v1: {
    c: 'DashV1_ActionFirst',
    l: 'Action-first'
  },
  v2: {
    c: 'DashV2_StatusBoard',
    l: 'Status board'
  },
  v3: {
    c: 'DashV3_Calm',
    l: 'Calm'
  },
  v4: {
    c: 'DashV4_Bento',
    l: 'Bento'
  },
  v5: {
    c: 'DashV5_AIForward',
    l: 'AI-forward'
  },
  v6: {
    c: 'DashV6_Field',
    l: 'Field'
  },
  v7: {
    c: 'DashV7_Timeline',
    l: 'Timeline'
  },
  v8: {
    c: 'DashV8_Money',
    l: 'Books'
  },
  v9: {
    c: 'DashV9_Stories',
    l: 'Stories'
  },
  v10: {
    c: 'DashV10_Rings',
    l: 'Rings'
  },
  v11: {
    c: 'DashV11_Map',
    l: 'Map'
  },
  v12: {
    c: 'DashV12_Focus',
    l: 'Focus'
  },
  v13: {
    c: 'DashV13_Exec',
    l: 'Executive'
  },
  v14: {
    c: 'DashV14_Broadsheet',
    l: 'Broadsheet'
  },
  v15: {
    c: 'DashV15_SiteNotice',
    l: 'Site Notice'
  }
};
function CortexxApp({
  dashboardId = 'v1',
  accent = T.blue,
  openAI,
  onChangeDashboard
}) {
  const [tab, setTab] = React.useState('dashboard');
  const [sheet, setSheet] = React.useState(null);
  const [activeProject, setActiveProject] = React.useState(null);
  const [checkoutPlan, setCheckoutPlan] = React.useState(null);
  const [activeInvoice, setActiveInvoice] = React.useState(null);
  const [nfcCheckin, setNfcCheckin] = React.useState(null);
  React.useEffect(() => {
    const onNfc = e => {
      if (e.detail && e.detail.projectId != null) setNfcCheckin(e.detail.projectId);
    };
    window.addEventListener('cortexx-nfc-checkin', onNfc);
    return () => window.removeEventListener('cortexx-nfc-checkin', onNfc);
  }, []);
  const [activeQuote, setActiveQuote] = React.useState(null);
  const user = useDB('user');
  React.useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSheet('cmdk');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  React.useEffect(() => {
    window.cortexxNav = (key, payload) => {
      try {
        if (window.CortexAudit) {
          const me = window.__cortexxCurrentRole && window.CortexMembers ? (window.CortexMembers.list().find(m => m.status === 'active') || {}).name : null;
          const AUDIT_MAP = {
            addtask: ['opened New Task', 'Tasks'],
            chase: ['opened invoice chase', 'Money'],
            approval: ['opened approval', 'Variations'],
            signature: ['opened signature', 'Compliance'],
            estimator: ['opened AI estimator', 'Quotes'],
            scan: ['scanned a receipt', 'Money']
          };
          const hit = AUDIT_MAP[key];
          if (hit) window.CortexAudit.log(me || 'You', hit[0], hit[1]);
        }
      } catch (e) {}
      if (key === 'project') {
        setActiveProject(payload);
        setSheet('project');
      } else if (key === 'quote') {
        setActiveQuote(payload);
        setSheet('quote');
      } else if (key === 'chase') {
        setActiveInvoice(payload);
        setSheet('chase');
      } else if (key === 'addtask') {
        setSheet('addtask');
      } else if (key === 'addteam') {
        setSheet('addteam');
      } else if (key === 'rfi') {
        setActiveProject(payload);
        setSheet('rfi');
      } else if (key === 'msg') {
        setActiveProject(payload);
        setSheet('msg');
      } else if (key === 'docgen') {
        setActiveProject(payload);
        setSheet('docgen');
      } else if (key === 'improvement') {
        setActiveProject(payload);
        setSheet('improvement');
      } else if (key === 'editfield') {
        setActiveProject(payload);
        setSheet('editfield');
      } else if (key === 'smartparse' || key === 'parse') setSheet('smartparse');else if (key === 'phototosnag') setSheet('phototosnag');else if (key === 'starttrip') setSheet('starttrip');else if (key === 'addtag') setSheet('addtag');else if (key === 'addtemplate') setSheet('addtemplate');else if (key === 'addview') setSheet('addview');else if (key === 'addcost') setSheet('addcost');else if (key === 'addco') setSheet('addchange');else if (key === 'adddiaryentry') setSheet('adddiary');else if (key === 'tab') {
        setTab(payload);
        setSheet(null);
      } else {
        setSheet(key);
      }
    };
  }, []);
  const openProject = p => {
    setActiveProject(p);
    setSheet('project');
  };
  const openChase = iv => {
    setActiveInvoice(iv);
    setSheet('chase');
  };
  const openQuote = q => {
    setActiveQuote(q);
    setSheet('quote');
  };
  const closeSheet = () => {
    setSheet(null);
    setActiveProject(null);
    setActiveInvoice(null);
    setActiveQuote(null);
  };
  React.useEffect(() => {
    if (!localStorage.getItem('cortexx_onboarded')) {
      setTimeout(() => setSheet('onboarding'), 400);
    }
  }, []);
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (!action) return;
      const map = {
        task: () => setSheet('addtask'),
        receipt: () => setSheet('scan'),
        ai: () => setSheet('ai'),
        clock: () => setSheet('clock'),
        photo: () => setSheet('sitephoto'),
        voice: () => setSheet('voice')
      };
      const fn = map[action];
      if (fn) setTimeout(fn, 500);
      if (window.history?.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) {}
  }, []);
  React.useEffect(() => {
    window.cortexxSignOut = () => {
      localStorage.removeItem('cortexx_onboarded');
      localStorage.removeItem('cortexx_toured');
      setSheet('login');
      toast('Signed out', 'info');
    };
  }, []);
  const handleCapture = k => {
    setSheet(null);
    setTimeout(() => {
      if (k === 'task') setSheet('addtask');else if (k === 'photo') setSheet('sitephoto');else if (k === 'incident') setSheet('incident');else if (k === 'estimate') setSheet('estimator');else if (k === 'photomention') setSheet('photomention');else if (k === 'triage') setSheet('triage');else if (k === 'voice') setSheet('voice');else if (k === 'receipt') setSheet('scan');else if (k === 'money') setSheet('money');else if (k === 'safety') setSheet('safety');else if (k === 'profile') setSheet('profile');else if (k === 'ai') setSheet('ai');else if (k === 'inbox') setSheet('inbox');else if (k === 'quotes') setSheet('quotes');else if (k === 'time') setSheet('time');else if (k === 'calendar') setSheet('calendar');else if (k === 'materials') setSheet('materials');else if (k === 'subs') setSheet('subs');else if (k === 'docs') setSheet('docs');else if (k === 'diary') setSheet('diary');else if (k === 'snags') setSheet('snags');else if (k === 'changes') setSheet('changes');else if (k === 'equipment') setSheet('equipment');else if (k === 'rfis') setSheet('rfis');else if (k === 'messages') setSheet('messages');else if (k === 'reports') setSheet('reports');else if (k === 'timeline') setSheet('timeline');else if (k === 'settings') setSheet('settings');else if (k === 'help') setSheet('help');else if (k === 'pos') setSheet('pos');else if (k === 'portal') setSheet('portal');else if (k === 'inspections') setSheet('inspections');else if (k === 'customers') setSheet('customers');else if (k === 'leads') setSheet('leads');else if (k === 'photos') setSheet('photos');else if (k === 'photoreview') setSheet('photoreview');else if (k === 'tenant') setSheet('tenant');else if (k === 'admin') setSheet('admin');else if (k === 'billing') setSheet('billing');else if (k === 'auditlog') setSheet('auditlog');else if (k === 'dataexport') setSheet('dataexport');else if (k === 'payments') setSheet('payments');else if (k === 'newworkspace') setSheet('newworkspace');else if (k === 'notifprefs') setSheet('notifprefs');else if (k === 'digests') setSheet('digests');else if (k === 'clientmsgs') setSheet('clientmsgs');else if (k === 'ledger') setSheet('ledger');else if (k === 'cloudsync') setSheet('cloudsync');else if (k === 'aiengine') setSheet('aiengine');else if (k && k.indexOf('payinvoice:') === 0) {
        window.__cortexxPayInvoice = k.slice('payinvoice:'.length);
        setSheet('payinvoice');
      } else if (k === 'payinvoice') setSheet('payinvoice');else if (k === 'bankrec') setSheet('bankrec');else if (k === 'pushset') setSheet('pushset');else if (k === 'e2ee') setSheet('e2ee');else if (k === 'cis300') setSheet('cis300');else if (k === 'language') setSheet('language');else if (k === 'riddor') setSheet('riddor');else if (k === 'retention') setSheet('retention');else if (k && k.indexOf('retentioninv:') === 0) {
        window.__cortexxRetentionInv = k.slice('retentioninv:'.length);
        setSheet('retentioninv');
      } else if (k === 'retentioninv') setSheet('retentioninv');else if (k === 'subscription') setSheet('subscription');else if (k === 'observability') setSheet('observability');else if (k === 'photomention') setSheet('photomention');else if (k === 'triage') setSheet('triage');else if (k === 'nfctags') setSheet('nfctags');else if (k === 'attendance') setSheet('attendance');else if (k === 'labels') setSheet('labels');else if (k === 'sitemap') setSheet('sitemap');else if (k === 'switchworkspace') setSheet('switchworkspace');else if (k === 'checkout') {
        window.__checkoutPlan = payload;
        setCheckoutPlan(payload);
        setSheet('checkout');
      } else if (k === 'sso') setSheet('sso');else if (k === 'addco') setSheet('addchange');else if (k === 'adddiaryentry') setSheet('adddiary');else if (k === 'addpo') setSheet('addpo');else if (k === 'addreceipt') setSheet('addreceipt');else if (k === 'addinvoice') setSheet('addinvoice');else if (k === 'addquote') setSheet('addquote');else if (k === 'addincident') setSheet('addincident');else if (k === 'toolboxtalk') setSheet('toolboxtalk');else if (k === 'delivery') setSheet('delivery');else if (k === 'weeklyreport') setSheet('weeklyreport');else if (k === 'dayend') setSheet('dayend');else if (k === 'mileage') setSheet('mileage');else if (k === 'activity') setSheet('activity');else if (k === 'templates') setSheet('templates');else if (k === 'forms') setSheet('forms');else if (k === 'drawings') setSheet('drawings');else if (k === 'permits') setSheet('permits');else if (k === 'goals') setSheet('goals');else if (k === 'subinvoices') setSheet('subinvoices');else if (k === 'addcustomer') setSheet('addcustomer');else if (k === 'addlead') setSheet('addlead');else if (k === 'addpermit') setSheet('addpermit');else if (k === 'addgoal') setSheet('addgoal');else if (k === 'upload') setSheet('upload');else if (k === 'reviews') setSheet('reviews');else if (k === 'database') setSheet('database');else if (k === 'reminders') setSheet('reminders');else if (k === 'performance') setSheet('performance');else if (k === 'clock' || k === 'checkin2') setSheet('clock');else if (k === 'livestatus') setSheet('livestatus');else if (k === 'myday') setSheet('myday');else if (k === 'workspace') setSheet('workspace');else if (k === 'annotate') setSheet('annotate');else if (k === 'health') setSheet('health');else if (k === 'infrastructure') setSheet('infrastructure');else if (k === 'vera') setSheet('vera');else if (k === 'veraauto') setSheet('veraauto');else if (k === 'personas') setSheet('personas');else if (k === 'bank') setSheet('bank');else if (k === 'payroll') setSheet('payroll');else if (k === 'holiday') setSheet('holiday');else if (k === 'apprentice') setSheet('apprentice');else if (k === 'carbon') setSheet('carbon');else if (k === 'waste') setSheet('waste');else if (k === 'claims') setSheet('claims');else if (k === 'training') setSheet('training');else if (k === 'launch') setSheet('launch');else if (k === 'subportal') setSheet('subportal');else if (k === 'currency') setSheet('currency');else if (k === 'api') setSheet('api');else if (k === 'templatelib') setSheet('templatelib');else if (k === 'audittrail') setSheet('audittrail');else if (k === 'tags') setSheet('tags');else if (k === 'views') setSheet('views');else if (k === 'roles') setSheet('roles');else if (k === 'tour') setSheet('tour');else if (k === 'catalog') setSheet('catalog');else if (k === 'tomorrow') setSheet('tomorrow');else if (k === 'improve' || k === 'services' || k === 'processes' || k === 'kaizen') setSheet(k);else if (k === 'checkin') {
        setSheet('clock');
        return;
      }
    }, 220);
  };
  const DashComp = window[DASHBOARDS[dashboardId].c];
  return React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      background: T.bg0,
      color: T.t1,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement(IOSStatusBar, {
    dark: true
  }), React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      position: 'relative'
    }
  }, tab === 'dashboard' && DashComp && React.createElement("div", {
    style: {
      width: '100%',
      height: '100%'
    }
  }, React.createElement(DashComp, {
    accent: accent
  })), tab === 'projects' && React.createElement(ProjectsScreen, {
    openProject: openProject,
    accent: accent
  }), tab === 'tasks' && React.createElement(TasksScreen, {
    accent: accent,
    onAdd: () => setSheet('addtask')
  }), tab === 'team' && React.createElement(TeamScreen, {
    accent: accent
  }), tab === 'money' && React.createElement(MoneyScreen, {
    accent: accent,
    onChase: openChase
  }), tab === 'safety' && React.createElement(SafetyScreen, {
    accent: accent
  })), React.createElement(ResponsiveSidebar, {
    tab: tab,
    setTab: setTab,
    accent: accent
  }), React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 11
    }
  }, React.createElement(InteractiveTabBar, {
    tab: tab,
    setTab: setTab,
    onCapture: () => setSheet('capture'),
    accent: accent
  })), React.createElement(FloatingUploadPill, {
    accent: accent
  }), true && React.createElement("button", {
    onClick: () => setSheet('ai'),
    style: {
      position: 'absolute',
      right: 16,
      bottom: 96,
      zIndex: 9,
      width: 50,
      height: 50,
      borderRadius: 25,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: `0 8px 24px ${T.purple}66`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.spark, {
    size: 22
  })), tab === 'dashboard' && React.createElement(CmdKHint, {
    accent: accent
  }), tab === 'dashboard' && onChangeDashboard && React.createElement("button", {
    onClick: () => setSheet('dashpick'),
    style: {
      position: 'absolute',
      right: 12,
      bottom: 158,
      zIndex: 9,
      background: 'rgba(6,16,30,0.75)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: `0.5px solid ${T.hairMid}`,
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 11,
      fontWeight: 600,
      padding: '7px 10px',
      borderRadius: 14,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      whiteSpace: 'nowrap',
      boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
    }
  }, React.createElement("span", {
    style: {
      color: accent
    }
  }, React.cloneElement(Ic.layers, {
    size: 12
  })), dashboardId.toUpperCase(), React.createElement("span", {
    style: {
      color: T.t3
    }
  }, "\xB7"), DASHBOARDS[dashboardId].l, React.cloneElement(Ic.chevDown, {
    size: 11
  })), sheet === 'project' && React.createElement(ProjectSheet, {
    project: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'capture' && React.createElement(CaptureSheet, {
    onClose: closeSheet,
    accent: accent,
    onAction: handleCapture
  }), sheet === 'ai' && React.createElement(AISheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'safety' && React.createElement(SheetWrap, {
    title: "Safety",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SafetyScreen, {
    accent: accent
  })), sheet === 'money' && React.createElement(SheetWrap, {
    title: "Money",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(MoneyScreen, {
    accent: accent,
    onChase: openChase
  })), sheet === 'profile' && React.createElement(SheetWrap, {
    title: "Profile",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ProfileScreen, {
    accent: accent,
    onSignOut: closeSheet
  })), sheet === 'inbox' && React.createElement(SheetWrap, {
    title: "Inbox",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(InboxScreen, {
    accent: accent,
    onAction: a => {
      closeSheet();
      setTimeout(() => setSheet(a), 200);
    }
  })), sheet === 'quotes' && React.createElement(SheetWrap, {
    title: "Quotes",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(QuotesScreen, {
    accent: accent,
    onAdd: () => {
      closeSheet();
      setTimeout(() => setSheet('estimator'), 200);
    },
    onOpen: openQuote
  })), sheet === 'time' && React.createElement(SheetWrap, {
    title: "Timesheets",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TimesheetsScreen, {
    accent: accent
  })), sheet === 'calendar' && React.createElement(SheetWrap, {
    title: "Schedule",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CalendarScreen, {
    accent: accent
  })), sheet === 'materials' && React.createElement(SheetWrap, {
    title: "Materials",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(MaterialsScreen, {
    accent: accent
  })), sheet === 'subs' && React.createElement(SheetWrap, {
    title: "Subcontractors",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SubsScreen, {
    accent: accent
  })), sheet === 'docs' && React.createElement(SheetWrap, {
    title: "Documents",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(DocumentsScreen, {
    accent: accent
  })), sheet === 'diary' && React.createElement(SheetWrap, {
    title: "Site diary",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(DiaryScreen, {
    accent: accent
  })), sheet === 'snags' && React.createElement(SheetWrap, {
    title: "Snags",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SnagsScreen, {
    accent: accent
  })), sheet === 'changes' && React.createElement(SheetWrap, {
    title: "Variations",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ChangeOrdersScreen, {
    accent: accent
  })), sheet === 'equipment' && React.createElement(SheetWrap, {
    title: "Equipment",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(EquipmentScreen, {
    accent: accent
  })), sheet === 'addtask' && React.createElement(AddTaskSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'scan' && React.createElement(ReceiptScanSheetReal, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'chase' && activeInvoice && React.createElement(ChaseSheet, {
    invoice: activeInvoice,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'estimator' && React.createElement(AIEstimatorSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'quote' && activeQuote && React.createElement(QuoteDetailSheet, {
    quote: activeQuote,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'onboarding' && React.createElement(OnboardingSheet, {
    onClose: () => {
      closeSheet();
      localStorage.setItem('cortexx_onboarded', '1');
      if (!localStorage.getItem('cortexx_toured')) {
        localStorage.setItem('cortexx_toured', '1');
        setTimeout(() => setSheet('tour'), 320);
      }
    },
    accent: accent
  }), sheet === 'search' && React.createElement(SearchSheet, {
    onClose: closeSheet,
    accent: accent,
    onNavigate: (k, p) => {
      closeSheet();
      setTimeout(() => window.cortexxNav(k, p), 200);
    }
  }), sheet === 'addproject' && React.createElement(AddProjectSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addinvoice' && React.createElement(AddInvoiceSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addquote' && React.createElement(AddQuoteSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addreceipt' && React.createElement(AddReceiptSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addpo' && React.createElement(AddPOSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addincident' && React.createElement(AddIncidentSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addmaterial' && React.createElement(AddMaterialSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addsub' && React.createElement(AddSubSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addequipment' && React.createElement(AddEquipmentSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addsnag' && React.createElement(AddSnagSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addchange' && React.createElement(AddChangeOrderSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addinspection' && React.createElement(AddInspectionSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'adddiary' && React.createElement(AddDiarySheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addteam' && React.createElement(AddTeamMemberSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'rfis' && React.createElement(SheetWrap, {
    title: "RFIs",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(RFIsScreen, {
    accent: accent,
    onOpen: r => {
      setActiveProject(r);
      setSheet('rfi');
    }
  })), sheet === 'rfi' && activeProject && React.createElement(RFIDetailSheet, {
    rfi: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addrfi' && React.createElement(AddRFISheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'messages' && React.createElement(SheetWrap, {
    title: "Messages",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(MessagesScreen, {
    accent: accent,
    onOpen: m => {
      setActiveProject(m);
      setSheet('msg');
    }
  })), sheet === 'msg' && activeProject && React.createElement(MessageThreadSheet, {
    thread: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'reports' && React.createElement(SheetWrap, {
    title: "Reports",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ReportsScreen, {
    accent: accent
  })), sheet === 'timeline' && React.createElement(SheetWrap, {
    title: "Timeline",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TimelineScreen, {
    accent: accent
  })), sheet === 'login' && React.createElement(LoginSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'settings' && React.createElement(SheetWrap, {
    title: "Settings",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SettingsScreen, {
    accent: accent
  })), sheet === 'help' && React.createElement(SheetWrap, {
    title: "Help",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(HelpScreen, {
    accent: accent
  })), sheet === 'pos' && React.createElement(SheetWrap, {
    title: "Purchase orders",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PurchaseOrdersScreen, {
    accent: accent
  })), sheet === 'portal' && React.createElement(SheetWrap, {
    title: "Client portal",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ClientPortalScreen, {
    accent: accent
  })), sheet === 'inspections' && React.createElement(SheetWrap, {
    title: "Inspections",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(InspectionsScreen, {
    accent: accent,
    onOpen: i => {
      setActiveProject(i);
      setSheet('inspection');
    }
  })), sheet === 'inspection' && activeProject && React.createElement(InspectionDetailSheet, {
    inspection: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'customers' && React.createElement(SheetWrap, {
    title: "Customers",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CustomersScreen, {
    accent: accent,
    onOpen: c => {
      setActiveProject(c);
      setSheet('customer');
    }
  })), sheet === 'customer' && activeProject && React.createElement(CustomerDetailSheet, {
    customer: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'leads' && React.createElement(SheetWrap, {
    title: "Leads",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LeadsScreen, {
    accent: accent
  })), sheet === 'photos' && React.createElement(SheetWrap, {
    title: "Photos",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PhotosV2Screen, {
    accent: accent
  })), sheet === 'photoreview' && React.createElement(SheetWrap, {
    title: "Photo review",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PhotoReviewScreen, {
    accent: accent
  })), sheet === 'tenant' && React.createElement(SheetWrap, {
    title: "Workspaces",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TenantScreen, {
    accent: accent
  })), sheet === 'admin' && React.createElement(SheetWrap, {
    title: "Org admin",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(AdminScreen, {
    accent: accent
  })), sheet === 'billing' && React.createElement(SheetWrap, {
    title: "Billing",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(BillingScreen, {
    accent: accent
  })), sheet === 'auditlog' && React.createElement(SheetWrap, {
    title: "Audit log",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(AuditScreen, {
    accent: accent
  })), sheet === 'dataexport' && React.createElement(SheetWrap, {
    title: "Export data",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(DataExportScreen, {
    accent: accent
  })), sheet === 'payments' && React.createElement(SheetWrap, {
    title: "Payments",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PaymentsLedgerScreen, {
    accent: accent
  })), sheet === 'newworkspace' && React.createElement(OnboardWizard, {
    accent: accent,
    onClose: closeSheet
  }), sheet === 'notifprefs' && React.createElement(SheetWrap, {
    title: "Notifications",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(NotificationPrefsScreen, {
    accent: accent
  })), sheet === 'digests' && React.createElement(SheetWrap, {
    title: "Digests",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(DigestScreen, {
    accent: accent
  })), sheet === 'clientmsgs' && React.createElement(SheetWrap, {
    title: "Client messages",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ClientMessagesScreen, {
    accent: accent
  })), sheet === 'ledger' && React.createElement(SheetWrap, {
    title: "Ledger export",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LedgerExportScreen, {
    accent: accent
  })), sheet === 'cloudsync' && React.createElement(SheetWrap, {
    title: "Cloud sync",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CloudSyncScreen, {
    accent: accent
  })), sheet === 'aiengine' && React.createElement(SheetWrap, {
    title: "AI engine",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LLMSettingsScreen, {
    accent: accent
  })), sheet === 'payinvoice' && React.createElement(SheetWrap, {
    title: "Payment link",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PaymentLinkScreen, {
    accent: accent,
    invoiceId: window.__cortexxPayInvoice,
    onClose: closeSheet
  })), sheet === 'bankrec' && React.createElement(SheetWrap, {
    title: "Bank reconciliation",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(BankRecScreen, {
    accent: accent
  })), sheet === 'pushset' && React.createElement(SheetWrap, {
    title: "Push notifications",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PushSettingsScreen, {
    accent: accent
  })), sheet === 'e2ee' && React.createElement(SheetWrap, {
    title: "End-to-end encryption",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(E2EEScreen, {
    accent: accent
  })), sheet === 'cis300' && React.createElement(SheetWrap, {
    title: "CIS300",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CIS300Screen, {
    accent: accent
  })), sheet === 'language' && React.createElement(SheetWrap, {
    title: "Language",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LanguageSettingsScreen, {
    accent: accent
  })), sheet === 'riddor' && React.createElement(SheetWrap, {
    title: "RIDDOR",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(RIDDORScreen, {
    accent: accent
  })), sheet === 'retention' && React.createElement(SheetWrap, {
    title: "Retention",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(RetentionLedgerScreen, {
    accent: accent
  })), sheet === 'retentioninv' && React.createElement(SheetWrap, {
    title: "Retention",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(RetentionSheet, {
    accent: accent,
    invoiceId: window.__cortexxRetentionInv,
    onClose: closeSheet
  })), sheet === 'subscription' && React.createElement(SheetWrap, {
    title: "Subscription",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SubscriptionScreen, {
    accent: accent,
    onClose: closeSheet
  })), sheet === 'observability' && React.createElement(SheetWrap, {
    title: "Observability",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ObservabilityScreen, {
    accent: accent
  })), sheet === 'photomention' && React.createElement(PhotoMentionSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'triage' && React.createElement(InboxTriageSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'nfctags' && React.createElement(SheetWrap, {
    title: "NFC site tags",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(NfcProvisionScreen, {
    accent: accent
  })), sheet === 'attendance' && React.createElement(SheetWrap, {
    title: "On site now",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SiteAttendanceScreen, {
    accent: accent
  })), sheet === 'labels' && React.createElement(SheetWrap, {
    title: "Label printer",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LabelPrinterScreen, {
    accent: accent
  })), sheet === 'sitemap' && React.createElement(SheetWrap, {
    title: "Site map",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(OfflineMapScreen, {
    accent: accent
  })), nfcCheckin != null && React.createElement(NfcCheckinConfirm, {
    projectId: nfcCheckin,
    accent: accent,
    onDone: () => setNfcCheckin(null)
  }), sheet === 'switchworkspace' && React.createElement(WorkspaceSwitcher, {
    accent: accent,
    onClose: closeSheet
  }), sheet === 'checkout' && (() => {
    const cp = checkoutPlan || window.__checkoutPlan || {
      plan: 'Pro',
      price: '£29'
    };
    return React.createElement(CheckoutSheet, {
      accent: accent,
      plan: cp.plan,
      price: cp.price,
      onClose: closeSheet
    });
  })(), sheet === 'sso' && React.createElement(SSOLoginScreen, {
    accent: accent,
    onClose: closeSheet
  }), sheet === 'mileage' && React.createElement(SheetWrap, {
    title: "Mileage",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(MileageScreen, {
    accent: accent
  })), sheet === 'activity' && React.createElement(SheetWrap, {
    title: "Activity",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ActivityScreen, {
    accent: accent
  })), sheet === 'templates' && React.createElement(SheetWrap, {
    title: "Job templates",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TemplatesScreen, {
    accent: accent
  })), sheet === 'forms' && React.createElement(SheetWrap, {
    title: "Forms",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(FormsScreen, {
    accent: accent
  })), sheet === 'drawings' && React.createElement(SheetWrap, {
    title: "Drawings",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(DrawingsScreen, {
    accent: accent,
    onOpen: d => {
      setActiveProject(d);
      setSheet('drawing');
    }
  })), sheet === 'drawing' && activeProject && React.createElement(DrawingViewerSheet, {
    drawing: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'permits' && React.createElement(SheetWrap, {
    title: "Permits",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PermitsScreen, {
    accent: accent
  })), sheet === 'goals' && React.createElement(SheetWrap, {
    title: "Goals",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(GoalsScreen, {
    accent: accent
  })), sheet === 'voice' && React.createElement(VoiceMemoSheetReal, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'subinvoices' && React.createElement(SheetWrap, {
    title: "Sub invoices",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SubInvoicesScreen, {
    accent: accent
  })), sheet === 'addcustomer' && React.createElement(AddCustomerSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addlead' && React.createElement(AddLeadSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addpermit' && React.createElement(AddPermitSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addgoal' && React.createElement(AddGoalSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'upload' && React.createElement(UploadSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'reviews' && React.createElement(SheetWrap, {
    title: "Reviews",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ReviewsScreen, {
    accent: accent
  })), sheet === 'database' && React.createElement(SheetWrap, {
    title: "Database",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(DatabaseScreen, {
    accent: accent
  })), sheet === 'reminders' && React.createElement(SheetWrap, {
    title: "Reminders",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(RemindersScreen, {
    accent: accent
  })), sheet === 'performance' && React.createElement(SheetWrap, {
    title: "Performance",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PerformanceScreen, {
    accent: accent
  })), sheet === 'clock' && React.createElement(SheetWrap, {
    title: "Check in",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CheckInScreen, {
    accent: accent
  })), sheet === 'livestatus' && React.createElement(SheetWrap, {
    title: "Live status",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LiveStatusScreen, {
    accent: accent
  })), sheet === 'myday' && React.createElement(SheetWrap, {
    title: "My day",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(MyDayScreen, {
    accent: accent
  })), sheet === 'workspace' && React.createElement(WorkspaceSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'annotate' && React.createElement(PhotoAnnotateSheet, {
    snag: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'health' && activeProject && React.createElement(HealthCheckSheet, {
    project: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'infrastructure' && React.createElement(SheetWrap, {
    title: "Infrastructure",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(InfrastructureScreen, {
    accent: accent
  })), sheet === 'vera' && React.createElement(SheetWrap, {
    title: "Vera \xB7 CEO",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(VeraScreen, {
    accent: accent
  })), sheet === 'veraauto' && React.createElement(SheetWrap, {
    title: "Vera \xB7 autopilot",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(VeraActionsScreen, {
    accent: accent
  })), sheet === 'personas' && React.createElement(SheetWrap, {
    title: "Leadership",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PersonasScreen, {
    accent: accent
  })), sheet === 'bank' && React.createElement(SheetWrap, {
    title: "Banking",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(BankScreen, {
    accent: accent
  })), sheet === 'payroll' && React.createElement(SheetWrap, {
    title: "Payroll",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(PayrollScreen, {
    accent: accent
  })), sheet === 'holiday' && React.createElement(SheetWrap, {
    title: "Holiday",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(HolidayScreen, {
    accent: accent
  })), sheet === 'apprentice' && React.createElement(SheetWrap, {
    title: "Apprentices",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ApprenticeScreen, {
    accent: accent
  })), sheet === 'carbon' && React.createElement(SheetWrap, {
    title: "Carbon",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CarbonScreen, {
    accent: accent
  })), sheet === 'waste' && React.createElement(SheetWrap, {
    title: "Waste",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(WasteScreen, {
    accent: accent
  })), sheet === 'claims' && React.createElement(SheetWrap, {
    title: "Insurance claims",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ClaimsScreen, {
    accent: accent
  })), sheet === 'member' && activeProject && React.createElement(TeamMemberSheet, {
    member: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addcert' && activeProject && React.createElement(AddCertSheet, {
    member: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'training' && React.createElement(SheetWrap, {
    title: "Training matrix",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TrainingMatrixScreen, {
    accent: accent
  })), sheet === 'launch' && React.createElement(SheetWrap, {
    title: "About & legal",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(LaunchScreen, {
    accent: accent
  })), sheet === 'cmdk' && React.createElement(CommandPalette, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'aihistory' && React.createElement(SheetWrap, {
    title: "AI history",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(AIHistoryScreen, {
    accent: accent
  })), sheet === 'signature' && React.createElement(SignatureSheet, {
    subject: activeProject?.subject || 'Document',
    signerName: activeProject?.signerName,
    onSigned: activeProject?.onSigned,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'approval' && React.createElement(ApprovalSheet, {
    item: activeProject,
    onApproved: activeProject?.onApproved,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'subportal' && React.createElement(SheetWrap, {
    title: "Sub portal",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SubPortalScreen, {
    accent: accent
  })), sheet === 'currency' && React.createElement(SheetWrap, {
    title: "Currency",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CurrencyScreen, {
    accent: accent
  })), sheet === 'api' && React.createElement(SheetWrap, {
    title: "API",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(APIScreen, {
    accent: accent
  })), sheet === 'templatelib' && React.createElement(SheetWrap, {
    title: "Templates",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TemplateLibScreen, {
    accent: accent
  })), sheet === 'audittrail' && React.createElement(SheetWrap, {
    title: "Audit trail",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(AuditTrailScreen, {
    accent: accent
  })), sheet === 'tags' && React.createElement(SheetWrap, {
    title: "Tags",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(TagsScreen, {
    accent: accent
  })), sheet === 'views' && React.createElement(SheetWrap, {
    title: "Saved views",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(SavedViewsScreen, {
    accent: accent
  })), sheet === 'roles' && React.createElement(SheetWrap, {
    title: "Roles",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(RolesScreen, {
    accent: accent
  })), sheet === 'tour' && React.createElement(TourSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'catalog' && React.createElement(SheetWrap, {
    title: "Cost catalog",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(CostCatalogScreen, {
    accent: accent
  })), sheet === 'tomorrow' && React.createElement(TomorrowSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'improve' && React.createElement(SheetWrap, {
    title: "Improve",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ImproveHubScreen, {
    accent: accent
  })), sheet === 'services' && React.createElement(SheetWrap, {
    title: "Services",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ServiceCatalogScreen, {
    accent: accent
  })), sheet === 'processes' && React.createElement(SheetWrap, {
    title: "Processes",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ProcessLibraryScreen, {
    accent: accent
  })), sheet === 'kaizen' && React.createElement(SheetWrap, {
    title: "Kaizen",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(KaizenBoardScreen, {
    accent: accent
  })), sheet === 'docgen' && React.createElement(DocGenSheet, {
    docKind: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addholiday' && React.createElement(AddHolidaySheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addclaim' && React.createElement(AddClaimSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addimprovement' && React.createElement(AddImprovementSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'improvement' && activeProject && React.createElement(ImprovementDetailSheet, {
    improvement: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'sitephoto' && React.createElement(SiteProgressPhotoSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'incident' && React.createElement(IncidentReportSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'editfield' && React.createElement(EditFieldSheet, {
    params: activeProject,
    onClose: closeSheet,
    accent: accent
  }), sheet === 'starttrip' && React.createElement(StartTripSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addtag' && React.createElement(AddTagSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addtemplate' && React.createElement(AddTemplateSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addview' && React.createElement(AddViewSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'toolboxtalk' && React.createElement(ToolboxTalkSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'resourceplan' && React.createElement(SheetWrap, {
    title: "Resource planning",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ResourcePlanningScreen, {
    accent: accent
  })), sheet === 'addallocation' && React.createElement(AddAllocationSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'finintel' && React.createElement(SheetWrap, {
    title: "Financial intelligence",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(FinancialIntelligenceScreen, {
    accent: accent
  })), sheet === 'bids' && React.createElement(SheetWrap, {
    title: "Bids & tender",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(BidManagementScreen, {
    accent: accent
  })), sheet === 'procurement' && React.createElement(SheetWrap, {
    title: "Procurement",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ProcurementScreen, {
    accent: accent
  })), sheet === 'confirmdelivery' && React.createElement(DeliveryConfirmSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'handover' && React.createElement(SheetWrap, {
    title: "Quality & handover",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(QualityHandoverScreen, {
    accent: accent
  })), sheet === 'hscommand' && React.createElement(SheetWrap, {
    title: "H&S command centre",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(HSCommandScreen, {
    accent: accent
  })), sheet === 'clientexp' && React.createElement(SheetWrap, {
    title: "Client experience",
    onClose: closeSheet,
    accent: accent
  }, React.createElement(ClientExperienceScreen, {
    accent: accent
  })), sheet === 'postupdate' && React.createElement(PostUpdateSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'delivery' && React.createElement(DeliveryConfirmSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'weeklyreport' && React.createElement(WeeklyReportSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'dayend' && React.createElement(DayEndReportSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'addcost' && React.createElement(AddCostItemSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'smartparse' && React.createElement(SmartParseSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'phototosnag' && React.createElement(PhotoToSnagSheet, {
    onClose: closeSheet,
    accent: accent
  }), sheet === 'dashpick' && React.createElement(Sheet, {
    onClose: closeSheet,
    height: "auto"
  }, React.createElement("div", {
    style: {
      padding: '8px 20px 14px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 17,
      fontWeight: 600,
      color: T.t1
    }
  }, "Dashboard layout"), React.createElement("div", {
    style: {
      padding: '0 16px 28px'
    }
  }, React.createElement(GroupedList, null, Object.entries(DASHBOARDS).map(([k, v], i, a) => React.createElement(Row, {
    key: k,
    icon: Ic.layers,
    iconBg: dashboardId === k ? accent : T.t3,
    title: `${k.toUpperCase()} · ${v.l}`,
    sub: DASH_DESCRIPTIONS[k],
    right: dashboardId === k ? React.createElement("span", {
      style: {
        color: accent
      }
    }, Ic.check) : null,
    isLast: i === a.length - 1,
    onClick: () => {
      onChangeDashboard(k);
      closeSheet();
    }
  }))))), window.TaskBulkActionBar && React.createElement(TaskBulkActionBar, null));
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
  v15: 'Site Notice — brutalist plaque'
};
function SheetWrap({
  title,
  onClose,
  accent,
  children
}) {
  return React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: `0.5px solid ${T.hair}`,
      background: T.bg0,
      position: 'relative',
      zIndex: 5
    }
  }, React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 2
    }
  }, Ic.chevL, " ", React.createElement("span", null, "Back")), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, title), React.createElement("div", {
    style: {
      width: 50
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      position: 'relative'
    }
  }, window.CortexScreenBoundary ? React.createElement(window.CortexScreenBoundary, null, children) : children));
}
Object.assign(window, {
  CortexxApp,
  DASHBOARDS,
  DASH_DESCRIPTIONS,
  SheetWrap
});