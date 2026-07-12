// CortexBuild — real-time multiplayer presence (v1.8)
// ─────────────────────────────────────────────────────────────────
// Genuine real-time presence with zero backend required: peers on the
// same origin (other tabs / windows / PWA instances) discover each other
// over a BroadcastChannel, heartbeat every few seconds, and are pruned
// when they go quiet. Each peer advertises WHO they are and WHAT they're
// looking at (current screen + optional focus target, e.g. a project id),
// so the site board can show "who's viewing this site right now" live.
//
// Cross-device presence (different machines) rides the same API: when the
// server SSE bus is reachable, presence frames are relayed through it —
// see attachTransport(). Same-origin tabs work with no server at all.
// ─────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  if (window.CortexPresence) return;
  var CHANNEL = 'cortexx-presence-v1';
  var HEARTBEAT_MS = 3000; // how often we announce ourselves
  var STALE_MS = 9000; // peer considered gone if silent this long
  var SWEEP_MS = 2000; // how often we prune stale peers

  // ── Stable identity for THIS session ──────────────────────────
  var COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899', '#14b8a6'];
  function peerId() {
    var k = 'cortexx_peer_id';
    var v = sessionStorage.getItem(k); // per-tab, so two tabs = two peers
    if (!v) {
      v = 'p_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(k, v);
    }
    return v;
  }
  function myIdentity() {
    var name = 'You',
      avatar = null;
    try {
      var u = window.Backend && Backend.db && Backend.db.user && Backend.db.user.getSync ? Backend.db.user.getSync() : null;
      if (u) {
        name = u.name || u.email || 'You';
        avatar = u.avatar || null;
      }
      var sess = JSON.parse(localStorage.getItem('cortexx_session') || 'null');
      if (sess && sess.email && (!u || !u.name)) name = sess.email.split('@')[0];
    } catch (e) {}
    var id = peerId();
    var color = COLORS[Math.abs(hash(id)) % COLORS.length];
    return {
      id: id,
      name: name,
      avatar: avatar,
      color: color
    };
  }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  // ── State ─────────────────────────────────────────────────────
  var me = myIdentity();
  var state = {
    screen: 'overview',
    focus: null
  }; // what I'm viewing
  var peers = {}; // id → { identity, screen, focus, at }
  var subs = new Set();
  var bc = null,
    transport = null;
  try {
    bc = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  } catch (e) {
    bc = null;
  }
  function now() {
    return Date.now();
  }
  function notify() {
    subs.forEach(function (fn) {
      try {
        fn();
      } catch (e) {}
    });
  }
  function frame(type) {
    return {
      type: type,
      id: me.id,
      identity: me,
      screen: state.screen,
      focus: state.focus,
      at: now()
    };
  }
  function send(type) {
    var f = frame(type);
    try {
      if (bc) bc.postMessage(f);
    } catch (e) {}
    try {
      if (transport && transport.send) transport.send(f);
    } catch (e) {}
  }
  function ingest(f) {
    if (!f || !f.id || f.id === me.id) return;
    if (f.type === 'leave') {
      if (peers[f.id]) {
        delete peers[f.id];
        notify();
      }
      return;
    }
    var existing = peers[f.id];
    peers[f.id] = {
      identity: f.identity || existing && existing.identity || {
        id: f.id,
        name: 'Someone',
        color: '#888'
      },
      screen: f.screen,
      focus: f.focus,
      at: f.at || now()
    };
    // A newly-seen peer should learn about us promptly.
    if (!existing) send('hello');
    notify();
  }
  if (bc) bc.onmessage = function (e) {
    ingest(e.data);
  };

  // ── Heartbeat + stale sweep ───────────────────────────────────
  var hb = setInterval(function () {
    send('beat');
  }, HEARTBEAT_MS);
  var sweep = setInterval(function () {
    var t = now(),
      changed = false;
    for (var id in peers) {
      if (t - peers[id].at > STALE_MS) {
        delete peers[id];
        changed = true;
      }
    }
    if (changed) notify();
  }, SWEEP_MS);

  // Announce arrival + departure
  send('hello');
  window.addEventListener('beforeunload', function () {
    send('leave');
  });
  document.addEventListener('visibilitychange', function () {
    // Mark away/back by toggling a flag in screen meta; still counts as present.
    send('beat');
  });

  // ── Public API ────────────────────────────────────────────────
  window.CortexPresence = {
    me: function () {
      return me;
    },
    // Update what I'm looking at; broadcasts immediately.
    setView: function (screen, focus) {
      if (screen !== undefined) state.screen = screen;
      state.focus = focus === undefined ? null : focus;
      send('beat');
    },
    // All peers (excluding me), freshest first.
    peers: function () {
      return Object.keys(peers).map(function (id) {
        return peers[id];
      }).sort(function (a, b) {
        return b.at - a.at;
      });
    },
    // Peers currently on a given screen (optionally focused on a target).
    viewing: function (screen, focus) {
      return this.peers().filter(function (p) {
        if (screen && p.screen !== screen) return false;
        if (focus !== undefined && focus !== null && String(p.focus) !== String(focus)) return false;
        return true;
      });
    },
    count: function () {
      return Object.keys(peers).length;
    },
    subscribe: function (fn) {
      subs.add(fn);
      return function () {
        subs.delete(fn);
      };
    },
    // Optional cross-device relay (server SSE). transport = { send(frame), onFrame(cb) }.
    attachTransport: function (t) {
      transport = t;
      if (t && t.onFrame) t.onFrame(ingest);
      send('hello');
    },
    _stop: function () {
      clearInterval(hb);
      clearInterval(sweep);
      send('leave');
    }
  };

  // React hook: live presence for a screen/focus, re-renders on change.
  window.usePresence = function (screen, focus) {
    var R = window.React;
    var ref = R.useReducer(function (x) {
      return x + 1;
    }, 0);
    var force = ref[1];
    R.useEffect(function () {
      var off = window.CortexPresence.subscribe(force);
      if (screen !== undefined) window.CortexPresence.setView(screen, focus);
      return off;
    }, [screen, focus]);
    return {
      me: window.CortexPresence.me(),
      peers: window.CortexPresence.peers(),
      here: window.CortexPresence.viewing(screen, focus)
    };
  };
})();