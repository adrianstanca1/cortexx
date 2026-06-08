(function () {
  if (window.CortexAudit) return;
  const KEY = () => 'cortexx_audit__' + (window.CortexTenant ? window.CortexTenant.active() : 'default');
  function load() {
    try {
      const r = localStorage.getItem(KEY());
      if (r) return JSON.parse(r);
    } catch (e) {}
    return seed();
  }
  function seed() {
    const base = [{
      id: 1,
      who: 'Adrian Stanca',
      action: 'approved variation CO-002',
      area: 'Variations',
      when: '2026-06-04T08:12'
    }, {
      id: 2,
      who: 'Tom Reilly',
      action: 'checked in at Camden Mews',
      area: 'Clock',
      when: '2026-06-04T07:31'
    }, {
      id: 3,
      who: 'Marcus Pound',
      action: 'submitted May payroll',
      area: 'Payroll',
      when: '2026-06-03T17:40'
    }, {
      id: 4,
      who: 'Vera (AI)',
      action: 'drafted chase for INV-2039',
      area: 'Money',
      when: '2026-06-03T06:02'
    }, {
      id: 5,
      who: 'Aisha Begum',
      action: 'uploaded 4 site photos',
      area: 'Photos',
      when: '2026-06-02T15:20'
    }];
    try {
      localStorage.setItem(KEY(), JSON.stringify(base));
    } catch (e) {}
    return base;
  }
  window.CortexAudit = {
    list() {
      return load();
    },
    log(who, action, area) {
      const l = load();
      l.unshift({
        id: Date.now(),
        who,
        action,
        area,
        when: new Date().toISOString().slice(0, 16)
      });
      try {
        localStorage.setItem(KEY(), JSON.stringify(l.slice(0, 200)));
      } catch (e) {}
    }
  };
})();
function AuditScreen({
  accent
}) {
  const [entries, setEntries] = React.useState(window.CortexAudit.list());
  const [filter, setFilter] = React.useState('all');
  const areas = ['all', ...Array.from(new Set(entries.map(e => e.area)))];
  const shown = filter === 'all' ? entries : entries.filter(e => e.area === filter);
  const areaC = {
    Variations: T.purple,
    Clock: T.green,
    Payroll: T.amber,
    Money: T.green,
    Photos: T.cyan
  };
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Audit log",
    subtitle: `${entries.length} events · append-only`
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 12px',
      display: 'flex',
      gap: 6,
      overflowX: 'auto'
    }
  }, areas.map(a => React.createElement("button", {
    key: a,
    onClick: () => setFilter(a),
    style: {
      background: filter === a ? accent : T.bg2,
      color: filter === a ? '#fff' : T.t2,
      border: `0.5px solid ${filter === a ? accent : T.hairMid}`,
      borderRadius: 14,
      padding: '6px 12px',
      cursor: 'pointer',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, a))), React.createElement("div", {
    style: {
      padding: '0 16px',
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      left: 31,
      top: 8,
      bottom: 8,
      width: 1.5,
      background: T.hair
    }
  }), shown.map(e => React.createElement("div", {
    key: e.id,
    style: {
      display: 'flex',
      gap: 12,
      paddingBottom: 14,
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 16,
      background: T.bg0,
      border: `2px solid ${areaC[e.area] || accent}`,
      color: areaC[e.area] || accent,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      zIndex: 1
    }
  }, React.cloneElement(e.who.includes('AI') ? Ic.spark : Ic.check, {
    size: 14
  })), React.createElement("div", {
    style: {
      flex: 1,
      paddingTop: 3
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.4
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, e.who), " ", React.createElement("span", {
    style: {
      color: T.t2
    }
  }, e.action)), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 2
    }
  }, React.createElement("span", {
    style: {
      color: areaC[e.area] || accent
    }
  }, e.area), " \xB7 ", new Date(e.when).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }))))))));
}
function SSOLoginScreen({
  accent,
  onClose
}) {
  const [stage, setStage] = React.useState('providers');
  const [email, setEmail] = React.useState('');
  const tenants = window.CortexTenant ? window.CortexTenant.list() : [];
  const [tenant, setTenant] = React.useState(tenants[0]?.id);
  const providers = [{
    k: 'google',
    l: 'Continue with Google',
    c: '#4285f4',
    i: 'G'
  }, {
    k: 'microsoft',
    l: 'Continue with Microsoft',
    c: '#00a4ef',
    i: 'M'
  }, {
    k: 'apple',
    l: 'Continue with Apple',
    c: '#fff',
    i: ''
  }];
  return React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 24px',
      justifyContent: 'center'
    }
  }, React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 32
    }
  }, React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 16,
      margin: '0 auto 16px',
      background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.spark, {
    size: 32,
    color: '#fff'
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 24,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.5
    }
  }, "Sign in to Cortexx"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginTop: 6
    }
  }, "Construction OS \xB7 UK SMB")), stage === 'providers' && React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, providers.map(p => React.createElement("button", {
    key: p.k,
    onClick: () => setStage('workspace'),
    style: {
      background: p.k === 'apple' ? '#fff' : T.bg2,
      color: p.k === 'apple' ? '#000' : T.t1,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '13px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 4,
      background: p.k === 'apple' ? '#000' : p.c,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 800
    }
  }, p.k === 'apple' ? '' : p.i), p.l)), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '8px 0'
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: T.hair
    }
  }), React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, "or email"), React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: T.hair
    }
  })), React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "you@company.co.uk",
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '13px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      outline: 'none'
    }
  }), React.createElement("button", {
    onClick: () => setStage('workspace'),
    disabled: !email.trim(),
    style: {
      background: email.trim() ? accent : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '13px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: email.trim() ? 'pointer' : 'default',
      opacity: email.trim() ? 1 : 0.5
    }
  }, "Continue")), stage === 'workspace' && React.createElement("div", null, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      textAlign: 'center',
      marginBottom: 14
    }
  }, "Choose your workspace"), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, tenants.map(t => React.createElement("button", {
    key: t.id,
    onClick: () => setTenant(t.id),
    style: {
      background: tenant === t.id ? `${accent}11` : T.bg2,
      border: `0.5px solid ${tenant === t.id ? accent : T.hair}`,
      borderRadius: 12,
      padding: 12,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      textAlign: 'left'
    }
  }, React.createElement(Avatar, {
    name: t.name,
    size: 36,
    c: t.color
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, t.name), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, t.role, " \xB7 ", t.plan)), tenant === t.id && React.createElement("span", {
    style: {
      color: accent
    }
  }, React.cloneElement(Ic.check, {
    size: 18,
    sw: 3
  }))))), React.createElement("button", {
    onClick: () => {
      if (window.CortexTenant && tenant !== window.CortexTenant.active()) {
        window.CortexTenant.switch(tenant);
        return;
      }
      if (window.cortexxToast) window.cortexxToast('Signed in', 'success');
      onClose();
    },
    style: {
      width: '100%',
      marginTop: 16,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Enter workspace"), React.createElement("button", {
    onClick: () => setStage('providers'),
    style: {
      width: '100%',
      marginTop: 6,
      background: 'none',
      border: 'none',
      color: T.t3,
      fontFamily: SF,
      fontSize: 12,
      cursor: 'pointer',
      padding: 8
    }
  }, "Back")), React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 24,
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      lineHeight: 1.5
    }
  }, "SSO ready \xB7 SAML / OIDC for Enterprise.", React.createElement("br", null), "By continuing you agree to the Terms & Privacy Policy.")));
}
Object.assign(window, {
  AuditScreen,
  SSOLoginScreen
});