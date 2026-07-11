// CortexBuild Pro — Phase 114: Tender & Bid Management
// BidManagementScreen — bid pipeline (kanban-style), takeoff measurement,
// supplier RFQ comparison, and win/loss analytics. Wired to the `bids`,
// `takeoffs`, and `rfqs` tables in backend-v17.js.

(function () {
  if (!window.Backend) return;

  const card = (extra) => ({ background: T.bg1, border: '1px solid ' + T.hair, borderRadius: 14, padding: 16, ...extra });
  const money = (n) => '£' + Math.round(Number(n) || 0).toLocaleString();
  const moneyK = (n) => { n = Number(n) || 0; return Math.abs(n) >= 1000 ? '£' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 0) + 'k' : '£' + Math.round(n); };

  const STAGES = [
    { k: 'identified', l: 'Identified', c: '#64748b' },
    { k: 'qualifying', l: 'Qualifying', c: '#3b82f6' },
    { k: 'submitted', l: 'Submitted', c: '#8b5cf6' },
    { k: 'won', l: 'Won', c: '#10b981' },
    { k: 'lost', l: 'Lost', c: '#ef4444' },
  ];

  window.BidManagementScreen = function ({ accent }) {
    const bids = window.useDB('bids');
    const takeoffs = window.useDB('takeoffs');
    const rfqs = window.useDB('rfqs');
    const [tab, setTab] = React.useState('pipeline');
    const [openBid, setOpenBid] = React.useState(null);
    const acc = accent || T.blue;
    const C = Backend.computed;

    const pipelineValue = C.bidPipelineValue();
    const winRate = C.winRate();

    const advance = async (bid) => {
      const idx = STAGES.findIndex(s => s.k === bid.stage);
      if (idx < 0 || idx >= 3) return;
      const next = STAGES[idx + 1].k;
      await Backend.db.bids.update(bid.id, { stage: next, submittedOn: next === 'submitted' ? new Date().toISOString().slice(0, 10) : bid.submittedOn });
      window.cortexxToast && window.cortexxToast('Moved to ' + STAGES[idx + 1].l, 'success');
    };
    const mark = async (bid, stage) => {
      await Backend.db.bids.update(bid.id, { stage, probability: stage === 'won' ? 100 : 0 });
      window.cortexxToast && window.cortexxToast(stage === 'won' ? '🎉 Bid won!' : 'Marked as lost', stage === 'won' ? 'success' : 'info');
    };

    const TabBar = () => React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 16 } },
      [['pipeline', 'Pipeline'], ['takeoff', 'Takeoff'], ['rfq', 'RFQ'], ['analytics', 'Win/Loss']].map(([k, l]) =>
        React.createElement('button', { key: k, onClick: () => setTab(k),
          style: { flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: tab === k ? acc : T.bg2, color: tab === k ? '#fff' : T.t2 } }, l)))

    // ── Pipeline ───────────────────────────────────────────────────
    const Pipeline = () => React.createElement('div', null,
      STAGES.map(stage => {
        const items = bids.filter(b => b.stage === stage.k);
        if (!items.length) return null;
        return React.createElement('div', { key: stage.k, style: { marginBottom: 18 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
            React.createElement('span', { style: { width: 8, height: 8, borderRadius: 4, background: stage.c } }),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 800, color: T.t1, textTransform: 'uppercase', letterSpacing: '0.05em' } }, stage.l),
            React.createElement('span', { style: { fontSize: 11, color: T.t3 } }, items.length + ' · ' + moneyK(items.reduce((a, b) => a + b.value, 0)))),
          items.map(b => React.createElement('div', { key: b.id, onClick: () => setOpenBid(b), style: card({ marginBottom: 8, padding: 14, cursor: 'pointer', borderLeftWidth: 3, borderLeftColor: stage.c }) },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
              React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: T.t1 } }, b.title),
              React.createElement('span', { style: { fontSize: 14, fontWeight: 800, color: T.t1 } }, moneyK(b.value))),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              React.createElement('span', { style: { fontSize: 12, color: T.t3 } }, b.ref + ' · ' + b.client),
              !['won', 'lost'].includes(b.stage) && React.createElement('span', { style: { fontSize: 11, color: acc, fontWeight: 700 } }, b.probability + '% likely')),
            !['won', 'lost'].includes(b.stage) && React.createElement('div', { style: { display: 'flex', gap: 6, marginTop: 10 } },
              stage.k !== 'submitted' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); advance(b); }, style: { flex: 1, padding: 7, borderRadius: 8, background: T.bg2, border: '1px solid ' + T.hair, color: acc, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' } }, 'Advance →'),
              stage.k === 'submitted' && React.createElement(React.Fragment, null,
                React.createElement('button', { onClick: (e) => { e.stopPropagation(); mark(b, 'won'); }, style: { flex: 1, padding: 7, borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid ' + T.green, color: T.green, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' } }, '✓ Won'),
                React.createElement('button', { onClick: (e) => { e.stopPropagation(); mark(b, 'lost'); }, style: { flex: 1, padding: 7, borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: T.red, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' } }, '✕ Lost'))))));
      })
    );

    // ── Takeoff ────────────────────────────────────────────────────
    const Takeoff = () => {
      const submittedBids = bids.filter(b => takeoffs.some(t => t.bidId === b.id)) || bids.slice(0, 1);
      return React.createElement('div', null,
        submittedBids.length === 0 && React.createElement('p', { style: { color: T.t2, fontSize: 13, textAlign: 'center', padding: 30 } }, 'No takeoff measurements yet.'),
        submittedBids.map(b => {
          const items = takeoffs.filter(t => t.bidId === b.id);
          const total = items.reduce((a, t) => a + t.total, 0);
          return React.createElement('div', { key: b.id, style: card({ marginBottom: 12 }) },
            React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: T.t1, marginBottom: 10 } }, b.title),
            items.map(t => React.createElement('div', { key: t.id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + T.hair } },
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 13, color: T.t1, fontWeight: 600 } }, t.item),
                React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, t.qty + ' ' + t.unit + ' × ' + money(t.rate))),
              React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, money(t.total)))),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 } },
              React.createElement('span', { style: { fontSize: 13, fontWeight: 800, color: T.t2 } }, 'Measured total'),
              React.createElement('span', { style: { fontSize: 16, fontWeight: 800, color: acc } }, money(total))),
            React.createElement('button', { onClick: () => window.cortexxNav && window.cortexxNav('addtakeoff', b), style: { marginTop: 12, width: '100%', padding: 10, borderRadius: 9, background: T.bg2, border: '1px solid ' + T.hair, color: acc, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' } }, '+ Add measurement'));
        })
      );
    };

    // ── RFQ comparison ─────────────────────────────────────────────
    const RFQ = () => {
      const byPackage = {};
      rfqs.forEach(r => { (byPackage[r.package] = byPackage[r.package] || []).push(r); });
      return React.createElement('div', null,
        Object.keys(byPackage).length === 0 && React.createElement('p', { style: { color: T.t2, fontSize: 13, textAlign: 'center', padding: 30 } }, 'No supplier quotes to compare yet.'),
        Object.entries(byPackage).map(([pkg, rows]) => {
          const cheapest = Math.min(...rows.map(r => r.price));
          return React.createElement('div', { key: pkg, style: card({ marginBottom: 12 }) },
            React.createElement('div', { style: { fontSize: 13, fontWeight: 800, color: T.t1, marginBottom: 10 } }, pkg),
            rows.sort((a, b) => a.price - b.price).map(r => React.createElement('div', { key: r.id, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, marginBottom: 6, background: r.selected ? 'rgba(16,185,129,0.08)' : T.bg2, border: '1px solid ' + (r.selected ? T.green : T.hair) } },
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: T.t1 } }, r.supplier, r.price === cheapest && React.createElement('span', { style: { marginLeft: 6, fontSize: 10, color: T.green, fontWeight: 700 } }, 'LOWEST')),
                React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Lead ' + r.lead + ' · ★ ' + r.rating)),
              React.createElement('span', { style: { fontSize: 14, fontWeight: 800, color: T.t1 } }, money(r.price)),
              React.createElement('button', { onClick: async () => { for (const x of rows) await Backend.db.rfqs.update(x.id, { selected: x.id === r.id }); window.cortexxToast && window.cortexxToast('Selected ' + r.supplier, 'success'); }, style: { padding: '5px 10px', borderRadius: 7, background: r.selected ? T.green : 'transparent', border: '1px solid ' + (r.selected ? T.green : T.hair), color: r.selected ? '#fff' : T.t2, fontSize: 11, fontWeight: 700, cursor: 'pointer' } }, r.selected ? '✓' : 'Select'))));
        })
      );
    };

    // ── Win/Loss analytics ─────────────────────────────────────────
    const Analytics = () => {
      const won = bids.filter(b => b.stage === 'won');
      const lost = bids.filter(b => b.stage === 'lost');
      const wonVal = won.reduce((a, b) => a + b.value, 0);
      const lostVal = lost.reduce((a, b) => a + b.value, 0);
      return React.createElement('div', null,
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 } },
          React.createElement('div', { style: card({ padding: 16, textAlign: 'center' }) },
            React.createElement('div', { style: { fontSize: 32, fontWeight: 800, color: acc } }, winRate + '%'),
            React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Win rate')),
          React.createElement('div', { style: card({ padding: 16, textAlign: 'center' }) },
            React.createElement('div', { style: { fontSize: 32, fontWeight: 800, color: T.t1 } }, moneyK(pipelineValue)),
            React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Weighted pipeline'))),
        React.createElement('div', { style: card({ marginBottom: 12 }) },
          React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: T.t3, marginBottom: 10 } }, 'WON vs LOST VALUE'),
          React.createElement('div', { style: { display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', background: T.bg2 } },
            React.createElement('div', { style: { width: (wonVal / (wonVal + lostVal || 1) * 100) + '%', background: T.green, display: 'flex', alignItems: 'center', paddingLeft: 8 } },
              React.createElement('span', { style: { fontSize: 10, color: '#fff', fontWeight: 700 } }, moneyK(wonVal))),
            React.createElement('div', { style: { flex: 1, background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 } },
              React.createElement('span', { style: { fontSize: 10, color: '#fff', fontWeight: 700 } }, moneyK(lostVal)))),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 8 } },
            React.createElement('span', { style: { fontSize: 11, color: T.green } }, won.length + ' won'),
            React.createElement('span', { style: { fontSize: 11, color: T.red } }, lost.length + ' lost'))),
        lost.length > 0 && React.createElement('div', { style: card() },
          React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: T.t3, marginBottom: 8 } }, 'LOSS REASONS'),
          lost.map(b => React.createElement('div', { key: b.id, style: { padding: '8px 0', borderBottom: '1px solid ' + T.hair } },
            React.createElement('div', { style: { fontSize: 13, color: T.t1, fontWeight: 600 } }, b.title),
            React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, b.notes || 'No reason recorded'))))
      );
    };

    return React.createElement('div', { style: { height: '100%', overflowY: 'auto', padding: '12px 16px 120px' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 } },
        React.createElement('div', { style: card({ padding: 14 }) },
          React.createElement('div', { style: { fontSize: 20, fontWeight: 800, color: acc } }, moneyK(pipelineValue)),
          React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Weighted pipeline')),
        React.createElement('div', { style: card({ padding: 14 }) },
          React.createElement('div', { style: { fontSize: 20, fontWeight: 800, color: T.green } }, winRate + '%'),
          React.createElement('div', { style: { fontSize: 11, color: T.t3 } }, 'Win rate'))),
      React.createElement(TabBar),
      tab === 'pipeline' && React.createElement(Pipeline),
      tab === 'takeoff' && React.createElement(Takeoff),
      tab === 'rfq' && React.createElement(RFQ),
      tab === 'analytics' && React.createElement(Analytics),
      tab === 'pipeline' && React.createElement('button', { onClick: () => window.cortexxNav && window.cortexxNav('addbid'),
        style: { marginTop: 16, width: '100%', padding: 14, borderRadius: 12, background: acc, color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' } }, '+ New bid'),
      openBid && React.createElement(BidDetail, { bid: openBid, onClose: () => setOpenBid(null), accent: acc })
    );
  };

  // ── Bid detail sheet ─────────────────────────────────────────────
  function BidDetail({ bid, onClose, accent }) {
    const stage = STAGES.find(s => s.k === bid.stage) || STAGES[0];
    return React.createElement('div', { style: { position: 'fixed', inset: 0, background: T.bg1, zIndex: 1100, overflowY: 'auto', paddingBottom: 100 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px' } },
        React.createElement('button', { onClick: onClose, style: { width: 36, height: 36, borderRadius: 18, background: T.bg2, border: 'none', color: T.t1, fontSize: 20, cursor: 'pointer' } }, '←'),
        React.createElement('h2', { style: { color: T.t1, fontSize: 18, fontWeight: 800, margin: 0, flex: 1 } }, bid.ref)),
      React.createElement('div', { style: { padding: '0 20px' } },
        React.createElement('div', { style: { fontSize: 22, fontWeight: 800, color: T.t1, marginBottom: 6 } }, bid.title),
        React.createElement('span', { style: { display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: stage.c + '22', color: stage.c, fontSize: 12, fontWeight: 700, marginBottom: 16 } }, stage.l),
        [['Client', bid.client], ['Value', money(bid.value)], ['Probability', bid.probability + '%'], ['Due', bid.due], ['Estimator', bid.estimator]].map(([k, v]) =>
          React.createElement('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid ' + T.hair } },
            React.createElement('span', { style: { fontSize: 13, color: T.t3 } }, k),
            React.createElement('span', { style: { fontSize: 13, color: T.t1, fontWeight: 600 } }, v))),
        React.createElement('div', { style: { marginTop: 16, padding: 14, background: T.bg2, borderRadius: 10, fontSize: 13, color: T.t2, lineHeight: 1.6 } }, bid.notes || 'No notes.'))
    );
  }

})();
