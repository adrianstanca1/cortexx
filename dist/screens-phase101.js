(function () {
  if (!window.Backend || !window.Backend.payments) {
    var Backend = window.Backend;
    var API_BASE = function () {
      try {
        return (localStorage.getItem('cortexx_llm_api_base') || '').replace(/\/+$/, '');
      } catch (e) {
        return '';
      }
    }();
    Backend.payments = {
      providers: async function () {
        try {
          var r = await fetch(API_BASE + '/api/payments/providers');
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
          headers: {
            'content-type': 'application/json'
          },
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
  var [providers, setProviders] = React.useState(null);
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
    return React.createElement(ScreenBg, {
      accent: accent
    }, React.createElement("div", {
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
    return React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid ' + T.hair,
        fontSize: 13
      }
    }, React.createElement("span", {
      style: {
        color: T.t2
      }
    }, props.l), React.createElement("span", {
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
    return React.createElement("button", {
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
    }, React.createElement("span", {
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
    }, props.glyph), React.createElement("span", {
      style: {
        flex: 1
      }
    }, React.createElement("div", null, props.label), React.createElement("div", {
      style: {
        fontSize: 11,
        color: T.t2,
        fontWeight: 500,
        marginTop: 2
      }
    }, opts.available ? opts.mode ? opts.mode.toUpperCase() + ' · ready' : 'ready' : 'not configured — set secret in server/.env')), busy === p && React.createElement("span", {
      style: {
        fontSize: 11,
        color: T.t2
      }
    }, "\u2026"));
  };
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "Payment link",
    subtitle: inv.id + ' · £' + Number(inv.amount).toLocaleString() + ' · ' + (inv.client || '')
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement(Row, {
    l: "Client",
    v: inv.client || '—'
  }), React.createElement(Row, {
    l: "Amount",
    v: '£' + Number(inv.amount).toLocaleString()
  }), React.createElement(Row, {
    l: "Status",
    v: (inv.status || '').toUpperCase(),
    mono: true
  }), React.createElement(Row, {
    l: "Due",
    v: inv.due || inv.issued || '—',
    mono: true
  })), React.createElement("div", {
    style: {
      marginTop: 18,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "CREATE PAYMENT LINK"), providers === null && React.createElement("div", {
    style: {
      padding: 14,
      color: T.t2,
      fontSize: 13
    }
  }, "Loading providers\u2026"), providers === false && React.createElement("div", {
    style: {
      padding: 14,
      color: T.amber,
      fontSize: 13
    }
  }, "Backend not reachable \u2014 payment-link generation needs the server running."), providers && React.createElement(React.Fragment, null, React.createElement(ProviderBtn, {
    p: "stripe",
    label: "Stripe (card)",
    color: T.purple,
    glyph: "\uD83D\uDCB3"
  }), React.createElement(ProviderBtn, {
    p: "gocardless",
    label: "GoCardless (Direct Debit)",
    color: T.cyan,
    glyph: "\uD83D\uDD01"
  }), React.createElement(ProviderBtn, {
    p: "bank",
    label: "UK bank transfer",
    color: T.green,
    glyph: "\uD83C\uDFE6"
  })), result && React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: 'rgba(34,197,94,.06)',
      border: '1px solid rgba(34,197,94,.25)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.green,
      marginBottom: 10
    }
  }, "\u2713 ", result.provider === 'bank' ? 'Bank details ready' : 'Payment link ready'), result.provider === 'bank' ? React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.7
    }
  }, React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Account name: "), React.createElement("strong", null, result.accountName)), result.sortCode && React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Sort code: "), React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, result.sortCode)), result.accountNo && React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Account no: "), React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, result.accountNo)), result.iban && React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "IBAN: "), React.createElement("span", {
    style: {
      fontFamily: SFMono
    }
  }, result.iban)), React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Reference: "), React.createElement("strong", null, result.reference)), React.createElement("div", null, React.createElement("span", {
    style: {
      color: T.t2
    }
  }, "Amount: "), React.createElement("strong", null, "\xA3", result.amount)), React.createElement("button", {
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
  }, "Copy all details")) : React.createElement(React.Fragment, null, React.createElement("div", {
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
  }, result.url), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, React.createElement("button", {
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
  }, "Copy link"), React.createElement("a", {
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
  }, "Open")))), err && React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: 'rgba(239,68,68,.06)',
      border: '1px solid rgba(239,68,68,.2)'
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: T.red,
      marginBottom: 4
    }
  }, "Generation failed"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.t2,
      wordBreak: 'break-word'
    }
  }, err)), inv.payment_link_url && !result && React.createElement("div", {
    style: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      background: T.bg2,
      border: '1px solid ' + T.hair
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 8
    }
  }, "EXISTING LINK (", (inv.payment_provider || 'stripe').toUpperCase(), ")"), React.createElement("div", {
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
  }, inv.payment_link_url), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, React.createElement("button", {
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
  }, "Copy"), React.createElement("a", {
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
  }, "Open"))), React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, "Provider keys live in ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "server/.env"), ": ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "STRIPE_SECRET_KEY"), ", ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "GOCARDLESS_ACCESS_TOKEN"), ", ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "BANK_SORT_CODE"), " / ", React.createElement("code", {
    style: {
      fontFamily: SFMono
    }
  }, "BANK_ACCOUNT_NO"), ". No keys are ever stored client-side.")));
}
Object.assign(window, {
  PaymentLinkScreen
});