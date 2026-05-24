const FILE_ICON_C = {
  pdf: T.red,
  dwg: T.cyan,
  xls: T.green,
  doc: T.blue,
  zip: T.amber
};
function DocumentsScreen({
  accent
}) {
  const docs = useDB('documents');
  const projects = useDB('projects');
  const [folder, setFolder] = React.useState(null);
  const folders = [...new Set(docs.map(d => d.folder))];
  const list = folder ? docs.filter(d => d.folder === folder) : docs;
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: folder || "Documents",
    subtitle: folder ? `${list.length} files` : `${docs.length} files in ${folders.length} folders`,
    right: folder ? React.createElement("button", {
      onClick: () => setFolder(null),
      style: {
        background: 'none',
        border: 'none',
        color: accent,
        fontFamily: SF,
        fontSize: 13,
        cursor: 'pointer'
      }
    }, "All") : React.createElement(HeaderBtn, {
      icon: Ic.upload,
      accent: accent,
      onClick: () => window.cortexxNav('upload')
    })
  }), !folder && React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, folders.map(f => {
    const count = docs.filter(d => d.folder === f).length;
    return React.createElement("button", {
      key: f,
      onClick: () => setFolder(f),
      style: {
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 12,
        padding: '14px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${accent}22`,
        color: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.cloneElement(Ic.folder, {
      size: 17
    })), React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 600
      }
    }, f), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2
      }
    }, count, " ", count === 1 ? 'file' : 'files')));
  }))), React.createElement(Section, {
    title: folder ? '' : 'Recent files'
  }, React.createElement(GroupedList, null, list.slice(0, folder ? 50 : 5).map((d, i, a) => {
    const c = FILE_ICON_C[d.type] || T.t3;
    const p = projects.find(p => p.id === d.projectId);
    return React.createElement(Row, {
      key: d.id,
      icon: Ic.doc,
      iconBg: c,
      title: d.name,
      sub: `${(d.size / 1000).toFixed(1)} MB · ${p?.name?.split(' ').slice(0, 2).join(' ')} · ${_formatRelDate(d.uploaded)}`,
      isLast: i === Math.min(list.length - 1, folder ? 49 : 4),
      onClick: () => toast(`Opening ${d.name}…`, 'info')
    });
  })))));
}
function DiaryScreen({
  accent
}) {
  const entries = useDB('diary');
  const projects = useDB('projects');
  const [activeProject, setActiveProject] = React.useState(null);
  const filtered = activeProject ? entries.filter(e => e.projectId === activeProject) : entries;
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Site diary",
    subtitle: `${entries.length} entries · last: ${_formatRelDate(entries[0]?.date)}`,
    right: React.createElement("button", {
      onClick: () => window.cortexxNav('adddiary'),
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: accent,
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.plus, {
      size: 20
    }))
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px',
      display: 'flex',
      gap: 6,
      overflowX: 'auto'
    }
  }, React.createElement("button", {
    onClick: () => setActiveProject(null),
    style: {
      background: !activeProject ? T.bg3 : 'transparent',
      border: `0.5px solid ${T.hairMid}`,
      color: !activeProject ? T.t1 : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      padding: '6px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, "All sites"), projects.filter(p => ['active', 'snagging'].includes(p.status)).map(p => React.createElement("button", {
    key: p.id,
    onClick: () => setActiveProject(p.id),
    style: {
      background: activeProject === p.id ? T.bg3 : 'transparent',
      border: `0.5px solid ${T.hairMid}`,
      color: activeProject === p.id ? T.t1 : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      padding: '6px 12px',
      borderRadius: 12,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, p.name.split(' ').slice(0, 2).join(' ')))), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, filtered.map(e => {
    const proj = projects.find(p => p.id === e.projectId);
    const weatherIcon = e.weather.cond === 'Sunny' ? Ic.sun : e.weather.cond === 'Rain' ? Ic.rain : Ic.cloud;
    return React.createElement("div", {
      key: e.id,
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
        alignItems: 'flex-start',
        marginBottom: 8
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 600,
        color: T.t1
      }
    }, proj?.name), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, _formatRelDate(e.date), " \xB7 ", new Date(e.date).toLocaleDateString('en-GB', {
      weekday: 'long'
    }))), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: SFMono,
        fontSize: 12,
        color: T.t2
      }
    }, React.createElement("span", {
      style: {
        color: e.weather.cond === 'Sunny' ? T.amber : e.weather.cond === 'Rain' ? T.cyan : T.t2
      }
    }, React.cloneElement(weatherIcon, {
      size: 14
    })), e.weather.temp, "\xB0")), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        lineHeight: 1.5
      }
    }, e.summary), e.notes && React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 12,
        color: T.t2,
        lineHeight: 1.5,
        marginTop: 6
      }
    }, e.notes), React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        fontFamily: SF,
        fontSize: 11,
        color: T.t3
      }
    }, React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, React.cloneElement(Ic.team, {
      size: 13
    }), " ", e.present), React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }
    }, React.cloneElement(Ic.camera, {
      size: 13
    }), " ", e.photos), e.issues.length > 0 && React.createElement(Pill, {
      c: T.amber,
      size: "xs"
    }, e.issues.length, " issue", e.issues.length !== 1 && 's'), React.createElement("div", {
      style: {
        flex: 1
      }
    })));
  }))));
}
function SnagsScreen({
  accent
}) {
  const snags = useDB('snags');
  const projects = useDB('projects');
  const [seg, setSeg] = React.useState('open');
  const open = snags.filter(s => s.status === 'open');
  const fixed = snags.filter(s => s.status === 'fixed');
  const list = seg === 'open' ? open : fixed;
  const toggle = (id, current) => Backend.db.snags.update(id, {
    status: current === 'open' ? 'fixed' : 'open'
  });
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Snags",
    subtitle: `${open.length} open · ${fixed.length} fixed`,
    right: React.createElement("button", {
      onClick: () => window.cortexxNav('addsnag'),
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: accent,
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.plus, {
      size: 20
    }))
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement(SegControl, {
    value: seg,
    onChange: setSeg,
    options: [{
      k: 'open',
      l: 'Open',
      n: open.length
    }, {
      k: 'fixed',
      l: 'Fixed',
      n: fixed.length
    }]
  })), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, list.map(s => {
    const proj = projects.find(p => p.id === s.projectId);
    return React.createElement("div", {
      key: s.id,
      onClick: () => toggle(s.id, s.status),
      style: {
        background: T.bg2,
        borderRadius: 12,
        padding: '10px 12px',
        border: `0.5px solid ${T.hair}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: s.status === 'fixed' ? 0.5 : 1
      }
    }, React.createElement("div", {
      style: {
        width: 22,
        height: 22,
        borderRadius: 11,
        border: s.status === 'fixed' ? 'none' : `2px solid ${PRIO_C[s.priority]}`,
        background: s.status === 'fixed' ? T.green : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, s.status === 'fixed' && React.createElement("span", {
      style: {
        color: '#fff'
      }
    }, React.cloneElement(Ic.check, {
      size: 13,
      sw: 3
    }))), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 500,
        lineHeight: 1.3,
        textDecoration: s.status === 'fixed' ? 'line-through' : 'none'
      }
    }, s.title), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, proj?.name?.split(' ').slice(0, 2).join(' '), " \xB7 ", s.area, " \xB7 ", s.assignee, s.photos > 0 && React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        window.cortexxNav('annotate', s);
      },
      style: {
        background: 'none',
        border: 'none',
        color: T.t2,
        fontFamily: SF,
        fontSize: 11,
        cursor: 'pointer',
        padding: 0
      }
    }, " \xB7 \uD83D\uDCF7 ", s.photos))), s.status === 'open' && React.createElement(Pill, {
      c: PRIO_C[s.priority],
      size: "xs"
    }, s.priority));
  }))));
}
const CO_STATUS_C = {
  pending: T.amber,
  approved: T.green,
  rejected: T.red
};
function ChangeOrdersScreen({
  accent
}) {
  const cos = useDB('changeOrders');
  const projects = useDB('projects');
  const totalApproved = cos.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0);
  const approve = id => window.cortexxNav('approval', {
    title: cos.find(c => c.id === id)?.title || 'Variation',
    onApproved: async allOK => {
      if (allOK) {
        await Backend.db.changeOrders.update(id, {
          status: 'approved',
          approvedBy: 'Adrian'
        });
        toast('Variation approved', 'success');
      }
    }
  });
  const reject = id => Backend.db.changeOrders.update(id, {
    status: 'rejected'
  });
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Variations",
    subtitle: `${cos.length} total · £${(totalApproved / 1000).toFixed(1)}k approved`,
    right: React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addchange')
    })
  }), React.createElement("div", {
    style: {
      padding: '4px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, cos.map(c => {
    const proj = projects.find(p => p.id === c.projectId);
    return React.createElement("div", {
      key: c.id,
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
        alignItems: 'flex-start',
        marginBottom: 8
      }
    }, React.createElement("div", null, React.createElement(Pill, {
      c: CO_STATUS_C[c.status]
    }, c.status), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1,
        marginTop: 6
      }
    }, c.title), React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, c.id, " \xB7 ", proj?.name?.split(' ').slice(0, 2).join(' '))), React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 18,
        fontWeight: 700,
        color: T.t1
      }
    }, "+\xA3", c.amount.toLocaleString())), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 12,
        color: T.t2,
        lineHeight: 1.4
      }
    }, c.reason), c.status === 'pending' && React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 12
      }
    }, React.createElement("button", {
      onClick: () => approve(c.id),
      style: {
        flex: 1,
        background: T.green,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '8px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, "Approve"), React.createElement("button", {
      onClick: () => reject(c.id),
      style: {
        background: 'transparent',
        color: T.t2,
        border: `0.5px solid ${T.hairMid}`,
        borderRadius: 8,
        padding: '8px 14px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, "Reject")), c.approvedBy && React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 10,
        color: T.t3,
        marginTop: 8
      }
    }, c.status === 'approved' ? '✓ Approved' : 'Rejected', " by ", c.approvedBy));
  }))));
}
const NOTIF_ICON = {
  alert: Ic.alert,
  money: Ic.money,
  task: Ic.camera,
  ai: Ic.spark,
  team: Ic.team,
  quote: Ic.calc
};
function InboxScreen({
  accent,
  onAction
}) {
  const notifs = useDB('notifications');
  const unread = notifs.filter(n => !n.read);
  const [seg, setSeg] = React.useState('all');
  const list = seg === 'all' ? notifs : seg === 'unread' ? unread : notifs.filter(n => n.read);
  const markRead = id => Backend.db.notifications.update(id, {
    read: true
  });
  const markAllRead = () => unread.forEach(n => Backend.db.notifications.update(n.id, {
    read: true
  }));
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Inbox",
    subtitle: `${unread.length} unread · ${notifs.length} total`,
    right: unread.length > 0 ? React.createElement("button", {
      onClick: markAllRead,
      style: {
        background: 'transparent',
        border: `0.5px solid ${T.hairMid}`,
        color: T.t1,
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        padding: '7px 12px',
        borderRadius: 16,
        cursor: 'pointer'
      }
    }, "Mark read") : React.createElement(HeaderBtn, {
      icon: Ic.cog,
      onClick: () => window.cortexxNav('profile')
    })
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement(SegControl, {
    value: seg,
    onChange: setSeg,
    options: [{
      k: 'all',
      l: 'All',
      n: notifs.length
    }, {
      k: 'unread',
      l: 'Unread',
      n: unread.length
    }, {
      k: 'read',
      l: 'Read',
      n: notifs.length - unread.length
    }]
  })), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, list.map(n => {
    const Icon = NOTIF_ICON[n.kind] || Ic.bell;
    return React.createElement("div", {
      key: n.id,
      onClick: () => {
        markRead(n.id);
        if (onAction) onAction(n.action);
      },
      style: {
        background: n.read ? T.bg2 : `${n.color}11`,
        border: `0.5px solid ${n.read ? T.hair : n.color + '44'}`,
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        position: 'relative'
      }
    }, !n.read && React.createElement("div", {
      style: {
        position: 'absolute',
        top: 14,
        right: 12,
        width: 8,
        height: 8,
        borderRadius: 4,
        background: n.color
      }
    }), React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 9,
        background: `${n.color}22`,
        color: n.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.cloneElement(Icon, {
      size: 17
    })), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        paddingRight: !n.read ? 14 : 0
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 600,
        color: T.t1,
        lineHeight: 1.3
      }
    }, n.t), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, n.sub), React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 9,
        color: T.t3,
        marginTop: 4
      }
    }, new Date(n.when).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }), " \xB7 ", _formatRelDate(n.when.slice(0, 10)))));
  }))));
}
function OnboardingSheet({
  onClose,
  accent
}) {
  const [step, setStep] = React.useState('welcome');
  const [name, setName] = React.useState('');
  const [brief, setBrief] = React.useState('');
  const [seeding, setSeeding] = React.useState(false);
  const finish = async () => {
    if (brief.trim()) {
      setSeeding(true);
      await new Promise(r => setTimeout(r, 1200));
    }
    if (name.trim()) {
      Backend.db.user.update({
        name: name.trim()
      });
    }
    localStorage.setItem('cortexx_onboarded', '1');
    onClose();
  };
  if (step === 'welcome') {
    return React.createElement(Sheet, {
      onClose: onClose,
      fullscreen: true
    }, React.createElement("div", {
      style: {
        flex: 1,
        padding: '40px 28px',
        display: 'flex',
        flexDirection: 'column'
      }
    }, React.createElement("div", {
      style: {
        width: 80,
        height: 80,
        borderRadius: 20,
        background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: `0 10px 30px ${accent}66`
      }
    }, React.cloneElement(Ic.spark, {
      size: 40
    })), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 32,
        fontWeight: 700,
        color: T.t1,
        letterSpacing: -1,
        lineHeight: 1.1,
        marginTop: 24
      }
    }, "Welcome to Cortexx."), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 15,
        color: T.t2,
        lineHeight: 1.5,
        marginTop: 12
      }
    }, "The construction manager that thinks alongside you. Quotes, jobs, money, safety \u2014 all in one place, with a UK-aware AI ops lead built in."), React.createElement("div", {
      style: {
        marginTop: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, [{
      i: Ic.calc,
      l: 'AI estimates',
      s: 'Describe a job, get realistic line items in seconds'
    }, {
      i: Ic.spark,
      l: 'Daily briefing',
      s: 'Cortex tells you what to focus on each morning'
    }, {
      i: Ic.receipt,
      l: 'Auto-categorised',
      s: 'Snap receipts, AI files them to the right job'
    }, {
      i: Ic.shield,
      l: 'CIS & H&S aware',
      s: 'Built for UK SMB contractors from day one'
    }].map((f, i) => React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }
    }, React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 10,
        background: `${accent}22`,
        color: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.cloneElement(f.i, {
      size: 18
    })), React.createElement("div", null, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1
      }
    }, f.l), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 12,
        color: T.t2,
        marginTop: 1
      }
    }, f.s))))), React.createElement("div", {
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      onClick: () => setStep('name'),
      style: {
        background: accent,
        color: '#fff',
        border: 'none',
        borderRadius: 14,
        padding: '14px',
        fontFamily: SF,
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: `0 6px 18px ${accent}55`
      }
    }, "Get started"), React.createElement("button", {
      onClick: onClose,
      style: {
        background: 'none',
        border: 'none',
        color: T.t3,
        fontFamily: SF,
        fontSize: 13,
        padding: '12px',
        cursor: 'pointer',
        marginTop: 4
      }
    }, "Skip \xB7 use demo data")));
  }
  if (step === 'name') {
    return React.createElement(Sheet, {
      onClose: onClose,
      fullscreen: true
    }, React.createElement("div", {
      style: {
        flex: 1,
        padding: '60px 28px',
        display: 'flex',
        flexDirection: 'column'
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: accent,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1.2
      }
    }, "Step 1 of 2"), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 28,
        fontWeight: 600,
        color: T.t1,
        letterSpacing: -0.8,
        marginTop: 8,
        lineHeight: 1.15
      }
    }, "What should we call you?"), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        color: T.t2,
        marginTop: 8,
        lineHeight: 1.5
      }
    }, "Cortex uses your name to personalise briefings."), React.createElement("input", {
      value: name,
      onChange: e => setName(e.target.value),
      placeholder: "Your name",
      autoFocus: true,
      style: {
        marginTop: 24,
        background: T.bg2,
        border: `0.5px solid ${T.hairMid}`,
        borderRadius: 12,
        padding: '14px 16px',
        color: T.t1,
        fontFamily: SF,
        fontSize: 18,
        outline: 'none'
      }
    }), React.createElement("div", {
      style: {
        flex: 1
      }
    }), React.createElement("button", {
      onClick: () => setStep('brief'),
      disabled: !name.trim(),
      style: {
        background: name.trim() ? accent : T.bg3,
        color: '#fff',
        border: 'none',
        borderRadius: 14,
        padding: '14px',
        fontFamily: SF,
        fontSize: 15,
        fontWeight: 700,
        cursor: name.trim() ? 'pointer' : 'default'
      }
    }, "Continue")));
  }
  return React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, React.createElement("div", {
    style: {
      flex: 1,
      padding: '60px 28px',
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: accent,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 1.2
    }
  }, "Step 2 of 2"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 28,
      fontWeight: 600,
      color: T.t1,
      letterSpacing: -0.8,
      marginTop: 8,
      lineHeight: 1.15
    }
  }, "Tell Cortex about your business."), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t2,
      marginTop: 8,
      lineHeight: 1.5
    }
  }, "Even a sentence helps \u2014 we'll seed sensible defaults you can edit."), React.createElement("textarea", {
    value: brief,
    onChange: e => setBrief(e.target.value),
    placeholder: "e.g. SMB refurb contractor in North London, mostly residential, 4 staff + occasional subs.",
    rows: 5,
    style: {
      marginTop: 24,
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '14px 16px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 15,
      outline: 'none',
      resize: 'none',
      lineHeight: 1.4
    }
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    onClick: finish,
    disabled: seeding,
    style: {
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 14,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      opacity: seeding ? 0.5 : 1
    }
  }, seeding ? 'Setting up your workspace…' : 'Finish setup'), React.createElement("button", {
    onClick: finish,
    style: {
      background: 'none',
      border: 'none',
      color: T.t3,
      fontFamily: SF,
      fontSize: 13,
      padding: '12px',
      cursor: 'pointer',
      marginTop: 4
    }
  }, "Skip for now")));
}
Object.assign(window, {
  DocumentsScreen,
  DiaryScreen,
  SnagsScreen,
  ChangeOrdersScreen,
  InboxScreen,
  OnboardingSheet
});