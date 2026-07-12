// CortexBuild Pro — Native push (Phase 103, v1.3)
// Web Push (VAPID) for the PWA + Capacitor wrapper for iOS/Android native.
//
// On web: real Web Push API with VAPID. Subscription persists; the service
// worker handles incoming push events and surfaces them with the existing
// notification queue.
//
// On iOS/Android (Capacitor): falls through to APNs/FCM when running inside
// the native wrapper (which we already build for the iOS app). The same
// client API works both ways.

(function () {
  if (window.CortexPush) return;

  // VAPID public key — set from server. Stored so prod and dev can differ.
  let VAPID_KEY = function () {
    try {
      return localStorage.getItem('cortexx_vapid_pub') || '';
    } catch (e) {
      return '';
    }
  }();
  let API_BASE = function () {
    try {
      return (localStorage.getItem('cortexx_llm_api_base') || '').replace(/\/+$/, '');
    } catch (e) {
      return '';
    }
  }();
  function urlBase64ToUint8(s) {
    const pad = '='.repeat((4 - s.length % 4) % 4);
    const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function isCapacitor() {
    return typeof window !== 'undefined' && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  async function isSupported() {
    if (isCapacitor()) return true;
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  async function getPermission() {
    if (isCapacitor()) {
      try {
        const PN = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
        if (!PN) return 'unsupported';
        const r = await PN.checkPermissions();
        return r && r.receive ? r.receive : 'default';
      } catch (e) {
        return 'error';
      }
    }
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }
  async function requestPermission() {
    if (isCapacitor()) {
      const PN = window.Capacitor.Plugins.PushNotifications;
      const r = await PN.requestPermissions();
      return r && r.receive;
    }
    if (!('Notification' in window)) return 'unsupported';
    return await Notification.requestPermission();
  }

  // Push subscription endpoint — server creates it and stores
  async function subscribe() {
    if (isCapacitor()) {
      // Native: ask the wrapper to register with APNs/FCM and post the token
      const PN = window.Capacitor.Plugins.PushNotifications;
      await PN.register();
      // Token arrives via the 'registration' event — the wrapper script
      // listens and forwards it to /api/push/subscribe.
      return {
        mode: 'native',
        pending: true
      };
    }
    if (!(await isSupported())) throw new Error('Push not supported in this browser');
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') throw new Error('Permission ' + p);
    }
    if (!VAPID_KEY) {
      // Try to fetch from server
      try {
        const r = await fetch(API_BASE + '/api/push/vapid', {
          method: 'GET'
        });
        if (r.ok) {
          const j = await r.json();
          VAPID_KEY = j.publicKey;
          try {
            localStorage.setItem('cortexx_vapid_pub', VAPID_KEY);
          } catch (e) {}
        }
      } catch (e) {}
    }
    if (!VAPID_KEY) throw new Error('VAPID public key missing — set on server');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8(VAPID_KEY)
    });
    // POST to server
    try {
      await fetch(API_BASE + '/api/push/subscribe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          subscription: sub.toJSON ? sub.toJSON() : sub,
          platform: 'web'
        }),
        credentials: 'include'
      });
    } catch (e) {/* server might be offline — the subscription still exists */}
    return {
      mode: 'web',
      subscribed: true
    };
  }
  async function unsubscribe() {
    if (isCapacitor()) {
      try {
        await window.Capacitor.Plugins.PushNotifications.removeAllListeners();
      } catch (e) {}
      return {
        unsubscribed: true
      };
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return {
      unsubscribed: true
    };
    try {
      await fetch(API_BASE + '/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: sub.endpoint
        }),
        credentials: 'include'
      });
    } catch (e) {}
    await sub.unsubscribe();
    return {
      unsubscribed: true
    };
  }
  async function status() {
    const supported = await isSupported();
    if (!supported) return {
      supported: false
    };
    if (isCapacitor()) {
      const perm = await getPermission();
      return {
        supported: true,
        mode: 'native',
        permission: perm
      };
    }
    let subscribed = false,
      endpoint = null;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
      endpoint = sub ? sub.endpoint : null;
    } catch (e) {}
    return {
      supported: true,
      mode: 'web',
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      subscribed,
      endpoint,
      vapidLoaded: !!VAPID_KEY
    };
  }
  function setApiBase(url) {
    API_BASE = String(url || '').replace(/\/+$/, '');
    try {
      localStorage.setItem('cortexx_llm_api_base', API_BASE);
    } catch (e) {}
  }
  function setVapidKey(k) {
    VAPID_KEY = k;
    try {
      localStorage.setItem('cortexx_vapid_pub', k);
    } catch (e) {}
  }
  window.CortexPush = {
    subscribe,
    unsubscribe,
    status,
    requestPermission,
    getPermission,
    setApiBase,
    setVapidKey,
    isCapacitor
  };
})();