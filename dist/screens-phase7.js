(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  if (!snap.subInvoices) {
    snap.subInvoices = [{
      id: 'SI-501',
      subId: 1,
      sub: 'Northside Roofing Ltd',
      projectId: 3,
      amount: 4200,
      status: 'pending',
      received: '2026-05-22',
      desc: 'Re-roof scope · materials & labour',
      cisDeduction: 0
    }, {
      id: 'SI-502',
      subId: 2,
      sub: 'CL Plumbing & Heating',
      projectId: 2,
      amount: 1850,
      status: 'pending',
      received: '2026-05-21',
      desc: 'Loft 1st-fix plumbing',
      cisDeduction: 370
    }, {
      id: 'SI-503',
      subId: 3,
      sub: 'Spark Electricals',
      projectId: 1,
      amount: 2400,
      status: 'approved',
      received: '2026-05-18',
      approved: '2026-05-19',
      desc: 'Camden 1st-fix electrical',
      cisDeduction: 480
    }, {
      id: 'SI-504',
      subId: 5,
      sub: 'Glass & Glazing Co',
      projectId: 1,
      amount: 980,
      status: 'paid',
      received: '2026-05-10',
      approved: '2026-05-11',
      paid: '2026-05-15',
      desc: 'Camden 2 x window units',
      cisDeduction: 0
    }, {
      id: 'SI-505',
      subId: 1,
      sub: 'Northside Roofing Ltd',
      projectId: 1,
      amount: 320,
      status: 'pending',
      received: '2026-05-22',
      desc: 'Lead flashing rectification',
      cisDeduction: 64
    }];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
  const mk = n => ({
    listSync: () => [...Backend.db.snapshot()[n]],
    list: async () => [...Backend.db.snapshot()[n]],
    getSync: id => Backend.db.snapshot()[n].find(x => x.id == id),
    get: async id => Backend.db.snapshot()[n].find(x => x.id == id),
    create: async () => {},
    update: async (id, p) => {
      const s = Backend.db.snapshot();
      s[n] = s[n].map(x => x.id == id ? {
        ...x,
        ...p
      } : x);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    },
    remove: async () => {}
  });
  Backend.db.subInvoices = mk('subInvoices');
  Backend.computed.pendingSubInvoices = () => (Backend.db.snapshot().subInvoices || []).filter(s => s.status === 'pending').length;
})();
const SI_STATUS_C = {
  pending: T.amber,
  approved: T.blue,
  paid: T.green,
  rejected: T.red
};
function SubInvoicesScreen({
  accent
}) {
  const invs = useDB('subInvoices');
  const projects = useDB('projects');
  const [seg, setSeg] = React.useState('pending');
  const filtered = seg === 'all' ? invs : invs.filter(i => i.status === seg);
  const pendingTotal = invs.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const approve = async id => {
    await Backend.db.subInvoices.update(id, {
      status: 'approved',
      approved: '2026-05-22'
    });
    toast('Invoice approved', 'success');
  };
  const reject = async id => {
    await Backend.db.subInvoices.update(id, {
      status: 'rejected'
    });
    toast('Invoice rejected', 'error');
  };
  const pay = async id => {
    await Backend.db.subInvoices.update(id, {
      status: 'paid',
      paid: '2026-05-22'
    });
    toast('Marked as paid', 'success');
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
    title: "Sub invoices",
    subtitle: `£${pendingTotal.toLocaleString()} pending · ${invs.filter(i => i.status === 'pending').length} awaiting approval`
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement(SegControl, {
    value: seg,
    onChange: setSeg,
    options: [{
      k: 'pending',
      l: 'Pending',
      n: invs.filter(i => i.status === 'pending').length
    }, {
      k: 'approved',
      l: 'Approved',
      n: invs.filter(i => i.status === 'approved').length
    }, {
      k: 'paid',
      l: 'Paid',
      n: invs.filter(i => i.status === 'paid').length
    }, {
      k: 'all',
      l: 'All',
      n: invs.length
    }]
  })), React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, filtered.map(iv => {
    const proj = projects.find(p => p.id === iv.projectId);
    const net = iv.amount - (iv.cisDeduction || 0);
    return React.createElement("div", {
      key: iv.id,
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
        alignItems: 'flex-start'
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
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
      c: SI_STATUS_C[iv.status]
    }, iv.status)), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        color: T.t1,
        marginTop: 4
      }
    }, iv.sub), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2,
        marginTop: 2,
        lineHeight: 1.4
      }
    }, iv.desc), React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.t3,
        marginTop: 4
      }
    }, proj?.name?.split(' ').slice(0, 2).join(' '), " \xB7 received ", _formatRelDate(iv.received))), React.createElement("div", {
      style: {
        textAlign: 'right',
        flexShrink: 0,
        marginLeft: 8
      }
    }, React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 18,
        color: T.t1,
        fontWeight: 700
      }
    }, "\xA3", iv.amount.toLocaleString()), iv.cisDeduction > 0 && React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.purple,
        fontWeight: 600,
        marginTop: 2
      }
    }, "CIS \u2212\xA3", iv.cisDeduction), iv.cisDeduction > 0 && React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.green,
        fontWeight: 700,
        marginTop: 1
      }
    }, "Net \xA3", net.toLocaleString()))), iv.status === 'pending' && React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 12,
        paddingTop: 10,
        borderTop: `0.5px solid ${T.hair}`
      }
    }, React.createElement("button", {
      onClick: () => approve(iv.id),
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
      onClick: () => reject(iv.id),
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
    }, "Reject"), React.createElement("button", {
      onClick: () => toast(`Opening ${iv.id}…`, 'info'),
      style: {
        background: 'transparent',
        color: T.blueL,
        border: `0.5px solid ${T.hairMid}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, "View")), iv.status === 'approved' && React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 12,
        paddingTop: 10,
        borderTop: `0.5px solid ${T.hair}`
      }
    }, React.createElement("button", {
      onClick: () => pay(iv.id),
      style: {
        flex: 1,
        background: accent,
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '8px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, "Mark as paid")));
  }))));
}
Object.assign(window, {
  SubInvoicesScreen
});