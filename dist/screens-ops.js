// Cortexx — operations screens (Quotes, Timesheets, Calendar, Materials, Subs, Equipment)

// ═══════════════════════════════════════════════════════════════════
// QUOTES
// ═══════════════════════════════════════════════════════════════════
const QUOTE_STATUS_C = {
  draft: T.t3,
  sent: T.blue,
  accepted: T.green,
  rejected: T.red
};
function QuotesScreen({
  accent,
  onAdd,
  onOpen
}) {
  const quotes = useDB('quotes');
  const activeValue = useComputed('activeQuotesValue');
  const [seg, setSeg] = React.useState('all');
  const filtered = seg === 'all' ? quotes : seg === 'open' ? quotes.filter(q => ['draft', 'sent'].includes(q.status)) : quotes.filter(q => q.status === 'accepted');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Quotes",
    subtitle: `${quotes.filter(q => q.status === 'sent').length} sent · £${(activeValue / 1000).toFixed(0)}k pipeline`,
    right: /*#__PURE__*/React.createElement("button", {
      onClick: onAdd,
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
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement(SegControl, {
    value: seg,
    onChange: setSeg,
    options: [{
      k: 'all',
      l: 'All',
      n: quotes.length
    }, {
      k: 'open',
      l: 'Open',
      n: quotes.filter(q => ['draft', 'sent'].includes(q.status)).length
    }, {
      k: 'closed',
      l: 'Closed',
      n: quotes.filter(q => ['accepted', 'rejected'].includes(q.status)).length
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, filtered.map(q => /*#__PURE__*/React.createElement("div", {
    key: q.id,
    onClick: () => onOpen && onOpen(q),
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, q.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 2
    }
  }, q.client, " \xB7 ", q.id)), /*#__PURE__*/React.createElement(Pill, {
    c: QUOTE_STATUS_C[q.status]
  }, q.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 22,
      color: T.t1,
      fontWeight: 700,
      letterSpacing: -0.5
    }
  }, "\xA3", q.total.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, q.status === 'accepted' ? `Won ${_formatRelDate(q.issued)}` : q.status === 'rejected' ? `Lost ${_formatRelDate(q.issued)}` : q.status === 'sent' ? `Sent ${_formatRelDate(q.issued)} · expires ${_formatRelDate(q.validUntil)}` : `Drafted ${_formatRelDate(q.issued)}`)))))));
}
function QuoteDetailSheet({
  quote,
  onClose,
  accent
}) {
  const projects = useDB('projects');
  if (!quote) return null;
  const proj = projects.find(p => p.id == quote.projectId);
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px 10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Close"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, quote.id), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 4
    },
    onClick: async () => {
      await Backend.db.quotes.update(quote.id, {
        status: 'sent'
      });
      toast(`Quote sent to ${quote.client}`, 'success');
      onClose();
    }
  }, React.cloneElement(Ic.share, {
    size: 16
  }), " Send")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px 18px'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    c: QUOTE_STATUS_C[quote.status]
  }, quote.status), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 22,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.4,
      marginTop: 8
    }
  }, quote.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginTop: 4
    }
  }, quote.client, proj ? ` · ${proj.addr}` : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 36,
      fontWeight: 700,
      color: T.t1,
      marginTop: 16,
      letterSpacing: -1
    }
  }, "\xA3", quote.total.toLocaleString(), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: T.t2,
      marginLeft: 6
    }
  }, "excl. VAT"))), quote.items.length > 0 && /*#__PURE__*/React.createElement(Section, {
    title: "Line items"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 14,
      border: `0.5px solid ${T.hair}`,
      overflow: 'hidden'
    }
  }, quote.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderBottom: i === quote.items.length - 1 ? 'none' : `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 500
    }
  }, it.d), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 2
    }
  }, it.qty, " ", it.unit, " @ \xA3", it.rate.toLocaleString())), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, "\xA3", (it.qty * it.rate).toLocaleString()))))), /*#__PURE__*/React.createElement(Section, {
    title: "Actions"
  }, /*#__PURE__*/React.createElement(GroupedList, null, /*#__PURE__*/React.createElement(Row, {
    icon: Ic.mail,
    iconBg: accent,
    title: "Send to client",
    sub: `Email ${quote.client}`,
    onClick: async () => {
      await Backend.db.quotes.update(quote.id, {
        status: 'sent'
      });
      toast(`Quote sent to ${quote.client}`, 'success');
      onClose();
    }
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.check,
    iconBg: T.green,
    title: "Convert to project",
    sub: "Accept the quote and start the job",
    onClick: async () => {
      await Backend.db.projects.create({
        name: quote.title,
        client: quote.client,
        value: quote.total,
        pct: 0,
        status: 'active',
        addr: 'TBC',
        team: 0,
        due: null,
        margin: 0,
        createdAt: '2026-05-22'
      });
      await Backend.db.quotes.update(quote.id, {
        status: 'accepted'
      });
      toast(`Project created from ${quote.id}`, 'success');
      onClose();
    }
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.print,
    iconBg: T.cyan,
    title: "Export as PDF",
    sub: "A4 quotation with company header",
    onClick: () => window.cortexxQuotePDF ? window.cortexxQuotePDF(quote) : window.print()
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.copy,
    iconBg: T.purple,
    title: "Duplicate quote",
    onClick: async () => {
      const next = 'Q-' + (2120 + Math.floor(Math.random() * 100));
      await Backend.db.quotes.create({
        ...quote,
        id: next,
        status: 'draft',
        issued: '2026-05-22'
      });
      toast(`Duplicated as ${next}`, 'success');
      onClose();
    }
  }), /*#__PURE__*/React.createElement(Row, {
    icon: Ic.trash,
    iconBg: T.red,
    title: "Delete quote",
    danger: true,
    isLast: true,
    onClick: async () => {
      await Backend.db.quotes.remove(quote.id);
      toast('Quote deleted', 'success');
      onClose();
    }
  })))));
}

// AI Estimator — natural language → quote
function AIEstimatorSheet({
  onClose,
  accent
}) {
  const [brief, setBrief] = React.useState('');
  const [estimating, setEstimating] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const examples = ["2-storey rear extension in Islington, ~30m², brick & block, tiled roof", "Loft conversion in Highbury — Velux, en-suite, new staircase", "Cafe fit-out · 80m² in Shoreditch · counter, seating, lighting, basic kitchen"];
  const estimate = async () => {
    if (!brief.trim() || estimating) return;
    setEstimating(true);
    const r = await Backend.ai.estimateQuote(brief);
    setResult(r);
    setEstimating(false);
  };
  const save = async () => {
    await Backend.db.quotes.create({
      id: 'Q-' + (2120 + Math.floor(Math.random() * 100)),
      title: result.title,
      client: 'New prospect',
      total: result.total,
      status: 'draft',
      issued: '2026-05-22',
      validUntil: '2026-06-21',
      items: result.items,
      projectId: null
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px 10px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.spark, {
    size: 14
  }), " AI Estimator"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t2,
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, "Describe the job. Cortex will draft realistic UK line items, quantities, and rates."), /*#__PURE__*/React.createElement("textarea", {
    value: brief,
    onChange: e => {
      setBrief(e.target.value);
      setResult(null);
    },
    placeholder: "e.g. Two-storey rear extension in Islington, ~30m\xB2 ground + 30m\xB2 first, brick & block, tiled roof, M&E, plastering and finishes",
    rows: 4,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px 14px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      lineHeight: 1.5,
      outline: 'none',
      resize: 'vertical'
    }
  }), !result && !estimating && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4
    }
  }, "Examples"), examples.map((ex, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setBrief(ex),
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      background: 'transparent',
      border: 'none',
      color: T.blueL,
      fontFamily: SF,
      fontSize: 13,
      padding: '5px 0',
      cursor: 'pointer'
    }
  }, "\"", ex, "\""))), /*#__PURE__*/React.createElement("button", {
    onClick: estimate,
    disabled: !brief.trim() || estimating,
    style: {
      width: '100%',
      marginTop: 14,
      padding: '12px',
      background: brief.trim() && !estimating ? `linear-gradient(135deg, ${T.purple}, ${accent})` : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: brief.trim() && !estimating ? 'pointer' : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.spark, {
    size: 15
  }), " ", estimating ? 'Estimating…' : 'Estimate with Cortex'), result && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, result.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 28,
      fontWeight: 700,
      color: accent,
      marginTop: 6,
      letterSpacing: -0.5
    }
  }, "\xA3", result.total.toLocaleString()), result.items.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, result.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      fontFamily: SF,
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: T.t1
    }
  }, it.d), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      color: T.t2
    }
  }, it.qty, it.unit && ` ${it.unit}`, " @ \xA3", it.rate), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      color: T.t1,
      fontWeight: 600,
      marginLeft: 10,
      width: 60,
      textAlign: 'right'
    }
  }, "\xA3", (it.qty * it.rate).toLocaleString())))), result.assumptions && result.assumptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `0.5px solid ${T.hair}`,
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: T.purple,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4
    }
  }, "Assumptions"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingLeft: 18
    }
  }, result.assumptions.map((a, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, a)))), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    style: {
      width: '100%',
      marginTop: 12,
      padding: '10px',
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Save as draft quote"))));
}

// ═══════════════════════════════════════════════════════════════════
// TIMESHEETS
// ═══════════════════════════════════════════════════════════════════
const CIS_RATE = 0.20; // 20% CIS deduction for verified subbies
function TimesheetsScreen({
  accent
}) {
  const sheets = useDB('timesheets');
  const projects = useDB('projects');
  const week = sheets[0]?.week || '2026-W21';
  const total = sheets.reduce((s, t) => s + (t.mon || 0) + (t.tue || 0) + (t.wed || 0) + (t.thu || 0) + (t.fri || 0) + (t.sat || 0) + (t.sun || 0), 0);
  const pending = sheets.filter(t => t.status === 'pending');
  const approve = id => Backend.db.timesheets.update(id, {
    status: 'approved'
  });
  const approveAll = () => pending.forEach(t => Backend.db.timesheets.update(t.id, {
    status: 'approved'
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
    title: "Timesheets",
    subtitle: `Week ${week.split('-W')[1]} · ${total}h total`,
    right: pending.length > 0 ? /*#__PURE__*/React.createElement("button", {
      onClick: approveAll,
      style: {
        background: T.green,
        color: '#fff',
        border: 'none',
        borderRadius: 18,
        padding: '8px 14px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }
    }, React.cloneElement(Ic.check, {
      size: 13
    }), " Approve ", pending.length) : /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.calendar,
      onClick: () => window.cortexxNav('calendar')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 8
    }
  }, [{
    l: 'Total',
    v: total + 'h',
    c: T.t1
  }, {
    l: 'Pending',
    v: pending.length,
    c: T.amber
  }, {
    l: 'CIS due',
    v: '£' + sheets.filter(t => t.cis).reduce((s, t) => s + ((t.mon || 0) + (t.tue || 0) + (t.wed || 0) + (t.thu || 0) + (t.fri || 0) + (t.sat || 0) + (t.sun || 0)) * 22 * CIS_RATE, 0).toFixed(0),
    c: T.purple
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: T.bg2,
      borderRadius: 10,
      padding: '8px 10px',
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 9,
      color: T.t2,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    }
  }, s.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 16,
      color: s.c,
      fontWeight: 700,
      marginTop: 2,
      letterSpacing: -0.3
    }
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, sheets.map(t => {
    const days = [t.mon, t.tue, t.wed, t.thu, t.fri, t.sat, t.sun];
    const hrs = days.reduce((s, x) => s + (x || 0), 0);
    const project = projects.find(p => p.id === t.projectId);
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      style: {
        background: T.bg2,
        borderRadius: 12,
        padding: 12,
        border: `0.5px solid ${T.hair}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: t.name,
      size: 32
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 600,
        color: T.t1
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t2
      }
    }, project?.name || '—', " ", t.cis && /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.purple,
        marginLeft: 4
      }
    }, "\xB7 CIS"))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 17,
        fontWeight: 700,
        color: T.t1
      }
    }, hrs, "h"), t.status === 'pending' ? /*#__PURE__*/React.createElement("button", {
      onClick: () => approve(t.id),
      style: {
        background: T.green,
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '3px 8px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 10,
        fontWeight: 700,
        marginTop: 2
      }
    }, "Approve") : /*#__PURE__*/React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, React.cloneElement(Ic.check, {
      size: 10
    }), " approved"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 3
      }
    }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 9,
        color: T.t3
      }
    }, d), /*#__PURE__*/React.createElement("div", {
      style: {
        background: days[i] ? `${accent}22` : T.bg3,
        color: days[i] ? accent : T.t3,
        fontFamily: SFMono,
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 0',
        borderRadius: 4,
        marginTop: 2
      }
    }, days[i] || '—')))));
  }))));
}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR / SCHEDULE
// ═══════════════════════════════════════════════════════════════════
function CalendarScreen({
  accent
}) {
  const team = useDB('team');
  const projects = useDB('projects');
  const days = ['Mon 25', 'Tue 26', 'Wed 27', 'Thu 28', 'Fri 29', 'Sat 30', 'Sun 31'];
  // Mock assignments
  const ASSIGN = {
    'Tom Reilly': [1, 1, 1, 1, 1, 0, 0],
    'Aisha Begum': [1, 1, 1, 2, 2, 0, 0],
    'Jack Mitchell': [1, 1, 1, 1, 1, 0, 0],
    'Sara Khan': [1, 1, 0, 1, 1, 0, 0],
    'Marcus Webb': [2, 2, 2, 2, 0, 0, 0],
    'Dan Pavel': [2, 2, 2, 2, 2, 2, 0],
    'Lila Owusu': [0, 0, 3, 3, 3, 0, 0]
  };
  const projColor = id => ({
    1: T.blue,
    2: T.amber,
    3: T.green
  })[id] || T.t3;
  const [hint, setHint] = React.useState(null);
  React.useEffect(() => {
    (async () => {
      const s = await Backend.ai.suggestSchedule();
      setHint(s);
    })();
  }, []);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Schedule",
    subtitle: "Next week \xB7 drag to reassign",
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addtask')
    })
  }), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}22, ${accent}0a)`,
      border: `0.5px solid ${T.purple}44`,
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.purple,
      marginTop: 1
    }
  }, React.cloneElement(Ic.spark, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      lineHeight: 1.4
    }
  }, hint))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 12px',
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, projects.filter(p => ['active', 'snagging'].includes(p.status)).slice(0, 3).map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: SF,
      fontSize: 11,
      color: T.t2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: projColor(p.id)
    }
  }), p.name.split(' ').slice(0, 2).join(' ')))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 8px',
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 540
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '120px repeat(7, 1fr)',
      gap: 2,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", null), days.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      textAlign: 'center',
      padding: '4px 0',
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      fontWeight: 600
    }
  }, d))), team.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    style: {
      display: 'grid',
      gridTemplateColumns: '120px repeat(7, 1fr)',
      gap: 2,
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 6px'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.n,
    size: 20,
    c: m.color
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t1,
      fontWeight: 500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m.n.split(' ')[0])), (ASSIGN[m.n] || [0, 0, 0, 0, 0, 0, 0]).map((pid, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: pid ? `${projColor(pid)}33` : T.bg2,
      border: pid ? `0.5px solid ${projColor(pid)}66` : `0.5px solid ${T.hair}`,
      borderRadius: 4,
      minHeight: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, pid > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: projColor(pid)
    }
  })))))))));
}

// ═══════════════════════════════════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════════════════════════════════
function MaterialsScreen({
  accent
}) {
  const materials = useDB('materials');
  const projects = useDB('projects');
  const lowStock = useComputed('lowStock');
  const [forecast, setForecast] = React.useState(null);
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Materials",
    subtitle: `${materials.length} SKUs · ${lowStock} low stock`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addmaterial')
    })
  }), lowStock > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: async () => {
      if (!forecast) {
        setForecast('thinking');
        const r = await Backend.ai.forecastMaterials();
        setForecast(r);
      }
    },
    style: {
      background: `linear-gradient(135deg, ${T.red}22, ${T.amber}22)`,
      border: `0.5px solid ${T.red}44`,
      borderRadius: 12,
      padding: '10px 14px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.red
    }
  }, React.cloneElement(Ic.alert, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600
    }
  }, lowStock, " items below minimum"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 1
    }
  }, forecast === 'thinking' ? 'Cortex thinking…' : forecast ? forecast : 'Tap for AI restock advice')), !forecast && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.purple
    }
  }, React.cloneElement(Ic.spark, {
    size: 14
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, materials.map(m => {
    const low = m.stock < m.min;
    const pct = Math.min(m.stock / m.min, 1);
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      style: {
        background: T.bg2,
        borderRadius: 10,
        padding: '10px 12px',
        border: `0.5px solid ${T.hair}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 8,
        background: low ? `${T.red}22` : `${accent}22`,
        color: low ? T.red : accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.cloneElement(Ic.box, {
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, m.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(Bar, {
      pct: pct * 100,
      c: low ? T.red : T.green,
      h: 3
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 10,
        color: T.t3,
        marginTop: 3
      }
    }, m.sku, " \xB7 min ", m.min, " ", m.unit)), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SFMono,
        fontSize: 16,
        color: low ? T.red : T.t1,
        fontWeight: 700
      }
    }, m.stock), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 9,
        color: T.t3
      }
    }, m.unit)));
  }))));
}

