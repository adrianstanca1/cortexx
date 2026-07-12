// Cortexx — Global side menu (hamburger + slide-out drawer)
// Lives at the app-shell level so it's reachable on every page. Opens a
// categorised drawer of the whole app; every row routes through the global
// window.cortexxNav(key[, payload]) dispatcher. Tabs use ('tab', <id>).

function GlobalSideMenu({
  accent = T.blue
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  // Expose an imperative opener so any screen can pop the menu.
  React.useEffect(() => {
    window.cortexxOpenMenu = () => setOpen(true);
    window.cortexxCloseMenu = () => setOpen(false);
    return () => {
      delete window.cortexxOpenMenu;
      delete window.cortexxCloseMenu;
    };
  }, []);

  // Esc closes.
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const go = (k, payload) => {
    setOpen(false);
    setTimeout(() => {
      try {
        window.cortexxNav(k, payload);
      } catch (e) {}
    }, 170);
  };
  const SECTIONS = [{
    h: 'Workspace',
    items: [{
      l: 'Dashboard',
      i: Ic.dashboard,
      k: 'tab',
      p: 'dashboard'
    }, {
      l: 'My day',
      i: Ic.clock,
      k: 'myday'
    }, {
      l: 'Tomorrow',
      i: Ic.calendar || Ic.clock,
      k: 'tomorrow'
    }, {
      l: 'Calendar',
      i: Ic.calendar || Ic.book,
      k: 'calendar'
    }, {
      l: 'Projects',
      i: Ic.projects,
      k: 'tab',
      p: 'projects'
    }, {
      l: 'Tasks',
      i: Ic.tasks,
      k: 'tab',
      p: 'tasks'
    }, {
      l: 'Goals',
      i: Ic.trend,
      k: 'goals'
    }, {
      l: 'Activity',
      i: Ic.activity || Ic.list,
      k: 'activity'
    }, {
      l: 'Timeline',
      i: Ic.list,
      k: 'timeline'
    }]
  }, {
    h: 'Site operations',
    items: [{
      l: 'On site now',
      i: Ic.pin,
      k: 'attendance'
    }, {
      l: 'Check in / out',
      i: Ic.clock,
      k: 'clock'
    }, {
      l: 'Site map',
      i: Ic.pin,
      k: 'sitemap'
    }, {
      l: 'Site diary',
      i: Ic.book,
      k: 'diary'
    }, {
      l: 'Snags',
      i: Ic.alert,
      k: 'snags'
    }, {
      l: 'Inspections',
      i: Ic.check || Ic.shield,
      k: 'inspections'
    }, {
      l: 'Permits',
      i: Ic.doc,
      k: 'permits'
    }, {
      l: 'RFIs',
      i: Ic.inbox,
      k: 'rfis'
    }, {
      l: 'Drawings',
      i: Ic.layers,
      k: 'drawings'
    }, {
      l: 'Photos',
      i: Ic.camera,
      k: 'photos'
    }, {
      l: 'Photo review',
      i: Ic.camera,
      k: 'photoreview'
    }, {
      l: 'Deliveries',
      i: Ic.truck,
      k: 'delivery'
    }, {
      l: 'NFC site tags',
      i: Ic.flag,
      k: 'nfctags'
    }, {
      l: 'Weekly report',
      i: Ic.doc,
      k: 'weeklyreport'
    }, {
      l: 'Day end',
      i: Ic.moon || Ic.clock,
      k: 'dayend'
    }]
  }, {
    h: 'Safety & compliance',
    items: [{
      l: 'Safety hub',
      i: Ic.safety,
      k: 'safety'
    }, {
      l: 'Report incident',
      i: Ic.alert,
      k: 'incident'
    }, {
      l: 'RIDDOR',
      i: Ic.shield,
      k: 'riddor'
    }, {
      l: 'Toolbox talks',
      i: Ic.hardhat,
      k: 'toolboxtalk'
    }, {
      l: 'Training',
      i: Ic.hardhat,
      k: 'training'
    }, {
      l: 'Health check',
      i: Ic.activity || Ic.shield,
      k: 'health'
    }, {
      l: 'Audit log',
      i: Ic.shield,
      k: 'auditlog'
    }]
  }, {
    h: 'Sales & clients',
    items: [{
      l: 'Leads',
      i: Ic.trend,
      k: 'leads'
    }, {
      l: 'Customers',
      i: Ic.team,
      k: 'customers'
    }, {
      l: 'Quotes',
      i: Ic.doc,
      k: 'quotes'
    }, {
      l: 'Estimator',
      i: Ic.edit,
      k: 'estimate'
    }, {
      l: 'Client portal',
      i: Ic.briefcase,
      k: 'portal'
    }, {
      l: 'Client messages',
      i: Ic.inbox,
      k: 'clientmsgs'
    }, {
      l: 'Reviews',
      i: Ic.star || Ic.trend,
      k: 'reviews'
    }]
  }, {
    h: 'Money & accounting',
    items: [{
      l: 'Money hub',
      i: Ic.money,
      k: 'money'
    }, {
      l: 'Payments',
      i: Ic.money,
      k: 'payments'
    }, {
      l: 'Ledger',
      i: Ic.book,
      k: 'ledger'
    }, {
      l: 'Scan receipt',
      i: Ic.receipt,
      k: 'receipt'
    }, {
      l: 'Open banking',
      i: Ic.money,
      k: 'bank'
    }, {
      l: 'Bank reconciliation',
      i: Ic.check || Ic.money,
      k: 'bankrec'
    }, {
      l: 'CIS 300',
      i: Ic.doc,
      k: 'cis300'
    }, {
      l: 'Retention',
      i: Ic.clock,
      k: 'retention'
    }, {
      l: 'Sub invoices',
      i: Ic.doc,
      k: 'subinvoices'
    }, {
      l: 'Billing & plan',
      i: Ic.receipt,
      k: 'subscription'
    }]
  }, {
    h: 'Procurement & supply',
    items: [{
      l: 'Purchase orders',
      i: Ic.receipt,
      k: 'pos'
    }, {
      l: 'Materials',
      i: Ic.box,
      k: 'materials'
    }, {
      l: 'Equipment & plant',
      i: Ic.truck,
      k: 'equipment'
    }, {
      l: 'Price catalog',
      i: Ic.list,
      k: 'catalog'
    }, {
      l: 'Subcontractors',
      i: Ic.team,
      k: 'subs'
    }, {
      l: 'Sub portal',
      i: Ic.briefcase,
      k: 'subportal'
    }, {
      l: 'Change orders',
      i: Ic.edit,
      k: 'changes'
    }]
  }, {
    h: 'People & time',
    items: [{
      l: 'Team',
      i: Ic.team,
      k: 'tab',
      p: 'team'
    }, {
      l: 'Invite teammate',
      i: Ic.plus,
      k: 'inviteteam'
    }, {
      l: 'Timesheets',
      i: Ic.clock,
      k: 'time'
    }, {
      l: 'Live status',
      i: Ic.team,
      k: 'livestatus'
    }, {
      l: 'Holiday',
      i: Ic.calendar || Ic.clock,
      k: 'holiday'
    }, {
      l: 'Payroll',
      i: Ic.money,
      k: 'payroll'
    }, {
      l: 'Mileage',
      i: Ic.truck,
      k: 'mileage'
    }, {
      l: 'Apprentices',
      i: Ic.hardhat,
      k: 'apprentice'
    }]
  }, {
    h: 'Documents & data',
    items: [{
      l: 'Documents',
      i: Ic.doc,
      k: 'docs'
    }, {
      l: 'Doc generator',
      i: Ic.spark,
      k: 'docgen'
    }, {
      l: 'Templates',
      i: Ic.copy,
      k: 'templates'
    }, {
      l: 'Template library',
      i: Ic.archive,
      k: 'templatelib'
    }, {
      l: 'Forms',
      i: Ic.list,
      k: 'forms'
    }, {
      l: 'Upload',
      i: Ic.upload,
      k: 'upload'
    }, {
      l: 'Database',
      i: Ic.archive,
      k: 'database'
    }, {
      l: 'Labels',
      i: Ic.flag,
      k: 'labels'
    }, {
      l: 'Data export',
      i: Ic.upload,
      k: 'dataexport'
    }]
  }, {
    h: 'Intelligence',
    items: [{
      l: 'AI assistant',
      i: Ic.spark,
      k: 'ai'
    }, {
      l: 'Inbox triage',
      i: Ic.inbox,
      k: 'inbox'
    }, {
      l: 'Vera autopilot',
      i: Ic.bot,
      k: 'vera'
    }, {
      l: 'CEO persona',
      i: Ic.briefcase,
      k: 'personas'
    }, {
      l: 'Performance',
      i: Ic.trend,
      k: 'performance'
    }, {
      l: 'AI engine',
      i: Ic.bot,
      k: 'aiengine'
    }, {
      l: 'Improvement',
      i: Ic.trend,
      k: 'improve'
    }, {
      l: 'Carbon',
      i: Ic.leaf || Ic.trend,
      k: 'carbon'
    }, {
      l: 'Waste',
      i: Ic.box,
      k: 'waste'
    }]
  }, {
    h: 'Settings',
    items: [{
      l: 'Account',
      i: Ic.team,
      k: 'account'
    }, {
      l: 'Workspaces',
      i: Ic.briefcase,
      k: 'workspace'
    }, {
      l: 'Settings',
      i: Ic.cog,
      k: 'settings'
    }, {
      l: 'Notifications',
      i: Ic.bell || Ic.inbox,
      k: 'notifprefs'
    }, {
      l: 'Reminders',
      i: Ic.clock,
      k: 'reminders'
    }, {
      l: 'Language',
      i: Ic.globe || Ic.book,
      k: 'language'
    }, {
      l: 'Security (E2EE)',
      i: Ic.shield,
      k: 'e2ee'
    }, {
      l: 'Cloud sync',
      i: Ic.cloud,
      k: 'cloudsync'
    }, {
      l: 'Diagnostics',
      i: Ic.activity || Ic.shield,
      k: 'diagnostics'
    }, {
      l: 'Admin',
      i: Ic.team,
      k: 'admin'
    }, {
      l: 'Help',
      i: Ic.book,
      k: 'help'
    }]
  }];

  // Search filter across all items.
  const ql = q.trim().toLowerCase();
  const filtered = SECTIONS.map(s => ({
    h: s.h,
    items: s.items.filter(it => !ql || it.l.toLowerCase().includes(ql))
  })).filter(s => s.items.length);
  const ICON = i => i ? React.cloneElement(i, {
    size: 18
  }) : null;
  return React.createElement(React.Fragment, null,
  // ── Hamburger button: top-left, below the status bar. z above content,
  //    below sheets so it never fights a sheet's Back button. ──
  React.createElement('button', {
    'aria-label': 'Open menu',
    onClick: () => setOpen(true),
    style: {
      position: 'absolute',
      top: 49,
      left: 12,
      zIndex: 9,
      width: 38,
      height: 38,
      borderRadius: 12,
      background: 'rgba(10,18,30,0.6)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `0.5px solid ${T.hair}`,
      color: T.t1,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 3.5
    }
  }, React.createElement('span', {
    style: {
      width: 16,
      height: 2,
      borderRadius: 2,
      background: T.t1
    }
  }), React.createElement('span', {
    style: {
      width: 16,
      height: 2,
      borderRadius: 2,
      background: T.t1
    }
  }), React.createElement('span', {
    style: {
      width: 16,
      height: 2,
      borderRadius: 2,
      background: T.t1
    }
  })),
  // ── Drawer overlay (above everything, incl. sheets) ──
  open && React.createElement('div', {
    onClick: () => setOpen(false),
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 300,
      background: 'rgba(0,0,0,0.5)',
      animation: 'cxMenuFade .2s'
    }
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: 290,
      maxWidth: '85%',
      background: T.bg1,
      borderRight: `0.5px solid ${T.hairMid}`,
      display: 'flex',
      flexDirection: 'column',
      animation: 'cxMenuSlide .26s cubic-bezier(0.2,0.8,0.2,1)',
      boxShadow: '8px 0 40px rgba(0,0,0,0.5)'
    }
  },
  // Header
  React.createElement('div', {
    style: {
      padding: '46px 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, React.createElement('div', {
    style: {
      width: 34,
      height: 34,
      borderRadius: 9,
      background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff'
    }
  }, React.cloneElement(Ic.spark, {
    size: 18
  })), React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 750,
      color: T.t1,
      letterSpacing: -0.3
    }
  }, 'Cortexx'), React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, 'cortexbuildpro.com')), React.createElement('button', {
    'aria-label': 'Close',
    onClick: () => setOpen(false),
    style: {
      width: 30,
      height: 30,
      borderRadius: 15,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      color: T.t2,
      cursor: 'pointer',
      fontSize: 16,
      lineHeight: 1
    }
  }, '✕')),
  // Search
  React.createElement('div', {
    style: {
      padding: '4px 16px 10px'
    }
  }, React.createElement('input', {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: 'Search menu…',
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '9px 12px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 13.5,
      outline: 'none'
    }
  })),
  // Scrollable list
  React.createElement('div', {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 10px 24px'
    }
  }, filtered.length === 0 ? React.createElement('div', {
    style: {
      padding: 24,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, 'No matches') : filtered.map(s => React.createElement('div', {
    key: s.h,
    style: {
      marginBottom: 6
    }
  }, React.createElement('div', {
    style: {
      fontFamily: SF,
      fontSize: 10.5,
      fontWeight: 700,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      padding: '12px 10px 5px'
    }
  }, s.h), s.items.map(it => React.createElement('button', {
    key: it.l,
    onClick: () => go(it.k, it.p),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 10px',
      borderRadius: 9,
      background: 'transparent',
      border: 'none',
      color: T.t1,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 550
    },
    onMouseEnter: e => {
      e.currentTarget.style.background = T.bg2;
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = 'transparent';
    }
  }, React.createElement('span', {
    style: {
      color: accent,
      display: 'flex',
      width: 20,
      justifyContent: 'center'
    }
  }, ICON(it.i)), React.createElement('span', {
    style: {
      flex: 1
    }
  }, it.l))))))), React.createElement('style', null, '@keyframes cxMenuFade{from{opacity:0}to{opacity:1}}@keyframes cxMenuSlide{from{transform:translateX(-100%)}to{transform:translateX(0)}}')));
}
Object.assign(window, {
  GlobalSideMenu
});