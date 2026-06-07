function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Cortexx — Notification prefs · workspace switcher · checkout (Phase 88)

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES — per-member, per-tenant
// ═══════════════════════════════════════════════════════════════════
(function () {
  if (window.CortexNotifPrefs) return;
  const KEY = () => 'cortexx_notif__' + (window.CortexTenant ? window.CortexTenant.active() : 'default');
  const DEFAULTS = {
    tasks: {
      push: true,
      email: true
    },
    money: {
      push: true,
      email: true
    },
    approvals: {
      push: true,
      email: false
    },
    safety: {
      push: true,
      email: true
    },
    vera: {
      push: false,
      email: true
    },
    mentions: {
      push: true,
      email: true
    },
    quiet: {
      on: true,
      from: '20:00',
      to: '07:00'
    }
  };
  function load() {
    try {
      const r = localStorage.getItem(KEY());
      if (r) return {
        ...DEFAULTS,
        ...JSON.parse(r)
      };
    } catch (e) {}
    return {
      ...DEFAULTS
    };
  }
  window.CortexNotifPrefs = {
    get() {
      return load();
    },
    set(p) {
      try {
        localStorage.setItem(KEY(), JSON.stringify(p));
      } catch (e) {}
    }
  };
})();
function NotificationPrefsScreen({
  accent
}) {
  const [p, setP] = React.useState(window.CortexNotifPrefs.get());
  const save = np => {
    setP(np);
    window.CortexNotifPrefs.set(np);
  };
  const toggle = (cat, ch) => save({
    ...p,
    [cat]: {
      ...p[cat],
      [ch]: !p[cat][ch]
    }
  });
  const cats = [{
    k: 'tasks',
    l: 'Tasks & deadlines',
    i: Ic.tasks,
    c: T.green
  }, {
    k: 'money',
    l: 'Invoices & payments',
    i: Ic.money,
    c: T.green
  }, {
    k: 'approvals',
    l: 'Approvals & variations',
    i: Ic.check,
    c: T.purple
  }, {
    k: 'safety',
    l: 'Safety & incidents',
    i: Ic.safety,
    c: T.red
  }, {
    k: 'vera',
    l: 'Vera CEO digests',
    i: Ic.spark,
    c: accent
  }, {
    k: 'mentions',
    l: '@mentions & messages',
    i: Ic.bell,
    c: T.blue
  }];
  const Switch = ({
    on,
    onClick
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: 44,
      height: 26,
      borderRadius: 13,
      border: 'none',
      cursor: 'pointer',
      flexShrink: 0,
      background: on ? accent : T.bg3,
      position: 'relative',
      transition: 'background 0.2s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: on ? 21 : 3,
      width: 20,
      height: 20,
      borderRadius: 10,
      background: '#fff',
      transition: 'left 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
    }
  }));
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Notifications",
    subtitle: "Per channel \xB7 saved to this workspace"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px 8px',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      width: 44,
      textAlign: 'center'
    }
  }, "Push"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 700,
      color: T.t3,
      width: 44,
      textAlign: 'center'
    }
  }, "Email")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, cats.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: i === cats.length - 1 ? 'none' : `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `${c.c}1a`,
      color: c.c,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.cloneElement(c.i, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, c.l), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    on: p[c.k].push,
    onClick: () => toggle(c.k, 'push')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    on: p[c.k].email,
    onClick: () => toggle(c.k, 'email')
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      background: T.bg2,
      borderRadius: 14,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, "Quiet hours"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 2
    }
  }, "Mute push between set times")), /*#__PURE__*/React.createElement(Switch, {
    on: p.quiet.on,
    onClick: () => save({
      ...p,
      quiet: {
        ...p.quiet,
        on: !p.quiet.on
      }
    })
  })), p.quiet.on && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 12
    }
  }, ['from', 'to'].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4
    }
  }, k), /*#__PURE__*/React.createElement("input", {
    type: "time",
    value: p.quiet[k],
    onChange: e => save({
      ...p,
      quiet: {
        ...p.quiet,
        [k]: e.target.value
      }
    }),
    style: {
      width: '100%',
      background: T.bg3,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 8,
      padding: '8px',
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 13,
      outline: 'none',
      boxSizing: 'border-box'
    }
  }))))))));
}

// ═══════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER — quick sheet to jump between tenants
// ═══════════════════════════════════════════════════════════════════
function WorkspaceSwitcher({
  accent,
  onClose
}) {
  const tenants = window.CortexTenant ? window.CortexTenant.list() : [];
  const activeId = window.CortexTenant ? window.CortexTenant.active() : null;
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 30px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 20,
      fontWeight: 700,
      color: T.t1,
      marginBottom: 4
    }
  }, "Switch workspace"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginBottom: 18
    }
  }, "Each workspace keeps fully isolated data."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, tenants.map(t => {
    const isActive = t.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => {
        if (!isActive && window.CortexTenant) window.CortexTenant.switch(t.id);else onClose();
      },
      style: {
        background: isActive ? `${accent}11` : T.bg2,
        border: `0.5px solid ${isActive ? accent : T.hair}`,
        borderRadius: 12,
        padding: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: t.name,
      size: 40,
      c: t.color
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 15,
        fontWeight: 600,
        color: T.t1
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2
      }
    }, t.role, " \xB7 ", t.plan, " plan")), isActive ? /*#__PURE__*/React.createElement(Pill, {
      c: T.green
    }, "current") : React.cloneElement(Ic.chevR || Ic.chevL, {
      size: 18,
      color: T.t3
    }));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onClose();
      setTimeout(() => window.cortexxNav && window.cortexxNav('newworkspace'), 250);
    },
    style: {
      background: 'none',
      border: `1px dashed ${T.hairMid}`,
      borderRadius: 12,
      padding: 14,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      color: accent,
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600
    }
  }, React.cloneElement(Ic.plus, {
    size: 16
  }), " New workspace"))));
}

// ═══════════════════════════════════════════════════════════════════
// CHECKOUT — plan upgrade with card form (Stripe-style mock)
// ═══════════════════════════════════════════════════════════════════
function CheckoutSheet({
  accent,
  plan,
  price,
  onClose
}) {
  const [card, setCard] = React.useState('');
  const [exp, setExp] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const fmtCard = v => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = v => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  };
  const valid = card.replace(/\s/g, '').length >= 15 && exp.length === 5 && cvc.length >= 3;
  const pay = () => {
    setBusy(true);
    setTimeout(() => {
      if (window.CortexTenant && window.CortexTenant.setPlan) window.CortexTenant.setPlan(plan);
      if (window.CortexAudit) window.CortexAudit.log('You', `upgraded to ${plan} plan`, 'Billing');
      setBusy(false);
      setDone(true);
      setTimeout(() => {
        onClose();
        if (window.CortexTenant) location.reload();
      }, 1400);
    }, 1100);
  };
  if (done) {
    return /*#__PURE__*/React.createElement(Sheet, {
      onClose: onClose
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '50px 24px',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 72,
        height: 72,
        borderRadius: 36,
        background: T.green,
        margin: '0 auto 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.check, {
      size: 38,
      color: '#fff',
      sw: 3
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 22,
        fontWeight: 700,
        color: T.t1
      }
    }, "You're on ", plan), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        color: T.t2,
        marginTop: 6
      }
    }, "Payment confirmed \xB7 receipt emailed")));
  }
  const Inp = props => /*#__PURE__*/React.createElement("input", _extends({}, props, {
    style: {
      background: T.bg3,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '13px',
      color: T.t1,
      fontFamily: SFMono,
      fontSize: 15,
      outline: 'none',
      boxSizing: 'border-box',
      ...props.style
    }
  }));
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 30px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 20,
      fontWeight: 700,
      color: T.t1
    }
  }, "Upgrade to ", plan), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 6,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 30,
      fontWeight: 700,
      color: accent
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2
    }
  }, "/month \xB7 billed monthly \xB7 cancel anytime")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 5
    }
  }, "Card number"), /*#__PURE__*/React.createElement(Inp, {
    value: card,
    onChange: e => setCard(fmtCard(e.target.value)),
    placeholder: "4242 4242 4242 4242",
    inputMode: "numeric",
    style: {
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 5
    }
  }, "Expiry"), /*#__PURE__*/React.createElement(Inp, {
    value: exp,
    onChange: e => setExp(fmtExp(e.target.value)),
    placeholder: "MM/YY",
    inputMode: "numeric",
    style: {
      width: '100%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 5
    }
  }, "CVC"), /*#__PURE__*/React.createElement(Inp, {
    value: cvc,
    onChange: e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4)),
    placeholder: "123",
    inputMode: "numeric",
    style: {
      width: '100%'
    }
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: pay,
    disabled: !valid || busy,
    style: {
      width: '100%',
      marginTop: 18,
      background: valid ? accent : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '15px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: valid ? 'pointer' : 'default',
      opacity: valid ? 1 : 0.5
    }
  }, busy ? 'Processing…' : `Pay ${price} & upgrade`), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 12,
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.shield, {
    size: 13,
    color: T.green
  }), " Secured \xB7 PCI-DSS \xB7 256-bit TLS")));
}
Object.assign(window, {
  NotificationPrefsScreen,
  WorkspaceSwitcher,
  CheckoutSheet
});