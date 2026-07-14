// CortexBuild Pro — In-app subscriptions (v1.3)
//
// Two-track design:
//   • INSIDE the Capacitor iOS/Android wrapper → StoreKit / Google Play Billing
//     via cordova-plugin-purchase (already in package.json for Capacitor).
//     Receipt is sent to /api/iap/verify for SERVER-SIDE validation against
//     Apple. Client-side status is NEVER trusted for entitlement.
//   • IN THE BROWSER → no native IAP. Falls back to Stripe Checkout (the
//     payment_links plumbing we already built), with `mode: 'subscription'`.
//
// Public API (identical for both tracks):
//   CortexIAP.plans()                → list of products
//   CortexIAP.subscribe(productId)   → opens purchase flow
//   CortexIAP.restore()              → restore purchases (iOS requirement)
//   CortexIAP.status()               → { entitled, plan, expires, source }
//   CortexIAP.cancel()               → opens platform subscription manager

(function () {
  if (window.CortexIAP) return;

  // Pricing — store identifiers must match App Store Connect / Stripe products.
  const PLANS = [{
    id: 'cbp_pro_monthly',
    name: 'Pro · monthly',
    price: 24,
    period: 'month',
    currency: 'GBP',
    apple: 'cbp.pro.monthly',
    stripe: 'price_pro_monthly'
  }, {
    id: 'cbp_pro_yearly',
    name: 'Pro · yearly',
    price: 220,
    period: 'year',
    currency: 'GBP',
    apple: 'cbp.pro.yearly',
    stripe: 'price_pro_yearly',
    savePct: 24
  }, {
    id: 'cbp_team_monthly',
    name: 'Team · monthly',
    price: 80,
    period: 'month',
    currency: 'GBP',
    apple: 'cbp.team.monthly',
    stripe: 'price_team_monthly'
  }];
  function isCapacitor() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  function getStore() {
    // cordova-plugin-purchase exposes `CdvPurchase` on window
    return window.CdvPurchase && window.CdvPurchase.store;
  }
  let cachedStatus = null;
  let API_BASE = function () {
    try {
      return (localStorage.getItem('cortexx_llm_api_base') || localStorage.getItem('cortexx_api_url') || '').replace(/\/+$/, '');
    } catch (e) {
      return '';
    }
  }();
  function authHeaders(extra) {
    const h = Object.assign({
      'content-type': 'application/json'
    }, extra || {});
    try {
      const t = localStorage.getItem('cortexx_token');
      if (t) h.authorization = 'Bearer ' + t;
    } catch (e) {}
    return h;
  }
  const ENTITLEMENT_KEY = 'cortexx_iap_status';
  function loadStatus() {
    try {
      const raw = localStorage.getItem(ENTITLEMENT_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // Honour server-stamped expiry — never trust raw client-side entitlement
      if (s.expires && new Date(s.expires) < new Date()) return null;
      return s;
    } catch (e) {
      return null;
    }
  }
  function saveStatus(s) {
    try {
      localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(s));
    } catch (e) {}
    cachedStatus = s;
  }
  async function verifyServer(payload) {
    try {
      const r = await fetch(API_BASE + '/api/iap/verify', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  // ── Native (Capacitor) subscribe via cordova-plugin-purchase ────────
  async function subscribeNative(productId) {
    const store = getStore();
    if (!store) throw new Error('cordova-plugin-purchase not loaded');
    const plan = PLANS.find(p => p.id === productId);
    if (!plan) throw new Error('Unknown plan: ' + productId);
    const product = store.get(plan.apple);
    if (!product) throw new Error('Product not registered: ' + plan.apple);
    return new Promise((resolve, reject) => {
      const offer = product.getOffer ? product.getOffer() : product.offers && product.offers[0];
      if (!offer) return reject(new Error('No offer for ' + plan.apple));
      store.when(plan.apple).approved(async tx => {
        const verified = await verifyServer({
          platform: 'ios',
          productId: plan.apple,
          receipt: tx.transactionReceipt || tx.appStoreReceipt || ''
        });
        if (verified && verified.entitled) {
          saveStatus(verified);
          tx.finish();
          resolve(verified);
        } else {
          reject(new Error('Receipt validation failed'));
        }
      }).cancelled(() => reject(new Error('Purchase cancelled')));
      store.order(offer);
    });
  }

  // ── Web (Stripe Checkout) ──────────────────────────────────────────
  async function subscribeWeb(productId) {
    const plan = PLANS.find(p => p.id === productId);
    if (!plan) throw new Error('Unknown plan: ' + productId);
    const r = await fetch(API_BASE + '/api/iap/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: JSON.stringify({
        priceId: plan.stripe,
        productId
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error('Checkout failed: ' + r.status + ' ' + t.slice(0, 120));
    }
    const j = await r.json();
    if (!j.url) throw new Error('No checkout URL');
    window.location.assign(j.url);
  }
  async function subscribe(productId) {
    if (isCapacitor()) return subscribeNative(productId);
    return subscribeWeb(productId);
  }
  async function restore() {
    if (isCapacitor()) {
      const store = getStore();
      if (store && store.restorePurchases) await store.restorePurchases();
      return cachedStatus;
    }
    // Web: re-fetch entitlement from server
    try {
      const r = await fetch(API_BASE + '/api/iap/entitlement', {
        credentials: 'include',
        headers: authHeaders()
      });
      if (r.ok) {
        const s = await r.json();
        saveStatus(s);
        return s;
      }
    } catch (e) {}
    return cachedStatus;
  }
  function status() {
    if (cachedStatus) return cachedStatus;
    cachedStatus = loadStatus();
    return cachedStatus || {
      entitled: false,
      plan: null,
      expires: null,
      source: 'none'
    };
  }
  function cancel() {
    if (isCapacitor()) {
      // Apple: deep-link to subscriptions
      window.open('itms-apps://apps.apple.com/account/subscriptions', '_system');
    } else {
      // Stripe billing portal
      fetch(API_BASE + '/api/iap/portal', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders()
      }).then(r => r.json()).then(j => {
        if (j.url) window.location.assign(j.url);
      }).catch(() => {});
    }
  }

  // Initialise cordova-plugin-purchase on native
  if (isCapacitor()) {
    const init = () => {
      const store = getStore();
      if (!store) return setTimeout(init, 500);
      try {
        PLANS.forEach(p => store.register({
          id: p.apple,
          type: store.PAID_SUBSCRIPTION,
          platform: store.APPLE_APPSTORE
        }));
        store.ready(() => {
          // On launch, ask Apple for current entitlement
          PLANS.forEach(p => {
            const prod = store.get(p.apple);
            if (prod && prod.owned) {
              verifyServer({
                platform: 'ios',
                productId: p.apple,
                receipt: prod.transaction && prod.transaction.appStoreReceipt
              }).then(v => {
                if (v && v.entitled) saveStatus(v);
              });
            }
          });
        });
        store.initialize();
      } catch (e) {}
    };
    if (document.readyState === 'complete') init();else window.addEventListener('load', init);
  }
  window.CortexIAP = {
    plans: () => PLANS.slice(),
    subscribe,
    restore,
    status,
    cancel,
    isNative: isCapacitor
  };
})();