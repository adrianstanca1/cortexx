// Cortexx — Payments ledger (Phase 90)
// Record payments against invoices, mark paid, running balances, per-tenant log.

// ─── Per-tenant payment log ───────────────────────────────────────
(function () {
  if (window.CortexPayments) return;
  const KEY = () => 'cortexx_payments__' + (window.CortexTenant ? window.CortexTenant.active() : 'default');
  function load() { try { const r = localStorage.getItem(KEY()); if (r) return JSON.parse(r); } catch (e) {} return []; }
  window.CortexPayments = {
    list() { return load(); },
    add(p) {
      const l = load();
      l.unshift({ id: Date.now(), ...p });
      try { localStorage.setItem(KEY(), JSON.stringify(l.slice(0, 300))); } catch (e) {}
      return l;
    },
  };
})();

const PAY_METHODS = [
  { k: 'transfer', l: 'Bank transfer', i: 'bank' },
  { k: 'card', l: 'Card', i: 'card' },
  { k: 'cash', l: 'Cash', i: 'cash' },
  { k: 'cheque', l: 'Cheque', i: 'cheque' },
];

function RecordPaymentSheet({ invoice, onClose, accent, onDone }) {
  const [amount, setAmount] = React.useState(String(invoice.amount));
  const [method, setMethod] = React.useState('transfer');
  const [ref, setRef] = React.useState('');
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = React.useState(false);
  const [paidPayment, setPaidPayment] = React.useState(null);
  const valid = parseFloat(amount) > 0 && date;

  const confirm = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const amt = parseFloat(amount);
    const full = amt >= invoice.amount - 0.01;
    await Backend.db.invoices.update(invoice.id, full
      ? { status: 'paid', paid: date }
      : { status: 'due', partPaid: amt });
    const payment = { id: Date.now(), invoiceId: invoice.id, client: invoice.client, amount: amt, method, ref, date, full };
    if (window.CortexPayments) window.CortexPayments.add(payment);
    if (window.CortexAudit) window.CortexAudit.log('You', `recorded ${full ? 'payment' : 'part-payment'} for ${invoice.id} (£${amt.toLocaleString()})`, 'Money');
    if (window.cortexxToast) window.cortexxToast(full ? `${invoice.id} marked paid` : `Part-payment recorded`, 'success');
    setBusy(false);
    onDone && onDone();
    setPaidPayment(payment);
  };

  const methodIcon = { transfer: Ic.swap, card: Ic.money, cash: Ic.money, cheque: Ic.doc };

  // Success state — confirm + offer an instant receipt
  if (paidPayment) {
    return (
      <Sheet onClose={onClose}>
        <div style={{ padding: '36px 24px 30px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: T.green, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(Ic.check, { size: 34, color: '#fff', sw: 3 })}</div>
          <div style={{ fontFamily: SF, fontSize: 21, fontWeight: 700, color: T.t1 }}>{paidPayment.full ? 'Payment recorded' : 'Part-payment recorded'}</div>
          <div style={{ fontFamily: SFMono, fontSize: 15, color: T.green, fontWeight: 700, marginTop: 4 }}>£{paidPayment.amount.toLocaleString()} · {paidPayment.client}</div>
          <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 6 }}>{paidPayment.invoiceId} {paidPayment.full ? 'marked paid' : 'partially settled'}</div>

          <button onClick={() => window.cortexxReceiptPDF && window.cortexxReceiptPDF(paidPayment)} style={{
            width: '100%', marginTop: 22, background: accent, color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
            fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>{React.cloneElement(Ic.download, { size: 16 })} Issue receipt (PDF)</button>
          <button onClick={onClose} style={{
            width: '100%', marginTop: 8, background: 'transparent', color: T.t2, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '13px',
            fontFamily: SF, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Done</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: '20px 20px 30px' }}>
        <div style={{ fontFamily: SF, fontSize: 20, fontWeight: 700, color: T.t1 }}>Record payment</div>
        <div style={{ fontFamily: SF, fontSize: 13, color: T.t2, marginTop: 4, marginBottom: 18 }}>{invoice.id} · {invoice.client} · invoiced £{invoice.amount.toLocaleString()}</div>

        <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Amount received</div>
        <div style={{ display: 'flex', alignItems: 'center', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 12, padding: '0 14px', marginBottom: 14 }}>
          <span style={{ fontFamily: SFMono, fontSize: 22, color: T.t2 }}>£</span>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
            style={{ flex: 1, background: 'transparent', border: 'none', padding: '14px 8px', color: T.t1, fontFamily: SFMono, fontSize: 22, fontWeight: 700, outline: 'none' }}/>
          {parseFloat(amount) < invoice.amount && parseFloat(amount) > 0 && <Pill c={T.amber} size="xs">PART</Pill>}
        </div>

        <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Method</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {PAY_METHODS.map(m => (
            <button key={m.k} onClick={() => setMethod(m.k)} style={{
              background: method === m.k ? `${accent}14` : T.bg2, border: `0.5px solid ${method === m.k ? accent : T.hair}`,
              borderRadius: 10, padding: '12px', cursor: 'pointer', fontFamily: SF, fontSize: 13, fontWeight: 600,
              color: method === m.k ? accent : T.t1, display: 'flex', alignItems: 'center', gap: 8,
            }}>{React.cloneElement(methodIcon[m.k], { size: 15 })} {m.l}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 10, padding: '12px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Reference</div>
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="optional"
              style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.hairMid}`, borderRadius: 10, padding: '12px', color: T.t1, fontFamily: SF, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
          </div>
        </div>

        <button onClick={confirm} disabled={!valid || busy} style={{
          width: '100%', background: valid ? accent : T.bg3, color: '#fff', border: 'none', borderRadius: 12, padding: '15px',
          fontFamily: SF, fontSize: 15, fontWeight: 700, cursor: valid ? 'pointer' : 'default', opacity: valid ? 1 : 0.5,
        }}>{busy ? 'Saving…' : 'Confirm payment'}</button>
      </div>
    </Sheet>
  );
}

function PaymentsLedgerScreen({ accent }) {
  const invoices = useDB('invoices');
  const [payInvoice, setPayInvoice] = React.useState(null);
  const payments = window.CortexPayments ? window.CortexPayments.list() : [];

  const invoiced = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
  const outstanding = invoices.filter(i => ['due', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.amount || 0), 0);
  const pct = invoiced ? Math.round((paid / invoiced) * 100) : 0;

  const STATUS_C = { paid: T.green, due: T.amber, overdue: T.red };
  const sorted = [...invoices].sort((a, b) => {
    const order = { overdue: 0, due: 1, paid: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });
  const methodLabel = (k) => (PAY_METHODS.find(m => m.k === k) || {}).l || k;

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 30 }}>
        <MobileHeader title="Payments" subtitle="Ledger · receipts · running balance" ws/>

        {/* Summary card */}
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{ background: T.bg2, borderRadius: 18, padding: 18, border: `0.5px solid ${T.hair}` }}>
            <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Collected this period</div>
            <div style={{ fontFamily: SFMono, fontSize: 32, fontWeight: 700, color: T.green, marginTop: 4, letterSpacing: -0.8 }}>£{paid.toLocaleString()}</div>
            <div style={{ marginTop: 12 }}><Bar pct={pct} c={T.green} h={6}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: SF, fontSize: 12 }}>
              <span style={{ color: T.t2 }}>{pct}% of £{invoiced.toLocaleString()} invoiced</span>
              <span style={{ color: T.amber, fontWeight: 600 }}>£{outstanding.toLocaleString()} outstanding</span>
            </div>
          </div>
        </div>

        {/* Invoices */}
        <Section title="Invoices">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px' }}>
            {sorted.map(iv => (
              <div key={iv.id} style={{
                background: T.bg2, borderRadius: 12, padding: '12px 14px', border: `0.5px solid ${T.hair}`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: STATUS_C[iv.status] || T.t3 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{iv.client}</div>
                  <div style={{ fontFamily: SFMono, fontSize: 11, color: T.t2, marginTop: 2 }}>{iv.id} · £{iv.amount.toLocaleString()}</div>
                </div>
                {iv.status === 'paid' ? (
                  <Pill c={T.green} size="xs">PAID</Pill>
                ) : (
                  <button onClick={() => setPayInvoice(iv)} style={{
                    background: accent, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 12px',
                    fontFamily: SF, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>Record payment</button>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Payment log */}
        <Section title={`Payment log${payments.length ? ` · ${payments.length}` : ''}`}>
          {payments.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontFamily: SF, fontSize: 13, color: T.t3 }}>
              No payments recorded yet. Record one above and it appears here.
            </div>
          ) : (
            <div style={{ background: T.bg2, borderRadius: 14, border: `0.5px solid ${T.hair}`, overflow: 'hidden', margin: '0 16px' }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i === payments.length - 1 ? 'none' : `0.5px solid ${T.hair}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.green}1a`, color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{React.cloneElement(Ic.check, { size: 15, sw: 3 })}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 13, fontWeight: 600, color: T.t1 }}>{p.client} {p.full ? '' : '(part)'}</div>
                    <div style={{ fontFamily: SFMono, fontSize: 10, color: T.t3, marginTop: 2 }}>{p.invoiceId} · {methodLabel(p.method)}{p.ref ? ` · ${p.ref}` : ''} · {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontFamily: SFMono, fontSize: 14, color: T.green, fontWeight: 700 }}>£{p.amount.toLocaleString()}</span>
                    <button onClick={() => window.cortexxReceiptPDF && window.cortexxReceiptPDF(p)} style={{
                      background: 'transparent', border: `0.5px solid ${T.hairMid}`, borderRadius: 7, padding: '3px 8px',
                      fontFamily: SF, fontSize: 10, fontWeight: 700, color: T.t2, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>{React.cloneElement(Ic.download, { size: 10 })} Receipt</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {payInvoice && <RecordPaymentSheet invoice={payInvoice} accent={accent} onClose={() => setPayInvoice(null)} onDone={() => {}}/>}
    </ScreenBg>
  );
}

Object.assign(window, { PaymentsLedgerScreen, RecordPaymentSheet });
