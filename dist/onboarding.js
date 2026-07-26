// CortexBuild Pro — first-run onboarding tour (lightweight drop-in)
//
// Shows a 4-step welcome tour the first time a user opens the app, then
// never again. Pure DOM + CSS — deliberately NOT React, so it can't be
// affected by render timing, route changes, or a screen crashing mid-mount.
// Same drop-in shape as crash.js.
//
// Public API:
//   CortexOnboarding.start()    → show the tour now (ignores the seen flag)
//   CortexOnboarding.reset()    → clear the flag so it shows again next boot
//   CortexOnboarding.status()   → { seen, showing, version }
//
// Storage: localStorage['cortexx_onboarded'] = tour version string.
// Bumping VERSION re-shows the tour once to existing users (use sparingly).

(function () {
  if (window.CortexOnboarding) return;

  var VERSION = '1';
  var KEY = 'cortexx_onboarded';
  var showing = false;

  function seen() {
    try { return localStorage.getItem(KEY) === VERSION; } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(KEY, VERSION); } catch (e) {}
  }

  // Theme: prefer the app's tokens, fall back to literals so the tour still
  // renders correctly if it somehow loads before tokens.js.
  function tok(name, fallback) {
    try { return (window.T && window.T[name]) || fallback; } catch (e) { return fallback; }
  }

  var STEPS = [
    {
      icon: '⚡',
      title: 'Price a job in 30 seconds',
      body: 'Describe the work the way you\u2019d say it out loud. The AI estimator returns line items with UK-realistic quantities and rates \u2014 edit anything, then send it as a quote.',
      hint: 'Try it from the + button \u2192 New quote'
    },
    {
      icon: '\uD83D\uDCC1',
      title: 'Everything lives on the project',
      body: 'Photos, diary entries, invoices, snags and RAMS all attach to the job they belong to. Log it once on site and it shows up everywhere it matters.',
      hint: 'Projects tab'
    },
    {
      icon: '\u00A3',
      title: 'Money that understands CIS',
      body: 'Invoices, cashflow and sub-contractor deductions are handled together \u2014 no separate spreadsheet, no month-end surprise.',
      hint: 'Money tab'
    },
    {
      icon: '\uD83D\uDCF6',
      title: 'Works with no signal',
      body: 'Everything runs on your device. Log work in a basement or a field and it syncs when you\u2019re back on data \u2014 nothing is ever lost waiting for a connection.',
      hint: 'You\u2019re all set'
    }
  ];

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute('style', style);
    if (text != null) n.textContent = text;
    return n;
  }

  function render(startAt) {
    if (showing) return;
    showing = true;
    var i = startAt || 0;

    var bg2 = tok('bg2', '#152641'), bg1 = tok('bg1', '#0c1a2e');
    var blue = tok('blue', '#2563eb'), purple = tok('purple', '#8b5cf6');
    var t1 = tok('t1', '#eef3fa'), t2 = tok('t2', '#8ea8c5'), t3 = tok('t3', '#52749a');
    var hair = tok('hair', 'rgba(255,255,255,0.07)');
    var SFs = '-apple-system, "SF Pro Text", system-ui, sans-serif';

    var overlay = el('div',
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;' +
      'justify-content:center;background:rgba(3,8,15,.72);backdrop-filter:blur(6px);' +
      '-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .22s ease;');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Welcome tour');

    var card = el('div',
      'width:100%;max-width:420px;margin:0 12px 12px;background:' + bg2 + ';' +
      'border:0.5px solid ' + hair + ';border-radius:20px;padding:22px 20px 18px;' +
      'font-family:' + SFs + ';box-shadow:0 24px 60px rgba(0,0,0,.5);' +
      'transform:translateY(14px);transition:transform .26s cubic-bezier(.2,.8,.2,1);' +
      'padding-bottom:calc(18px + env(safe-area-inset-bottom, 0px));');

    var badge = el('div',
      'width:52px;height:52px;border-radius:15px;display:flex;align-items:center;' +
      'justify-content:center;font-size:25px;background:linear-gradient(135deg,' +
      blue + ',' + purple + ');');
    var h = el('div', 'font-size:19px;font-weight:700;color:' + t1 +
      ';letter-spacing:-.4px;margin-top:14px;');
    var p = el('div', 'font-size:14px;color:' + t2 + ';line-height:1.55;margin-top:8px;');
    var hint = el('div', 'font-size:12px;color:' + t3 + ';margin-top:12px;font-weight:600;');

    var dots = el('div', 'display:flex;gap:6px;');
    var dotEls = STEPS.map(function () {
      var d = el('div', 'width:6px;height:6px;border-radius:3px;background:' + t3 +
        ';transition:all .2s ease;');
      dots.appendChild(d); return d;
    });

    var skip = el('button',
      'background:none;border:none;color:' + t3 + ';font-family:' + SFs +
      ';font-size:14px;font-weight:600;cursor:pointer;padding:10px 4px;', 'Skip');
    var next = el('button',
      'background:' + blue + ';color:#fff;border:none;border-radius:12px;' +
      'font-family:' + SFs + ';font-size:15px;font-weight:700;cursor:pointer;' +
      'padding:11px 22px;', 'Next');

    var controls = el('div',
      'display:flex;align-items:center;justify-content:space-between;margin-top:20px;');
    var left = el('div', 'display:flex;align-items:center;gap:14px;');
    left.appendChild(skip); left.appendChild(dots);
    controls.appendChild(left); controls.appendChild(next);

    card.appendChild(badge); card.appendChild(h); card.appendChild(p);
    card.appendChild(hint); card.appendChild(controls);
    overlay.appendChild(card);

    function paint() {
      var s = STEPS[i];
      badge.textContent = s.icon;
      h.textContent = s.title;
      p.textContent = s.body;
      hint.textContent = s.hint;
      next.textContent = (i === STEPS.length - 1) ? 'Start using Cortexx' : 'Next';
      skip.style.visibility = (i === STEPS.length - 1) ? 'hidden' : 'visible';
      dotEls.forEach(function (d, n) {
        d.style.background = n === i ? blue : t3;
        d.style.width = n === i ? '18px' : '6px';
      });
    }

    function close() {
      if (!showing) return;
      showing = false;
      markSeen();
      overlay.style.opacity = '0';
      card.style.transform = 'translateY(14px)';
      document.removeEventListener('keydown', onKey);
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 240);
    }

    function advance() {
      if (i < STEPS.length - 1) { i++; paint(); } else { close(); }
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'Enter' || e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft' && i > 0) { i--; paint(); }
    }

    next.addEventListener('click', advance);
    skip.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);

    paint();
    document.body.appendChild(overlay);
    // next frame → transition runs
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      card.style.transform = 'translateY(0)';
      next.focus();
    });
  }

  function boot() {
    if (seen()) return;
    // Let the app paint first — the tour should sit over a real screen, not a
    // blank shell, and a crashed boot shouldn't be hidden behind an overlay.
    setTimeout(function () {
      try {
        var root = document.getElementById('root');
        if (root && root.children.length) render(0);
      } catch (e) {}
    }, 1400);
  }

  window.CortexOnboarding = {
    start: function () { showing = false; render(0); },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    status: function () { return { seen: seen(), showing: showing, version: VERSION }; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
