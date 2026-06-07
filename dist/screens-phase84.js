(function () {
  const AREA = {
    money: 'money',
    pos: 'money',
    subinvoices: 'money',
    payroll: 'money',
    bank: 'money',
    invoices: 'invoices',
    quotes: 'quotes',
    catalog: 'money',
    currency: 'money',
    timeline: 'projects',
    calendar: 'projects',
    diary: 'diary',
    photos: 'photos',
    photoreview: 'photos',
    drawings: 'docs',
    docs: 'docs',
    snags: 'snags',
    changes: 'projects',
    time: 'clock',
    clock: 'clock',
    livestatus: 'team',
    training: 'team',
    roles: 'team',
    admin: 'team',
    tenant: 'team',
    subportal: 'subportal',
    safety: 'safety',
    permits: 'safety',
    inspections: 'safety',
    audittrail: 'reports',
    reports: 'reports',
    tomorrow: 'reports',
    performance: 'reports',
    goals: 'reports',
    vera: 'reports',
    veraauto: 'reports',
    personas: 'reports',
    myday: 'myday',
    leads: 'projects',
    customers: 'projects',
    portal: 'portal'
  };
  function currentRole() {
    try {
      const members = window.CortexMembers ? window.CortexMembers.list() : [];
      const me = members.find(m => m.status === 'active') || members[0];
      return me ? me.role : 'Director';
    } catch (e) {
      return 'Director';
    }
  }
  window.__cortexxRoleFilter = function (tile) {
    try {
      const role = currentRole();
      if (!window.CortexRBAC) return true;
      if (window.CortexRBAC.can(role, '*')) return true;
      const ALWAYS = ['profile', 'help', 'settings', 'ai', 'workspace', 'tenant', 'infrastructure', 'database', 'upload', 'voice', 'reminders', 'tags', 'views', 'templates', 'templatelib', 'forms', 'api', 'currency'];
      if (ALWAYS.indexOf(tile.k) >= 0) return true;
      const area = AREA[tile.k];
      if (!area) return true;
      return window.CortexRBAC.can(role, area);
    } catch (e) {
      return true;
    }
  };
  window.__cortexxCurrentRole = currentRole;
})();
function BillingScreen({
  accent
}) {
  const tenant = window.CortexTenant ? window.CortexTenant.activeRecord() : {
    name: 'Workspace',
    plan: 'Pro'
  };
  const members = window.CortexMembers ? window.CortexMembers.list() : [];
  let dbBytes = 0;
  try {
    const raw = localStorage.getItem('cortexx_db_v1') || '';
    dbBytes = new Blob([raw]).size;
  } catch (e) {}
  const seats = members.length;
  const plans = [{
    name: 'Free',
    price: '£0',
    seats: '≤10',
    features: ['Core apps', 'AI estimator', '1 workspace'],
    current: tenant.plan === 'Free'
  }, {
    name: 'Pro',
    price: '£29',
    seats: '≤50',
    features: ['Everything in Free', 'Vera CEO + autopilot', 'Multi-workspace', 'Priority AI'],
    current: tenant.plan === 'Pro'
  }, {
    name: 'Enterprise',
    price: 'Custom',
    seats: 'Unlimited',
    features: ['SSO + RBAC', 'Audit trail', 'Dedicated support', 'SLA'],
    current: tenant.plan === 'Enterprise'
  }];
  const usage = [{
    l: 'Team seats',
    v: seats,
    max: tenant.plan === 'Free' ? 10 : 50,
    c: accent
  }, {
    l: 'Data stored',
    v: (dbBytes / 1024).toFixed(0) + ' KB',
    max: null,
    c: T.green
  }, {
    l: 'Workspaces',
    v: window.CortexTenant ? window.CortexTenant.list().length : 1,
    max: tenant.plan === 'Free' ? 1 : 99,
    c: T.purple
  }, {
    l: 'AI calls (mo)',
    v: '∞',
    max: null,
    c: T.cyan
  }];
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Billing & usage",
    subtitle: `${tenant.name} · ${tenant.plan} plan`
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${accent}33, ${T.purple}22)`,
      border: `0.5px solid ${accent}55`,
      borderRadius: 16,
      padding: 16
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Current plan"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 24,
      fontWeight: 700,
      color: T.t1,
      marginTop: 4
    }
  }, tenant.plan)), React.createElement(Pill, {
    c: T.green
  }, "active")))), React.createElement(Section, {
    title: "Usage this month"
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, usage.map((u, i) => React.createElement("div", {
    key: i,
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 12
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, u.l), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 20,
      color: u.c,
      fontWeight: 700,
      marginTop: 4
    }
  }, u.v, u.max ? React.createElement("span", {
    style: {
      fontSize: 12,
      color: T.t3
    }
  }, " / ", u.max) : ''), u.max && typeof u.v === 'number' && React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, React.createElement(Bar, {
    pct: Math.min(100, u.v / u.max * 100),
    c: u.c,
    h: 3
  })))))), React.createElement(Section, {
    title: "Plans"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, plans.map(p => React.createElement("div", {
    key: p.name,
    style: {
      background: p.current ? `${accent}11` : T.bg2,
      border: `0.5px solid ${p.current ? accent + '66' : T.hair}`,
      borderRadius: 14,
      padding: 14
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 700,
      color: T.t1
    }
  }, p.name), React.createElement("div", null, React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 18,
      fontWeight: 700,
      color: accent
    }
  }, p.price), React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, p.price !== 'Custom' ? '/mo' : ''))), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, p.seats, " seats"), React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 8
    }
  }, p.features.map(f => React.createElement("span", {
    key: f,
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t2,
      background: T.bg3,
      padding: '3px 7px',
      borderRadius: 5
    }
  }, f))), !p.current && React.createElement("button", {
    onClick: () => p.name === 'Enterprise' ? toast('Sales will be in touch shortly', 'success') : window.cortexxNav && window.cortexxNav('checkout', {
      plan: p.name,
      price: p.price
    }),
    style: {
      width: '100%',
      marginTop: 10,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      padding: '10px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, p.name === 'Enterprise' ? 'Contact sales' : `Upgrade to ${p.name}`), p.current && React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: SF,
      fontSize: 12,
      color: T.green,
      fontWeight: 600,
      textAlign: 'center'
    }
  }, "\u2713 Your current plan"))))), React.createElement(Section, {
    title: "Billing history"
  }, React.createElement(GroupedList, null, [{
    d: 'May 2026',
    a: tenant.plan === 'Free' ? '£0.00' : '£29.00',
    s: 'paid'
  }, {
    d: 'Apr 2026',
    a: tenant.plan === 'Free' ? '£0.00' : '£29.00',
    s: 'paid'
  }, {
    d: 'Mar 2026',
    a: tenant.plan === 'Free' ? '£0.00' : '£29.00',
    s: 'paid'
  }].map((b, i, arr) => React.createElement(Row, {
    key: i,
    icon: Ic.doc,
    iconBg: T.green,
    title: b.d,
    sub: `CortexBuild Pro ${tenant.plan}`,
    right: React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 12,
        color: T.t1,
        fontWeight: 600
      }
    }, b.a),
    isLast: i === arr.length - 1,
    onClick: () => toast('Receipt downloaded', 'success')
  }))))));
}
Object.assign(window, {
  BillingScreen
});