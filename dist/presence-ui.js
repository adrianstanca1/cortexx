// CortexBuild — real-time presence UI (v1.8)
// Live "who's here right now" avatar stack + per-person activity, driven by
// window.usePresence (lib/presence.js). Drops into any screen.

// ── Live avatar stack: shows peers currently viewing the same screen/focus ──
function PresenceBar({
  screen,
  focus,
  accent = window.T && T.blue || '#2563eb',
  label = 'viewing now'
}) {
  const R = window.React;
  if (!window.usePresence) return null;
  const {
    me,
    here
  } = window.usePresence(screen, focus);
  // Everyone present on this view, me first.
  const people = [{
    identity: me,
    _me: true,
    at: Date.now()
  }].concat(here);
  const shown = people.slice(0, 5);
  const extra = Math.max(0, people.length - shown.length);
  return R.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      marginBottom: 14,
      background: T && T.bg2 || '#11192a',
      border: `0.5px solid ${T && T.hair || '#1e2a3e'}`,
      borderRadius: 12
    }
  },
  // pulsing live dot
  R.createElement('span', {
    style: {
      position: 'relative',
      width: 8,
      height: 8,
      flexShrink: 0
    }
  }, R.createElement('span', {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 8,
      background: T && T.green || '#10b981'
    }
  }), R.createElement('span', {
    className: 'cx-presence-pulse',
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 8,
      background: T && T.green || '#10b981'
    }
  })),
  // avatar stack
  R.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, shown.map((p, i) => R.createElement('div', {
    key: p.identity && p.identity.id || i,
    title: p._me ? p.identity.name + ' (you)' : p.identity.name,
    style: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginLeft: i === 0 ? 0 : -8,
      background: p.identity && p.identity.color || accent,
      color: '#fff',
      border: `2px solid ${T && T.bg2 || '#11192a'}`,
      display: 'grid',
      placeItems: 'center',
      fontFamily: window.SF || 'sans-serif',
      fontSize: 11,
      fontWeight: 700,
      zIndex: shown.length - i
    }
  }, initials(p.identity && p.identity.name))), extra > 0 && R.createElement('div', {
    style: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginLeft: -8,
      background: T && T.bg0 || '#06101e',
      color: T && T.t2 || '#9bb0c9',
      border: `2px solid ${T && T.bg2 || '#11192a'}`,
      display: 'grid',
      placeItems: 'center',
      fontFamily: window.SF || 'sans-serif',
      fontSize: 10,
      fontWeight: 700
    }
  }, '+' + extra)),
  // label
  R.createElement('div', {
    style: {
      fontFamily: window.SF || 'sans-serif',
      fontSize: 12.5,
      color: T && T.t2 || '#9bb0c9',
      fontWeight: 600
    }
  }, people.length === 1 ? 'Only you here' : `${people.length} ${label}`));
}

// ── Compact dot+count chip, for headers/cards ──
function PresenceChip({
  screen,
  focus,
  accent = window.T && T.blue || '#2563eb'
}) {
  const R = window.React;
  if (!window.usePresence) return null;
  const {
    here
  } = window.usePresence(screen, focus);
  const total = here.length + 1;
  if (total <= 1) return null;
  return R.createElement('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 9px 3px 7px',
      background: (T && T.green || '#10b981') + '1a',
      borderRadius: 20
    }
  }, R.createElement('span', {
    style: {
      width: 6,
      height: 6,
      borderRadius: 6,
      background: T && T.green || '#10b981'
    }
  }), R.createElement('span', {
    style: {
      fontFamily: window.SF || 'sans-serif',
      fontSize: 11.5,
      fontWeight: 700,
      color: T && T.green || '#10b981'
    }
  }, total + ' live'));
}
function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// pulse keyframes (injected once)
(function () {
  if (document.getElementById('cx-presence-css')) return;
  const s = document.createElement('style');
  s.id = 'cx-presence-css';
  s.textContent = '@keyframes cxPresencePulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}.cx-presence-pulse{animation:cxPresencePulse 1.8s ease-out infinite}';
  document.head.appendChild(s);
})();
Object.assign(window, {
  PresenceBar,
  PresenceChip
});