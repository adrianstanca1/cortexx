(function () {
  if (window.CortexBankRec) return;
  function parseCSV(text) {
    const rows = [];
    let row = [],
      cur = '',
      inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i],
        n = text[i + 1];
      if (inQ) {
        if (c === '"' && n === '"') {
          cur += '"';
          i++;
        } else if (c === '"') inQ = false;else cur += c;
      } else {
        if (c === '"') inQ = true;else if (c === ',') {
          row.push(cur);
          cur = '';
        } else if (c === '\n') {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = '';
        } else if (c === '\r') {} else cur += c;
      }
    }
    if (cur || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows.filter(r => r.some(c => c && c.trim()));
  }
  const COL_DATE = ['date', 'transactiondate', 'postingdate', 'valuedate', 'txdate', 'starteddate', 'completeddate'];
  const COL_DESC = ['description', 'details', 'reference', 'payee', 'memo', 'narrative', 'particulars', 'transactioninfo'];
  const COL_AMT = ['amount', 'value', 'paidin', 'credit', 'moneyin', 'txamount', 'amount(gbp)'];
  const COL_TYPE = ['type', 'txtype', 'category'];
  function mapHeaders(headers) {
    const idx = {
      date: -1,
      desc: -1,
      amount: -1,
      in: -1,
      out: -1
    };
    const lc = headers.map(h => String(h || '').toLowerCase().replace(/[\s_]/g, ''));
    for (let i = 0; i < lc.length; i++) {
      const h = lc[i];
      if (idx.date < 0 && COL_DATE.some(k => h.includes(k))) idx.date = i;
      if (idx.desc < 0 && COL_DESC.some(k => h === k || h.includes(k))) idx.desc = i;
      if (h.includes('paidin') || h === 'credit' || h.includes('moneyin')) idx.in = i;
      if (h.includes('paidout') || h === 'debit' || h.includes('moneyout')) idx.out = i;
      if (idx.amount < 0 && COL_AMT.some(k => h === k)) idx.amount = i;
    }
    return idx;
  }
  function parseDate(s) {
    s = String(s || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})$/i);
    if (m) {
      const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase()) + 1;
      return m[3] + '-' + String(mo).padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    const d = new Date(s);
    return isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  }
  function parseAmount(s) {
    if (s == null || s === '') return 0;
    const cleaned = String(s).replace(/[£$€,\s]/g, '');
    if (!cleaned) return 0;
    const negative = cleaned.startsWith('(') && cleaned.endsWith(')');
    const n = parseFloat(cleaned.replace(/[()]/g, ''));
    if (!isFinite(n)) return 0;
    return negative ? -n : n;
  }
  function parseStatement(text) {
    const rows = parseCSV(text);
    if (!rows.length) return {
      credits: [],
      debits: [],
      headers: null
    };
    const first = rows[0];
    const looksHeader = first.every(c => c && !/^-?\d/.test(c.trim())) && first.length >= 3;
    const data = looksHeader ? rows.slice(1) : rows;
    const headers = looksHeader ? first.map(h => String(h).trim()) : ['col1', 'col2', 'col3', 'col4', 'col5'];
    const idx = looksHeader ? mapHeaders(headers) : {
      date: 0,
      desc: 2,
      amount: 3,
      in: -1,
      out: -1
    };
    const credits = [],
      debits = [];
    for (const r of data) {
      const date = parseDate(r[idx.date]);
      const desc = String(r[idx.desc] || '').trim();
      let amount = 0;
      if (idx.in >= 0 && parseAmount(r[idx.in]) > 0) amount = parseAmount(r[idx.in]);else if (idx.out >= 0 && parseAmount(r[idx.out]) > 0) amount = -parseAmount(r[idx.out]);else amount = parseAmount(r[idx.amount]);
      if (!date || !desc) continue;
      const rec = {
        date,
        desc,
        amount: Math.abs(amount),
        raw: r.join(' | ')
      };
      if (amount > 0) credits.push(rec);else if (amount < 0) debits.push(rec);
    }
    return {
      credits,
      debits,
      headers
    };
  }
  function scoreMatch(invoice, tx) {
    let score = 0;
    if (Math.abs(invoice.amount - tx.amount) < 0.011) score += 60;else return 0;
    const descUC = tx.desc.toUpperCase();
    if (descUC.includes(invoice.id)) score += 30;else if (descUC.includes(invoice.id.replace(/^INV-/, ''))) score += 15;
    const clientWords = String(invoice.client || '').toUpperCase().split(/[\s,.]+/).filter(w => w.length > 3);
    for (const w of clientWords) if (descUC.includes(w)) {
      score += 10;
      break;
    }
    const invDate = invoice.issued || invoice.due;
    if (invDate && tx.date) {
      const diff = Math.abs(new Date(tx.date) - new Date(invDate)) / 86400000;
      if (diff <= 3) score += 8;else if (diff <= 14) score += 4;else if (diff <= 60) score += 1;else score -= 5;
    }
    return score;
  }
  function autoMatch(invoices, credits) {
    const outstanding = invoices.filter(i => i.status !== 'paid');
    const matches = [];
    const usedTx = new Set();
    const usedInv = new Set();
    const pairs = [];
    for (const inv of outstanding) {
      for (let i = 0; i < credits.length; i++) {
        const s = scoreMatch(inv, credits[i]);
        if (s > 0) pairs.push({
          inv,
          txIdx: i,
          score: s
        });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    for (const p of pairs) {
      if (usedInv.has(p.inv.id) || usedTx.has(p.txIdx)) continue;
      usedInv.add(p.inv.id);
      usedTx.add(p.txIdx);
      const conf = p.score >= 90 ? 'high' : p.score >= 70 ? 'medium' : 'low';
      matches.push({
        invoice: p.inv,
        tx: credits[p.txIdx],
        score: p.score,
        confidence: conf
      });
    }
    const unmatchedTx = credits.filter((_, i) => !usedTx.has(i));
    const unmatchedInv = outstanding.filter(i => !usedInv.has(i.id));
    return {
      matches,
      unmatchedTx,
      unmatchedInv
    };
  }
  async function reconcile(matches) {
    let done = 0;
    for (const m of matches) {
      await window.Backend.db.invoices.update(m.invoice.id, {
        status: 'paid',
        paid: m.tx.date,
        reconciled_at: new Date().toISOString(),
        bank_ref: m.tx.desc.slice(0, 80),
        bank_amount: m.tx.amount
      });
      done++;
    }
    try {
      if (window.Backend.db.activity && window.Backend.db.activity.create) {
        await window.Backend.db.activity.create({
          id: 'act-bankrec-' + Date.now(),
          t: 'Bank reconciliation',
          sub: done + ' invoice' + (done === 1 ? '' : 's') + ' marked paid',
          when: 'now',
          icon: '🏦'
        });
      }
    } catch (e) {}
    return done;
  }
  window.CortexBankRec = {
    parseStatement,
    autoMatch,
    reconcile
  };
})();
function BankRecScreen({
  accent
}) {
  const invoices = useDB('invoices');
  const fileRef = React.useRef();
  const [stage, setStage] = React.useState('upload');
  const [parsed, setParsed] = React.useState(null);
  const [matches, setMatches] = React.useState([]);
  const [unmatchedTx, setUnmatchedTx] = React.useState([]);
  const [unmatchedInv, setUnmatchedInv] = React.useState([]);
  const [selected, setSelected] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const onFile = async file => {
    if (!file) return;
    const text = await file.text();
    const p = window.CortexBankRec.parseStatement(text);
    if (!p.credits.length && !p.debits.length) {
      if (window.cortexxToast) window.cortexxToast('No transactions found — check CSV format', 'error');
      return;
    }
    setParsed(p);
    const m = window.CortexBankRec.autoMatch(invoices, p.credits);
    setMatches(m.matches);
    setUnmatchedTx(m.unmatchedTx);
    setUnmatchedInv(m.unmatchedInv);
    const sel = {};
    m.matches.forEach(x => {
      if (x.confidence !== 'low') sel[x.invoice.id] = true;
    });
    setSelected(sel);
    setStage('review');
    if (window.cortexxToast) window.cortexxToast('Parsed ' + p.credits.length + ' credits · ' + m.matches.length + ' matches', 'success');
  };
  const pullFromBank = async () => {
    if (!window.CortexBanking) {
      if (window.cortexxToast) window.cortexxToast('Banking client not loaded', 'error');
      return;
    }
    if (window.cortexxToast) window.cortexxToast('Pulling from bank…', 'info');
    try {
      const r = await window.CortexBanking.pullTransactions();
      if (!r.transactions || !r.transactions.length) {
        if (window.cortexxToast) window.cortexxToast(r.connections ? 'No transactions in window' : 'Connect a bank first (Settings → Banking)', 'error');
        return;
      }
      const credits = r.transactions.filter(t => t.kind === 'credit');
      const debits = r.transactions.filter(t => t.kind === 'debit');
      setParsed({
        credits,
        debits,
        source: 'open-banking'
      });
      const m = window.CortexBankRec.autoMatch(invoices, credits);
      setMatches(m.matches);
      setUnmatchedTx(m.unmatchedTx);
      setUnmatchedInv(m.unmatchedInv);
      const sel = {};
      m.matches.forEach(x => {
        if (x.confidence !== 'low') sel[x.invoice.id] = true;
      });
      setSelected(sel);
      setStage('review');
      if (window.cortexxToast) window.cortexxToast('Pulled ' + credits.length + ' credits · ' + m.matches.length + ' matches', 'success');
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('Pull failed: ' + e.message, 'error');
    }
  };
  const apply = async () => {
    setBusy(true);
    const chosen = matches.filter(m => selected[m.invoice.id]);
    const n = await window.CortexBankRec.reconcile(chosen);
    setCount(n);
    setBusy(false);
    setStage('done');
    if (window.cortexxToast) window.cortexxToast(n + ' invoice' + (n === 1 ? '' : 's') + ' reconciled', 'success');
  };
  const restart = () => {
    setStage('upload');
    setParsed(null);
    setMatches([]);
    setUnmatchedTx([]);
    setUnmatchedInv([]);
    setSelected({});
    setCount(0);
  };
  const Pill = ({
    c,
    label
  }) => React.createElement("span", {
    style: {
      padding: '3px 8px',
      borderRadius: 999,
      background: c + '20',
      color: c,
      fontSize: 10,
      fontFamily: SFMono,
      fontWeight: 700,
      letterSpacing: 0.4
    }
  }, label);
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "Bank reconciliation",
    subtitle: "Upload statement \xB7 auto-match \xB7 one-tap reconcile"
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, stage === 'upload' && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 18,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 8
    }
  }, "\uD83C\uDFE6"), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: T.t1,
      marginBottom: 4
    }
  }, "Drop a bank statement CSV"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Auto-detects columns from Barclays, Lloyds, HSBC, NatWest, Monzo, Starling, Tide, Revolut and most others."), React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: ".csv,text/csv",
    style: {
      display: 'none'
    },
    onChange: e => onFile(e.target.files && e.target.files[0])
  }), React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    style: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: 10,
      border: 'none',
      background: accent,
      color: '#fff',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700
    }
  }, "Choose CSV file"), React.createElement("button", {
    onClick: pullFromBank,
    style: {
      width: '100%',
      marginTop: 8,
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600
    }
  }, "Pull from connected bank (Open Banking)")), React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 6
    }
  }, "OUTSTANDING NOW"), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13
    }
  }, React.createElement("span", {
    style: {
      color: T.t1
    }
  }, invoices.filter(i => i.status !== 'paid').length, " invoices"), React.createElement("span", {
    style: {
      fontWeight: 700,
      color: T.t1,
      fontFamily: SFMono
    }
  }, "\xA3", invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount || 0), 0).toLocaleString())))), stage === 'review' && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 12,
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      display: 'flex',
      justifyContent: 'space-around',
      textAlign: 'center',
      fontSize: 12,
      color: T.t2
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: T.green
    }
  }, matches.length), "matches"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: T.amber
    }
  }, unmatchedTx.length), "orphan tx"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: T.red
    }
  }, unmatchedInv.length), "unpaid")), React.createElement("div", {
    style: {
      marginTop: 16,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "MATCHES"), matches.length === 0 && React.createElement("div", {
    style: {
      padding: 14,
      fontSize: 13,
      color: T.t2
    }
  }, "No automatic matches found. You can still review unmatched items below."), matches.map(m => React.createElement("label", {
    key: m.invoice.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + (selected[m.invoice.id] ? T.green : T.hair)
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!selected[m.invoice.id],
    onChange: e => setSelected({
      ...selected,
      [m.invoice.id]: e.target.checked
    }),
    style: {
      width: 18,
      height: 18,
      accentColor: T.green
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.t1
    }
  }, m.invoice.id, " \xB7 \xA3", m.invoice.amount.toLocaleString()), React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.t2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m.invoice.client, " \u2190 ", m.tx.desc.slice(0, 50))), React.createElement(Pill, {
    c: m.confidence === 'high' ? T.green : m.confidence === 'medium' ? T.amber : T.t2,
    label: m.confidence
  }))), unmatchedTx.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "ORPHAN CREDITS"), unmatchedTx.slice(0, 8).map((tx, i) => React.createElement("div", {
    key: i,
    style: {
      marginTop: 6,
      padding: 10,
      borderRadius: 8,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12
    }
  }, React.createElement("span", {
    style: {
      color: T.t1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '70%'
    }
  }, tx.desc), React.createElement("span", {
    style: {
      fontWeight: 700,
      fontFamily: SFMono,
      color: T.green
    }
  }, "\xA3", tx.amount.toLocaleString())), React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.t2,
      marginTop: 2
    }
  }, tx.date))), unmatchedTx.length > 8 && React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      color: T.t2
    }
  }, "\u2026 and ", unmatchedTx.length - 8, " more")), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18,
      position: 'sticky',
      bottom: 12
    }
  }, React.createElement("button", {
    onClick: restart,
    style: {
      flex: 1,
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600
    }
  }, "Back"), React.createElement("button", {
    onClick: apply,
    disabled: busy || !Object.values(selected).filter(Boolean).length,
    style: {
      flex: 2,
      padding: '12px 14px',
      borderRadius: 10,
      border: 'none',
      background: T.green,
      color: '#fff',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      opacity: busy || !Object.values(selected).filter(Boolean).length ? 0.5 : 1
    }
  }, busy ? 'Reconciling…' : 'Reconcile ' + Object.values(selected).filter(Boolean).length + ' invoice' + (Object.values(selected).filter(Boolean).length === 1 ? '' : 's')))), stage === 'done' && React.createElement("div", {
    style: {
      marginTop: 60,
      textAlign: 'center',
      padding: 20
    }
  }, React.createElement("div", {
    style: {
      fontSize: 60,
      marginBottom: 12
    }
  }, "\u2713"), React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: T.t1,
      marginBottom: 8
    }
  }, count, " invoice", count === 1 ? '' : 's', " reconciled"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.t2,
      marginBottom: 24
    }
  }, "Marked paid \xB7 activity logged \xB7 cash flow updated"), React.createElement("button", {
    onClick: restart,
    style: {
      padding: '10px 22px',
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600
    }
  }, "Reconcile another statement"))));
}
Object.assign(window, {
  BankRecScreen
});