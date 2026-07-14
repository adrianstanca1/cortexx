// CortexBuild Pro — Payment links (Phase 101)
// One-tap "Pay invoice" — generates a Stripe/GoCardless link or bank-transfer
// reference. The chosen URL/ref is persisted to the invoice so the same link
// is reused on every share.

(function () {
  if (!window.Backend || !window.Backend.payments) {
    var Backend = window.Backend;
    var API_BASE = function () {
      try {
        return (localStorage.getItem('cortexx_llm_api_base') || localStorage.getItem('cortexx_api_url') || '').replace(/\/+$/, '');
      } catch (e) {
        return '';
      }
    }();
    function authHeaders() {
      var h = {
        'content-type': 'application/json'
      };
      try {
        var t = localStorage.getItem('cortexx_token');
        if (t) h.authorization = 'Bearer ' + t;
      } catch (e) {}
      return h;
    }
    Backend.payments = {
      providers: async function () {
        try {
          var r = await fetch(API_BASE + '/api/payments/providers', {
            headers: authHeaders()
          });
          if (!r.ok) return null;
          return await r.json();
        } catch (e) {
          return null;
        }
      },
      createLink: async function (invoice, provider) {
        var amount = Number(invoice.amount) || 0;
        var body = {
          invoiceId: invoice.id,
          amount: amount,
          currency: 'GBP',
          description: invoice.client || '',
          provider: provider || 'stripe'
        };
        var r = await fetch(API_BASE + '/api/payments/link', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body)
        });
        if (!r.ok) {
          var t = await r.text();
          throw new Error('HTTP ' + r.status + ': ' + t.slice(0, 200));
        }
        return await r.json();
      }
    };
  }
})();
function PaymentLinkScreen({
  accent,
  invoiceId,
  onClose
}) {
  var invoices = useDB('invoices');
  var inv = (invoices || []).find(function (x) {
    return x.id === invoiceId;
  }) || (invoices || []).find(function (x) {
    return x.status !== 'paid';
  });
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
    return /*#__PURE__*/React.createElement(ScreenBg, {
      accent: accent
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 40,
        textAlign: 'center',
        color: T.t2,
        fontFamily: SF
      }
    }, "Invoice not found."));
  }
  var generate = async function (provider) {
    setBusy(provider);
    setErr(null);
    setResult(null);
    try {
      var out = await window.Backend.payments.createLink(inv, provider);
      // Persist link/ref on the invoice
      var patch = {
        payment_provider: out.provider,
        payment_link_url: out.url || null,
        payment_ref: out.ref || null
      };
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
    try {
      await navigator.clipboard.writeText(text);
      if (window.cortexxToast) window.cortexxToast((label || 'Link') + ' copied', 'success');
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('Copy failed', 'error');
    }
  };
  var Row = function (props) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid ' + T.hair,
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.t2
      }
    }, props.l), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        color: T.t1,
        fontFamily: props.mono ? SFMono : SF,
        fontSize: props.mono ? 12 : 13,
        textAlign: 'right',
        maxWidth: 200
      }
    }, props.v));
  };
  var ProviderBtn = function (props) {
    var p = props.p,
      opts = providers && providers[p] || {
        available: false
      };
    var disabled = !opts.available || busy === p;
    return /*#__PURE__*/React.createElement("button", {
      onClick: function () {
        generate(p);
      },
      disabled: disabled,
      style: {
        width: '100%',
        padding: 14,
        marginTop: 8,
        borderRadius: 12,
        border: '1px solid ' + T.hair,
        background: T.bg2,
        color: T.t1,
        fontFamily: SF,
        fontSize: 14,
        fontWeight: 600,
        textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 8,
        background: props.color + '20',
        color: props.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16
      }
    }, props.glyph), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", null, props.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: T.t2,
        fontWeight: 500,
        marginTop: 2
      }
    }, opts.available ? opts.mode ? opts.mode.toUpperCase() + ' · ready' : 'ready' : 'not configured — set secret in server/.env')), busy === p && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: T.t2
      }
    }, "\u2026"));
  };
  return /*#__PURE__*/React.createElement(ScreenBg, {
    accent: accent
  }, /*#__PURE__*/React.createElement(MobileHeader, {
    title: "Payment link",
    subtitle: inv.id + ' · £' + Number(inv.amount).toLocaleString() + ' · ' + (inv.client || '')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement(Row, {
    l: "Client",
    v: inv.client || '—'
  }), /*#__PURE__*/React.createElement(Row, {
    l: "Amount",
    v: '£' + Number(inv.amount).toLocaleString()
  }), /*#__PURE__*/React.createElement(Row, {
    l: "Status",
    v: (inv.status || '').toUpperCase(),
    mono: true
  }), /*#__PURE__*/React.createElement(Row, {
    l: "Due",
    v: inv.due || inv.issued || '—',
    mono: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "CREATE PAYMENT LINK"), providers === null && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      color: T.t2,
      fontSize: 13
    }
  }, "Loading providers\u2026"), providers === false && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      color: T.amber,
      fontSize: 13
    }
  }, "Backend not reachable \u2014 payment-link generation needs the server running."), providers && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ProviderBtn, {
    p: "stripe",
    label: "Stripe (card)",
    color: T.purple,
    glyph: "\uD83D\uDCB3"
  }), /*#__PURE__*/React.createElement(ProviderBtn, {
    p: "gocardless",
    label: "GoCardless (Direct Debit)",
    color: T.cyan,
    glyph: "\uD83D\uDD01"
  }), /*#__PURE__*/React.createElement(ProviderBtn, {
    p: "bank",
    label: "UK bank transfer",
    color: T.green,
    glyph: "\uD83C\uDFE6"
  })), result && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: 'rgba(34,197,94,.06)',
      border: '1px solid rgba(34,197,94,.25)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.green,
      marginBottom: 10
    }
  }, "\u2713 ", result.provider === 'bank' ? 'Bank details ready' : 'Payment link ready'), result.provider === 'bank' ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.7
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Account name: "), /*#__PURE__*/React.createElement("strong", null, result.accountName)), result.sortCode && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Sort code: "), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, result.sortCode)), result.accountNo && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Account no: "), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, result.accountNo)), result.iban && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "IBAN: "), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, result.iban)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Reference: "), /*#__PURE__*/React.createElement("strong", null, result.reference)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Amount: "), /*#__PURE__*/React.createElement("strong", null, "\xA3", result.amount)), /*#__PURE__*/React.createElement("button", {
    onClick: function () {
      copy([result.accountName, result.sortCode, result.accountNo, result.iban, 'Ref: ' + result.reference, 'Amount: £' + result.amount].filter(Boolean).join('\n'), 'Bank details');
    },
    style: {
      marginTop: 12,
      padding: '8px 14px',
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600
    }
  }, "Copy all details")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      borderRadius: 8,
      background: T.bg1,
      border: '1px solid ' + T.hair,
      fontFamily: SFMono,
      fontSize: 11,
      wordBreak: 'break-all',
      color: T.t1
    }
  }, result.url), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: function () {
      copy(result.url, 'Link');
    },
    style: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 8,
      border: 'none',
      background: accent,
      color: '#fff',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700
    }
  }, "Copy link"), /*#__PURE__*/React.createElement("a", {
    href: result.url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      textAlign: 'center',
      textDecoration: 'none'
    }
  }, "Open")))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: 'rgba(239,68,68,.06)',
      border: '1px solid rgba(239,68,68,.2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.red,
      marginBottom: 4
    }
  }, "Generation failed"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2,
      wordBreak: 'break-word'
    }
  }, err)), inv.payment_link_url && !result && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "EXISTING LINK (", (inv.payment_provider || 'stripe').toUpperCase(), ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      borderRadius: 8,
      background: T.bg1,
      border: '1px solid ' + T.hair,
      fontFamily: SFMono,
      fontSize: 11,
      wordBreak: 'break-all',
      color: T.t1
    }
  }, inv.payment_link_url), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: function () {
      copy(inv.payment_link_url, 'Link');
    },
    style: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg1,
      color: T.t1,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600
    }
  }, "Copy"), /*#__PURE__*/React.createElement("a", {
    href: inv.payment_link_url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 8,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      textAlign: 'center',
      textDecoration: 'none'
    }
  }, "Open"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "Provider keys live in ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "server/.env"), ": ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "STRIPE_SECRET_KEY"), ", ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "GOCARDLESS_ACCESS_TOKEN"), ", ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "BANK_SORT_CODE"), " / ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "BANK_ACCOUNT_NO"), ". No keys are ever stored client-side.")));
}
Object.assign(window, {
  PaymentLinkScreen
});