// ═══════════════════════════════════════════════════════════════════
// SUBCONTRACTORS
// ═══════════════════════════════════════════════════════════════════
function SubsScreen({
  accent
}) {
  const subs = useDB('subs');
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Subcontractors",
    subtitle: `${subs.length} on books · ${subs.filter(s => s.insured && s.cscs).length} fully verified`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addsub')
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, subs.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      border: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 600
    }
  }, s.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 2
    }
  }, s.trade, " \xB7 ", s.contact)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.amber
    }
  }, React.cloneElement(Ic.star, {
    size: 13,
    fill: 'currentColor'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 12,
      color: T.t1,
      fontWeight: 600
    }
  }, s.rating))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    c: s.insured ? T.green : T.red,
    size: "xs"
  }, s.insured ? '✓ Insured' : '✗ No insurance'), /*#__PURE__*/React.createElement(Pill, {
    c: s.cscs ? T.blue : T.amber,
    size: "xs"
  }, s.cscs ? '✓ CSCS' : '? CSCS'), /*#__PURE__*/React.createElement(Pill, {
    c: T.t3,
    size: "xs"
  }, s.jobsDone, " jobs \xB7 since ", s.since)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toast(`Calling ${s.contact}…`, 'info'),
    style: {
      flex: 1,
      background: 'transparent',
      border: `0.5px solid ${T.hairMid}`,
      color: T.t1,
      borderRadius: 8,
      padding: '7px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.phone, {
    size: 12
  }), " Call"), /*#__PURE__*/React.createElement("button", {
    onClick: () => toast(`Message draft started for ${s.contact}`, 'success'),
    style: {
      flex: 1,
      background: 'transparent',
      border: `0.5px solid ${T.hairMid}`,
      color: T.t1,
      borderRadius: 8,
      padding: '7px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.mail, {
    size: 12
  }), " Message")))))));
}

