function SubPortalScreen({
  accent
}) {
  const subs = useDB('subs');
  const subInv = useDB('subInvoices');
  const projects = useDB('projects');
  const tasks = useDB('tasks');
  const sub = subs.find(s => s.name === 'Spark Electricals') || subs[0];
  const subInvoices = subInv.filter(iv => iv.sub === sub?.name);
  const subTotal = subInvoices.reduce((s, iv) => s + iv.amount, 0);
  const subPending = subInvoices.filter(iv => iv.status === 'pending').reduce((s, iv) => s + iv.amount, 0);
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
      padding: '8px 16px 4px',
      background: `linear-gradient(135deg, ${T.purple}22, ${accent}11)`,
      marginBottom: 8
    }
  }, React.createElement(Pill, {
    c: T.purple,
    solid: true,
    size: "xs"
  }, "SUB PORTAL \xB7 PREVIEW"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      marginTop: 4,
      lineHeight: 1.4
    }
  }, "What ", sub?.name, " sees when they log in.")), React.createElement("div", {
    style: {
      padding: '8px 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 16,
      padding: 16,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 12,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.briefcase, {
    size: 22
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 700,
      color: T.t1
    }
  }, sub?.name), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, sub?.trade, " \xB7 ", sub?.contact), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 4
    }
  }, React.createElement(Pill, {
    c: T.green,
    size: "xs"
  }, "\u2713 Verified"), React.createElement(Pill, {
    c: T.amber,
    size: "xs"
  }, "\u2605 ", sub?.rating)))))), React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 12,
      border: `0.5px solid ${T.hair}`
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
  }, "Awaiting payment"), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      color: T.amber,
      fontWeight: 700,
      marginTop: 4,
      letterSpacing: -0.5
    }
  }, "\xA3", subPending.toLocaleString()), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      marginTop: 1
    }
  }, subInvoices.filter(iv => iv.status === 'pending').length, " invoices")), React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 12,
      border: `0.5px solid ${T.hair}`
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
  }, "Lifetime billed"), React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      color: T.t1,
      fontWeight: 700,
      marginTop: 4,
      letterSpacing: -0.5
    }
  }, "\xA3", subTotal.toLocaleString()), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 10,
      color: T.t3,
      marginTop: 1
    }
  }, sub?.jobsDone, " jobs done"))), React.createElement(Section, {
    title: "Active assignments"
  }, React.createElement(GroupedList, null, projects.filter(p => ['active', 'snagging'].includes(p.status)).slice(0, 2).map((p, i, a) => React.createElement(Row, {
    key: p.id,
    icon: Ic.projects,
    iconBg: STATUS_C[p.status],
    title: p.name,
    sub: `${p.addr} · 1st-fix electrical scope`,
    right: React.createElement(Pill, {
      c: STATUS_C[p.status],
      size: "xs"
    }, p.status),
    isLast: i === a.length - 1,
    onClick: () => toast(`Opening ${p.name}`, 'info')
  })))), React.createElement(Section, {
    title: `Your invoices · ${subInvoices.length}`
  }, React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, subInvoices.length === 0 ? React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "No invoices yet") : subInvoices.map(iv => {
    const c = iv.status === 'paid' ? T.green : iv.status === 'approved' ? T.blue : iv.status === 'rejected' ? T.red : T.amber;
    return React.createElement("div", {
      key: iv.id,
      style: {
        background: T.bg2,
        borderRadius: 12,
        padding: 12,
        border: `0.5px solid ${T.hair}`
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between'
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t3,
        fontWeight: 600
      }
    }, iv.id), React.createElement(Pill, {
      c: c,
      size: "xs"
    }, iv.status)), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 600,
        color: T.t1,
        marginTop: 4
      }
    }, iv.desc)), React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 14,
        color: T.t1,
        fontWeight: 700
      }
    }, "\xA3", iv.amount.toLocaleString()), iv.cisDeduction > 0 && React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 9,
        color: T.purple,
        marginTop: 2
      }
    }, "CIS \u2212\xA3", iv.cisDeduction))));
  }), React.createElement("button", {
    onClick: () => toast('Invoice draft started', 'success'),
    style: {
      background: 'transparent',
      color: accent,
      border: `0.5px dashed ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      marginTop: 4
    }
  }, React.cloneElement(Ic.plus, {
    size: 14
  }), " Submit new invoice"))), React.createElement(Section, {
    title: "Compliance"
  }, React.createElement(GroupedList, null, React.createElement(Row, {
    icon: Ic.shield,
    iconBg: T.green,
    title: "Public liability insurance",
    sub: "Valid until 2026-12-31",
    right: React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "\u2713")
  }), React.createElement(Row, {
    icon: Ic.hardhat,
    iconBg: T.blue,
    title: "CSCS Gold (Vik Patel)",
    sub: "Verified by main contractor",
    right: React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "\u2713")
  }), React.createElement(Row, {
    icon: Ic.doc,
    iconBg: T.amber,
    title: "Method statements",
    sub: "2 on file",
    right: React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "\u2713"),
    isLast: true
  }))), React.createElement("div", {
    style: {
      padding: '20px 20px 0',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, "Powered by ", React.createElement("span", {
    style: {
      color: T.purple,
      fontWeight: 700
    }
  }, "Cortexx"))));
}
Object.assign(window, {
  SubPortalScreen
});