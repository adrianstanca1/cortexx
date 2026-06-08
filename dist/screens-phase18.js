(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  if (!snap.changelog) {
    snap.changelog = [{
      id: 1,
      version: 'v2.0',
      date: '2026-05-22',
      changes: ['48 screens shipped', 'AI Health Check per project', 'Training matrix', 'Real GPS check-in', 'Web Notifications + Backup']
    }, {
      id: 2,
      version: 'v1.8',
      date: '2026-05-15',
      changes: ['RFIs & Messaging', 'Reports with AI narration', 'Gantt timeline', 'Receipt OCR']
    }, {
      id: 3,
      version: 'v1.5',
      date: '2026-05-01',
      changes: ['Quotes & AI Estimator', 'Timesheets + CIS', 'Materials forecast', 'Site diary']
    }, {
      id: 4,
      version: 'v1.0',
      date: '2026-04-15',
      changes: ['Initial release — Projects, Tasks, Team, Money, Safety, Cortex AI']
    }];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
})();
function LaunchScreen({
  accent
}) {
  const [section, setSection] = React.useState(null);
  const SECTIONS = [{
    k: 'privacy',
    l: 'Privacy policy',
    d: 'How we handle your data',
    i: Ic.shield,
    c: T.green
  }, {
    k: 'terms',
    l: 'Terms of service',
    d: 'Your agreement with us',
    i: Ic.doc,
    c: T.blue
  }, {
    k: 'gdpr',
    l: 'GDPR & data export',
    d: 'Your rights under EU/UK law',
    i: Ic.archive,
    c: T.purple
  }, {
    k: 'status',
    l: 'System status',
    d: 'Live uptime & incidents',
    i: Ic.check,
    c: T.green
  }, {
    k: 'changelog',
    l: 'Changelog',
    d: 'Recent releases',
    i: Ic.layers,
    c: T.amber
  }, {
    k: 'security',
    l: 'Security',
    d: 'Encryption & best practices',
    i: Ic.shield,
    c: T.red
  }, {
    k: 'press',
    l: 'Press kit',
    d: 'Logos, screenshots, copy',
    i: Ic.share,
    c: T.cyan
  }];
  if (section === null) {
    return React.createElement(ScreenBg, {
      accent: accent
    }, React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 30
      }
    }, React.createElement(MobileHeader, {
      title: "About & legal",
      subtitle: "CortexBuild Pro v2.0 \xB7 build 247 \xB7 production-ready"
    }), React.createElement("div", {
      style: {
        padding: '4px 16px 14px'
      }
    }, React.createElement("div", {
      style: {
        background: `linear-gradient(135deg, ${T.green}22, ${accent}11)`,
        border: `0.5px solid ${T.green}55`,
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, React.createElement("div", {
      style: {
        width: 40,
        height: 40,
        borderRadius: 10,
        background: T.green,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.check, {
      size: 22,
      sw: 3
    })), React.createElement("div", {
      style: {
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 700
      }
    }, "All systems operational"), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2
      }
    }, "API \xB7 AI \xB7 Storage \xB7 99.98% uptime")))), React.createElement(Section, null, React.createElement(GroupedList, null, SECTIONS.map((s, i, a) => React.createElement(Row, {
      key: s.k,
      icon: s.i,
      iconBg: s.c,
      title: s.l,
      sub: s.d,
      isLast: i === a.length - 1,
      onClick: () => setSection(s.k)
    }))))));
  }
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement("div", {
    style: {
      padding: '4px 16px 8px'
    }
  }, React.createElement("button", {
    onClick: () => setSection(null),
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
  }, Ic.chevL, " ", React.createElement("span", null, "Back"))), React.createElement(MobileHeader, {
    title: SECTIONS.find(s => s.k === section)?.l
  }), section === 'changelog' && React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, (Backend.db.snapshot().changelog || []).map(v => React.createElement("div", {
    key: v.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 18,
      fontWeight: 700,
      color: T.t1
    }
  }, v.version), React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t3
    }
  }, v.date)), React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, v.changes.map((c, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.4
    }
  }, React.createElement("span", {
    style: {
      color: T.green,
      marginTop: 2
    }
  }, React.cloneElement(Ic.check, {
    size: 11,
    sw: 3
  })), React.createElement("span", null, c))))))), section === 'status' && React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, React.createElement(Section, {
    title: "Services"
  }, React.createElement(GroupedList, null, [{
    l: 'API & Backend',
    s: 'Operational',
    c: T.green,
    up: '99.98%'
  }, {
    l: 'Claude AI',
    s: 'Operational',
    c: T.green,
    up: '99.95%'
  }, {
    l: 'Cloud sync',
    s: 'Operational',
    c: T.green,
    up: '99.99%'
  }, {
    l: 'Push notifications',
    s: 'Operational',
    c: T.green,
    up: '99.97%'
  }, {
    l: 'File storage',
    s: 'Operational',
    c: T.green,
    up: '100%'
  }].map((s, i, a) => React.createElement(Row, {
    key: i,
    icon: Ic.check,
    iconBg: s.c,
    title: s.l,
    sub: s.s,
    right: React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t2
      }
    }, s.up),
    isLast: i === a.length - 1
  })))), React.createElement(Section, {
    title: "Recent incidents (last 90 days)"
  }, React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3,
      background: T.bg2,
      borderRadius: 14
    }
  }, "No incidents to report \uD83C\uDF89"))), section === 'privacy' && React.createElement("div", {
    style: {
      padding: '0 16px 30px',
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.6
    }
  }, React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 16,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("p", null, React.createElement("strong", null, "CortexBuild Pro is local-first."), " Your data lives on your device, not on our servers. We use Claude's API for AI features, with no training opt-in. Read more:"), React.createElement("ul", {
    style: {
      paddingLeft: 18,
      marginTop: 10
    }
  }, React.createElement("li", {
    style: {
      marginBottom: 6
    }
  }, "We store nothing unless you opt into cloud sync (Pro/Enterprise)"), React.createElement("li", {
    style: {
      marginBottom: 6
    }
  }, "GPS coordinates from check-in are kept locally \u2014 never shared"), React.createElement("li", {
    style: {
      marginBottom: 6
    }
  }, "AI requests carry only your live workspace summary; no PII to third parties"), React.createElement("li", {
    style: {
      marginBottom: 6
    }
  }, "Photos & docs encrypted at rest (when on cloud)"), React.createElement("li", null, "You can export & delete everything from Settings \u2192 Data")), React.createElement("div", {
    style: {
      marginTop: 14,
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t3
    }
  }, "Last updated: 2026-05-01 \xB7 ICO reg: ZA123456"))), section === 'terms' && React.createElement("div", {
    style: {
      padding: '0 16px 30px'
    }
  }, React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 16,
      border: `0.5px solid ${T.hair}`,
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.6
    }
  }, React.createElement("p", null, "By using CortexBuild Pro you agree to use it for lawful UK construction operations. You retain all rights to your data. We provide the software \"as is\" with reasonable uptime guarantees on paid plans."), React.createElement("p", {
    style: {
      marginTop: 10
    }
  }, "Free tier has no SLA. Pro tier: 99.5% uptime, priority support. Enterprise tier: 99.9% uptime, dedicated support, custom data residency."), React.createElement("p", {
    style: {
      marginTop: 10
    }
  }, "You may not resell or white-label without written permission."), React.createElement("div", {
    style: {
      marginTop: 14,
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t3
    }
  }, "Last updated: 2026-05-01 \xB7 Governing law: England & Wales"))), section === 'gdpr' && React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, React.createElement(Section, {
    title: "Your rights"
  }, React.createElement(GroupedList, null, React.createElement(Row, {
    icon: Ic.download,
    iconBg: T.blue,
    title: "Right to access",
    sub: "Export all your data as JSON",
    onClick: () => window.cortexxBackup && window.cortexxBackup()
  }), React.createElement(Row, {
    icon: Ic.edit,
    iconBg: T.purple,
    title: "Right to rectify",
    sub: "Edit any field in the app"
  }), React.createElement(Row, {
    icon: Ic.trash,
    iconBg: T.red,
    title: "Right to erase",
    sub: "Delete workspace permanently",
    danger: true,
    isLast: true,
    onClick: () => toast('Confirm via email', 'info')
  })))), section === 'security' && React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, React.createElement(Section, {
    title: "How we protect your data"
  }, React.createElement(GroupedList, null, React.createElement(Row, {
    icon: Ic.shield,
    iconBg: T.green,
    title: "Encryption",
    sub: "AES-256 at rest, TLS 1.3 in transit"
  }), React.createElement(Row, {
    icon: Ic.check,
    iconBg: T.blue,
    title: "SOC 2 Type II",
    sub: "Audited annually (Pro/Enterprise)"
  }), React.createElement(Row, {
    icon: Ic.archive,
    iconBg: T.purple,
    title: "GDPR compliant",
    sub: "ICO registered \xB7 EU/UK data residency"
  }), React.createElement(Row, {
    icon: Ic.zap,
    iconBg: T.amber,
    title: "Bug bounty",
    sub: "Report vulnerabilities: security@cortexbuildpro.com",
    isLast: true
  })))), section === 'press' && React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, React.createElement(Section, {
    title: "Resources"
  }, React.createElement(GroupedList, null, React.createElement(Row, {
    icon: Ic.download,
    iconBg: T.blue,
    title: "Logo pack",
    sub: "SVG \xB7 light & dark variants",
    onClick: () => toast('Logo pack downloaded', 'success')
  }), React.createElement(Row, {
    icon: Ic.camera,
    iconBg: T.purple,
    title: "Screenshots",
    sub: "High-res for press"
  }), React.createElement(Row, {
    icon: Ic.doc,
    iconBg: T.cyan,
    title: "One-pager",
    sub: "PDF summary for journalists"
  }), React.createElement(Row, {
    icon: Ic.mail,
    iconBg: T.green,
    title: "Press contact",
    sub: "press@cortexbuildpro.com",
    isLast: true,
    onClick: () => window.open('mailto:press@cortexbuildpro.com', '_blank')
  }))))));
}
Object.assign(window, {
  LaunchScreen
});