// ═══════════════════════════════════════════════════════════════════
// EQUIPMENT
// ═══════════════════════════════════════════════════════════════════
function EquipmentScreen({
  accent
}) {
  const equipment = useDB('equipment');
  const cats = [...new Set(equipment.map(e => e.category))];
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Equipment",
    subtitle: `${equipment.length} items · ${equipment.filter(e => e.status === 'service-due').length} need service`,
    right: /*#__PURE__*/React.createElement(HeaderBtn, {
      icon: Ic.plus,
      accent: accent,
      onClick: () => window.cortexxNav('addequipment')
    })
  }), cats.map(cat => {
    const items = equipment.filter(e => e.category === cat);
    return /*#__PURE__*/React.createElement(Section, {
      key: cat,
      title: cat
    }, /*#__PURE__*/React.createElement(GroupedList, null, items.map((e, i, a) => {
      const statusC = e.status === 'on-site' ? T.green : e.status === 'service-due' ? T.red : T.t3;
      return /*#__PURE__*/React.createElement(Row, {
        key: e.id,
        icon: Ic.tool,
        iconBg: statusC,
        title: e.name,
        sub: `${e.serial} · ${e.location}`,
        right: /*#__PURE__*/React.createElement("div", {
          style: {
            textAlign: 'right'
          }
        }, /*#__PURE__*/React.createElement(Pill, {
          c: statusC,
          size: "xs"
        }, e.status === 'service-due' ? 'SERVICE' : e.status.toUpperCase()), /*#__PURE__*/React.createElement("div", {
          style: {
            fontFamily: SFMono,
            fontSize: 9,
            color: T.t3,
            marginTop: 2
          }
        }, "nx ", _formatRelDate(e.nextService))),
        isLast: i === a.length - 1
      });
    })));
  })));
}
Object.assign(window, {
  QuotesScreen,
  QuoteDetailSheet,
  AIEstimatorSheet,
  TimesheetsScreen,
  CalendarScreen,
  MaterialsScreen,
  SubsScreen,
  EquipmentScreen,
  QUOTE_STATUS_C
});