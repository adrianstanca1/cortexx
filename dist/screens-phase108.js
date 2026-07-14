function SubscriptionScreen({
  accent,
  onClose
}) {
  const IAP = window.CortexIAP;
  if (!IAP) return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: T.t2
    }
  }, "IAP not loaded."));
  const [plans] = React.useState(IAP.plans());
  const [stat, setStat] = React.useState(IAP.status());
  const [busy, setBusy] = React.useState(null);
  React.useEffect(() => {
    const qs = new URLSearchParams(location.search);
    if (qs.get('iap') === 'success') {
      if (window.cortexxToast) window.cortexxToast('Welcome to Pro 🎉', 'success');
    }
    IAP.restore().then(s => {
      if (s) setStat(s);
    });
  }, []);
  const buy = async productId => {
    setBusy(productId);
    try {
      await IAP.subscribe(productId);
      const s = IAP.status();
      setStat(s);
    } catch (e) {
      if (window.cortexxToast) window.cortexxToast('Purchase failed: ' + e.message, 'error');
    }
    setBusy(null);
  };
  const restore = async () => {
    setBusy('restore');
    const s = await IAP.restore();
    if (s && s.entitled) {
      setStat(s);
      if (window.cortexxToast) window.cortexxToast('Restored: ' + s.plan, 'success');
    } else {
      if (window.cortexxToast) window.cortexxToast('No purchases to restore', 'info');
    }
    setBusy(null);
  };
  const fmt = n => '£' + Number(n).toLocaleString();
  const native = IAP.isNative();
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement(MobileHeader, {
    title: "Subscription",
    subtitle: native ? 'In-app purchase · StoreKit' : 'Stripe Checkout · web'
  }), React.createElement("div", {
    style: {
      padding: '0 18px 110px',
      fontFamily: SF
    }
  }, React.createElement("div", {
    style: {
      marginTop: 14,
      padding: 16,
      borderRadius: 14,
      background: stat.entitled ? 'linear-gradient(135deg, ' + T.green + '25, ' + T.bg2 + ')' : T.bg2,
      border: '1px solid ' + (stat.entitled ? T.green + '60' : T.hair)
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6,
      marginBottom: 6
    }
  }, "CURRENT PLAN"), React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: T.t1
    }
  }, stat.entitled ? plans.find(p => p.id === stat.plan)?.name || stat.plan : 'Free'), stat.entitled && stat.expires && React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 12,
      color: T.t2
    }
  }, "Renews ", React.createElement("span", {
    style: {
      fontFamily: SFMono,
      color: T.t1
    }
  }, new Date(stat.expires).toLocaleDateString()), stat.source && React.createElement("span", null, " \xB7 via ", stat.source)), !stat.entitled && React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 12,
      color: T.t2
    }
  }, "5 projects \xB7 3 team members \xB7 CSV export only \xB7 no Open Banking, no Vera CEO")), React.createElement("div", {
    style: {
      marginTop: 22,
      fontSize: 11,
      fontWeight: 700,
      color: T.t2,
      letterSpacing: 0.6
    }
  }, "CHOOSE A PLAN"), plans.map(p => {
    const isCurrent = stat.entitled && stat.plan === p.id;
    return React.createElement("div", {
      key: p.id,
      style: {
        marginTop: 8,
        padding: 14,
        borderRadius: 12,
        background: isCurrent ? T.green + '15' : T.bg2,
        border: '1px solid ' + (isCurrent ? T.green : T.hair)
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
        fontSize: 14,
        fontWeight: 700,
        color: T.t1
      }
    }, p.name), React.createElement("div", {
      style: {
        fontSize: 11,
        color: T.t2,
        marginTop: 2
      }
    }, fmt(p.price), " / ", p.period, p.savePct && React.createElement("span", {
      style: {
        marginLeft: 6,
        color: T.green,
        fontWeight: 700
      }
    }, "save ", p.savePct, "%"))), isCurrent ? React.createElement("span", {
      style: {
        padding: '4px 10px',
        borderRadius: 6,
        background: T.green,
        color: '#fff',
        fontSize: 10,
        fontFamily: SFMono,
        fontWeight: 700,
        letterSpacing: 0.4
      }
    }, "CURRENT") : React.createElement("button", {
      onClick: () => buy(p.id),
      disabled: busy === p.id,
      style: {
        padding: '8px 14px',
        borderRadius: 8,
        border: 'none',
        background: accent,
        color: '#fff',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700,
        opacity: busy === p.id ? 0.6 : 1
      }
    }, busy === p.id ? '…' : native ? 'Subscribe' : 'Checkout')), p.id.includes('team') && React.createElement("div", {
      style: {
        fontSize: 11,
        color: T.t2,
        marginTop: 4
      }
    }, "Unlimited projects \xB7 25 users \xB7 Vera CEO \xB7 Open Banking \xB7 CIS300"), !p.id.includes('team') && React.createElement("div", {
      style: {
        fontSize: 11,
        color: T.t2,
        marginTop: 4
      }
    }, "Unlimited projects \xB7 5 users \xB7 Vera CEO \xB7 Stripe payment links"));
  }), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18
    }
  }, React.createElement("button", {
    onClick: restore,
    disabled: busy === 'restore',
    style: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600
    }
  }, busy === 'restore' ? 'Restoring…' : 'Restore purchases'), stat.entitled && React.createElement("button", {
    onClick: () => IAP.cancel(),
    style: {
      flex: 1,
      padding: 12,
      borderRadius: 10,
      border: '1px solid ' + T.hair,
      background: T.bg2,
      color: T.red,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600
    }
  }, "Manage / cancel")), React.createElement("div", {
    style: {
      marginTop: 16,
      padding: 12,
      fontSize: 11,
      color: T.t2,
      lineHeight: 1.5
    }
  }, native ? 'Purchases handled by Apple. Your subscription auto-renews until cancelled in Settings → Apple ID → Subscriptions.' : 'Payments via Stripe. Manage or cancel anytime through the Stripe billing portal.', "Receipts are validated server-side \u2014 entitlement is never trusted from the client alone.")));
}
Object.assign(window, {
  SubscriptionScreen
});