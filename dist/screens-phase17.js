(function () {
  if (!window.Backend) return;
  Backend.computed.certExpiring = () => {
    const team = Backend.db.snapshot().team || [];
    return team.reduce((s, m) => s + (m.certificates || []).filter(c => c.status === 'expiring').length, 0);
  };
  Backend.computed.certExpired = () => {
    const team = Backend.db.snapshot().team || [];
    return team.reduce((s, m) => s + (m.certificates || []).filter(c => c.status === 'expired').length, 0);
  };
})();
function TrainingMatrixScreen({
  accent
}) {
  const team = useDB('team');
  const expiring = useComputed('certExpiring');
  const expired = useComputed('certExpired');
  const COMPS = [{
    k: 'CSCS Gold',
    short: 'CSCS-G'
  }, {
    k: 'CSCS Blue',
    short: 'CSCS-B'
  }, {
    k: 'CSCS Green',
    short: 'CSCS-Gr'
  }, {
    k: 'SMSTS',
    short: 'SMSTS'
  }, {
    k: 'First Aid at Work',
    short: 'FAaW'
  }, {
    k: 'Asbestos Awareness',
    short: 'Asb'
  }, {
    k: '18th Edition',
    short: '18ed'
  }, {
    k: 'PASMA',
    short: 'PASMA'
  }, {
    k: 'IPAF',
    short: 'IPAF'
  }, {
    k: 'Working at Heights',
    short: 'WaH'
  }];
  const hasComp = (member, comp) => {
    const c = (member.certificates || []).find(c => c.name.includes(comp) || c.name === comp);
    return c;
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
    title: "Training matrix",
    subtitle: `${team.length} members · ${expiring} expiring · ${expired} expired`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.download,
      onClick: () => window.print()
    })
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8
    }
  }, [{
    l: 'Valid',
    v: team.reduce((s, m) => s + (m.certificates || []).filter(c => c.status === 'valid').length, 0),
    c: T.green
  }, {
    l: 'Expiring',
    v: expiring,
    c: T.amber
  }, {
    l: 'Expired',
    v: expired,
    c: T.red
  }].map((k, i) => React.createElement("div", {
    key: i,
    style: {
      background: T.bg2,
      borderRadius: 10,
      padding: '8px 10px',
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, k.l), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      color: k.c,
      fontWeight: 700,
      marginTop: 2,
      letterSpacing: -0.5
    }
  }, k.v)))), React.createElement("div", {
    style: {
      padding: '4px 8px 14px',
      overflowX: 'auto'
    }
  }, React.createElement("div", {
    style: {
      minWidth: COMPS.length * 50 + 130
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 2,
      padding: '0 8px 6px',
      position: 'sticky',
      top: 0,
      background: T.bg0,
      zIndex: 1
    }
  }, React.createElement("div", {
    style: {
      width: 122,
      flexShrink: 0,
      fontFamily: SFMono,
      fontSize: 9,
      color: T.t3,
      fontWeight: 700,
      letterSpacing: 0.4
    }
  }, "MEMBER"), COMPS.map(c => React.createElement("div", {
    key: c.k,
    style: {
      width: 48,
      transform: 'rotate(-50deg)',
      transformOrigin: 'bottom left',
      fontFamily: SFMono,
      fontSize: 9,
      color: T.t2,
      fontWeight: 700,
      height: 40,
      display: 'flex',
      alignItems: 'flex-end',
      paddingBottom: 4,
      whiteSpace: 'nowrap'
    }
  }, c.short))), team.map((m, ri) => React.createElement("div", {
    key: m.id,
    onClick: () => window.cortexxNav('member', m),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '0 8px',
      borderTop: `0.5px solid ${T.hair}`,
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      width: 122,
      flexShrink: 0,
      padding: '8px 6px 8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement(Avatar, {
    name: m.n,
    size: 22,
    c: m.color
  }), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t1,
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m.n.split(' ')[0])), COMPS.map(c => {
    const cert = hasComp(m, c.k);
    const col = cert ? cert.status === 'valid' ? T.green : cert.status === 'expiring' ? T.amber : T.red : T.bg3;
    return React.createElement("div", {
      key: c.k,
      style: {
        width: 48,
        height: 32,
        borderRadius: 5,
        background: cert ? col + '33' : T.bg3,
        border: `0.5px solid ${cert ? col : T.hair}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, cert && (cert.status === 'valid' ? React.createElement("span", {
      style: {
        color: T.green,
        fontSize: 14
      }
    }, "\u2713") : cert.status === 'expiring' ? React.createElement("span", {
      style: {
        color: T.amber,
        fontSize: 13,
        fontWeight: 700
      }
    }, "!") : React.createElement("span", {
      style: {
        color: T.red,
        fontSize: 14
      }
    }, "\u2717")));
  }))))), expiring > 0 && React.createElement(Section, {
    title: "Expiring soon"
  }, React.createElement(GroupedList, null, team.flatMap(m => (m.certificates || []).filter(c => c.status === 'expiring').map(c => ({
    m,
    c
  }))).map(({
    m,
    c
  }, i, a) => React.createElement(Row, {
    key: `${m.id}-${c.id}`,
    icon: Ic.alert,
    iconBg: T.amber,
    title: `${m.n} · ${c.name}`,
    sub: `Expires ${c.expires}`,
    right: React.createElement("button", {
      onClick: async e => {
        e.stopPropagation();
        toast('Renewal reminder set', 'success');
      },
      style: {
        background: T.amber,
        color: '#0a1830',
        border: 'none',
        borderRadius: 14,
        padding: '5px 10px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 11,
        fontWeight: 700
      }
    }, "Renew"),
    isLast: i === a.length - 1,
    onClick: () => window.cortexxNav('member', m)
  }))))));
}
Object.assign(window, {
  TrainingMatrixScreen
});