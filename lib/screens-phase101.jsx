// CortexBuild Pro — Payment links (Phase 101)
// One-tap "Pay invoice" — generates a Stripe/GoCardless link or bank-transfer
// reference. The chosen URL/ref is persisted to the invoice so the same link
// is reused on every share.

(function () {
  if (!window.Backend || !window.Backend.payments) {
    var Backend = window.Backend;
    var API_BASE = (function () { try { return (localStorage.getItem('cortexx_llm_api_base') || '').replace(/\/+$/, ''); } catch (e) { return ''; } })();

    Backend.payments = {
      providers: async function () {
        try {
          var r = await fetch(API_BASE + '/api/payments/providers');
          if (!r.ok) return null;
          return await r.json();
        } catch (e) { return null; }
      },
      createLink: async function (invoice, provider) {
        var amount = Number(invoice.amount) || 0;
        var body = {
          invoiceId: invoice.id, amount: amount, currency: 'GBP',
          description: invoice.client || '', provider: provider || 'stripe',
        };
        var r = await fetch(API_BASE + '/api/payments/link', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) { var t = await r.text(); throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200)); }
        return await r.json();
      },
    };
  }
})();

function PaymentLinkScreen({ accent, invoiceId, onClose }) {
  var invoices = useDB('invoices');
  var inv = (invoices || []).find(function (x) { return x.id === invoiceId; }) || (invoices || []).find(function (x) { return x.status !== 'paid'; });
  var [providers, setProviders] = React.useState(null); // null=loading, {}=loaded, false=offline
  var [busy, setBusy] = React.useState(null);
  var [result, setResult] = React.useState(null);
  var [err, setErr] = React.useState(null);

  React.useEffect(function () {
    (async function () {
      var p = await window.Backend.payments.providers();
      setProviders(p || false);
    })();
  }, []);

  if (!inv) {
    return <ScreenBg accent={accent}><div style={{ padding: 40, textAlign: 'center', color: T.t2, fontFamily: SF }}>Invoice not found.</div></ScreenBg>;
  }

  var generate = async function (provider) {
    setBusy(provider); setErr(null); setResult(null);
    try {
      var out = await window.Backend.payments.createLink(inv, provider);
      // Persist link/ref on the invoice
      var patch = { payment_provider: out.provider, payment_link_url: out.url || null, payment_ref: out.ref || null };
      await window.Backend.db.invoices.update(inv.id, patch);
      setResult(out);
      if (window.cortexxToast) window.cortexxToast(provider === 'bank' ? 'Bank details ready' : 'Payment link created', 'success');
    } catch (e) {
      setErr(e.message || 'Failed to generate');
      if (window.cortexxToast) window.cortexxToast('Failed: ' + (e.message || ''), 'error');
    }
    setBusy(null);
  };

  var copy = async function (text, label) {
    try { await navigator.clipboard.writeText(text); if (window.cortexxToast) window.cortexxToast((label || 'Link') + ' copied', 'success'); }
    catch (e) { if (window.cortexxToast) window.cortexxToast('Copy failed', 'error'); }
  };

  var Row = function (props) {
    return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + T.hair, fontSize: 13 }}>
      <span style={{ color: T.t2 }}>{props.l}</span>
      <span style={{ fontWeight: 600, color: T.t1, fontFamily: props.mono ? SFMono : SF, fontSize: props.mono ? 12 : 13, textAlign: 'right', maxWidth: 200 }}>{props.v}</span>
    </div>;
  };

  var ProviderBtn = function (props) {
    var p = props.p, opts = providers && providers[p] || { available: false };
    var disabled = !opts.available || busy === p;
    return <button onClick={function () { generate(p); }} disabled={disabled}
      style={{ width: '100%', padding: 14, marginTop: 8, borderRadius: 12, border: '1px solid ' + T.hair, background: T.bg2, color: T.t1, fontFamily: SF, fontSize: 14, fontWeight: 600, textAlign: 'left', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 36, height: 36, borderRadius: 8, background: props.color + '20', color: props.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{props.glyph}</span>
      <span style={{ flex: 1 }}>
        <div>{props.label}</div>
        <div style={{ fontSize: 11, color: T.t2, fontWeight: 500, marginTop: 2 }}>
          {opts.available ? (opts.mode ? opts.mode.toUpperCase() + ' · ready' : 'ready') : 'not configured — set secret in server/.env'}
        </div>
      </span>
      {busy === p && <span style={{ fontSize: 11, color: T.t2 }}>…</span>}
    </button>;
  };

  return (
    <ScreenBg accent={accent}>
      <MobileHeader title="Payment link" subtitle={inv.id + ' · £' + Number(inv.amount).toLocaleString() + ' · ' + (inv.client || '')}/>
      <div style={{ padding: '0 18px 110px', fontFamily: SF }}>
        {/* Invoice summary */}
        <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
          <Row l="Client" v={inv.client || '—'} />
          <Row l="Amount" v={'£' + Number(inv.amount).toLocaleString()} />
          <Row l="Status" v={(inv.status || '').toUpperCase()} mono />
          <Row l="Due"    v={inv.due || inv.issued || '—'} mono />
        </div>

        {/* Choose provider */}
        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6 }}>CREATE PAYMENT LINK</div>
        {providers === null && <div style={{ padding: 14, color: T.t2, fontSize: 13 }}>Loading providers…</div>}
        {providers === false && <div style={{ padding: 14, color: T.amber, fontSize: 13 }}>Backend not reachable — payment-link generation needs the server running.</div>}
        {providers && <>
          <ProviderBtn p="stripe"     label="Stripe (card)"        color={T.purple} glyph="💳"/>
          <ProviderBtn p="gocardless" label="GoCardless (Direct Debit)" color={T.cyan}   glyph="🔁"/>
          <ProviderBtn p="bank"       label="UK bank transfer"     color={T.green}  glyph="🏦"/>
        </>}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.25)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 10 }}>✓ {result.provider === 'bank' ? 'Bank details ready' : 'Payment link ready'}</div>
            {result.provider === 'bank' ? (
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                <div><span style={{ color: T.t2 }}>Account name: </span><strong>{result.accountName}</strong></div>
                {result.sortCode && <div><span style={{ color: T.t2 }}>Sort code: </span><span style={{ fontFamily: SFMono }}>{result.sortCode}</span></div>}
                {result.accountNo && <div><span style={{ color: T.t2 }}>Account no: </span><span style={{ fontFamily: SFMono }}>{result.accountNo}</span></div>}
                {result.iban && <div><span style={{ color: T.t2 }}>IBAN: </span><span style={{ fontFamily: SFMono }}>{result.iban}</span></div>}
                <div><span style={{ color: T.t2 }}>Reference: </span><strong>{result.reference}</strong></div>
                <div><span style={{ color: T.t2 }}>Amount: </span><strong>£{result.amount}</strong></div>
                <button onClick={function () { copy([result.accountName, result.sortCode, result.accountNo, result.iban, 'Ref: ' + result.reference, 'Amount: £' + result.amount].filter(Boolean).join('\n'), 'Bank details'); }}
                  style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SF, fontSize: 12, fontWeight: 600 }}>Copy all details</button>
              </div>
            ) : (
              <>
                <div style={{ padding: 10, borderRadius: 8, background: T.bg1, border: '1px solid ' + T.hair, fontFamily: SFMono, fontSize: 11, wordBreak: 'break-all', color: T.t1 }}>{result.url}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={function () { copy(result.url, 'Link'); }}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700 }}>Copy link</button>
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg2, color: T.t1, fontFamily: SF, fontSize: 13, fontWeight: 700, textAlign: 'center', textDecoration: 'none' }}>Open</a>
                </div>
              </>
            )}
          </div>
        )}

        {err && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 4 }}>Generation failed</div>
            <div style={{ fontSize: 12, color: T.t2, wordBreak: 'break-word' }}>{err}</div>
          </div>
        )}

        {/* Existing link on invoice */}
        {inv.payment_link_url && !result && (
          <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: T.bg2, border: '1px solid ' + T.hair }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.t2, letterSpacing: 0.6, marginBottom: 8 }}>EXISTING LINK ({(inv.payment_provider || 'stripe').toUpperCase()})</div>
            <div style={{ padding: 10, borderRadius: 8, background: T.bg1, border: '1px solid ' + T.hair, fontFamily: SFMono, fontSize: 11, wordBreak: 'break-all', color: T.t1 }}>{inv.payment_link_url}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={function () { copy(inv.payment_link_url, 'Link'); }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg1, color: T.t1, fontFamily: SF, fontSize: 12, fontWeight: 600 }}>Copy</button>
              <a href={inv.payment_link_url} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid ' + T.hair, background: T.bg2, color: T.t1, fontFamily: SF, fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>Open</a>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, fontSize: 11, color: T.t2, lineHeight: 1.5 }}>
          Provider keys live in <code style={{ fontFamily: SFMono }}>server/.env</code>: <code style={{ fontFamily: SFMono }}>STRIPE_SECRET_KEY</code>, <code style={{ fontFamily: SFMono }}>GOCARDLESS_ACCESS_TOKEN</code>, <code style={{ fontFamily: SFMono }}>BANK_SORT_CODE</code> / <code style={{ fontFamily: SFMono }}>BANK_ACCOUNT_NO</code>. No keys are ever stored client-side.
        </div>
      </div>
    </ScreenBg>
  );
}

Object.assign(window, { PaymentLinkScreen });
