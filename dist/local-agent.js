// Cortexx — Local Agent: a resilient 3-tier reasoning layer that NEVER fails to respond.
//   Tier 1: Cloud (window.claude.complete)  — best quality, needs network
//   Tier 2: WebLLM in-browser model         — lazy-loaded if WebGPU present
//   Tier 3: Deterministic local engine      — reads live Brain data, always answers, cannot crash
//
// Public API:
//   await CortexLocalAgent.respond(question, { onToken })  → always resolves to a string
//   CortexLocalAgent.status()                              → { cloud, webllm, local }

(function () {
  if (window.CortexLocalAgent) return;
  const TIMEOUT_MS = 12000;

  // ─────────────────────────────────────────────────────────────
  // Tier 3 — Deterministic local reasoning engine (the floor)
  // Reads real data from Backend.brain; pattern-matches intent.
  // ─────────────────────────────────────────────────────────────
  const fmtGBP = n => '£' + Math.round(n).toLocaleString('en-GB');
  function localReason(q) {
    const t = (q || '').toLowerCase();
    let b = {};
    try {
      b = window.Backend && Backend.brain ? Backend.brain.snapshot() : {};
    } catch (e) {
      b = {};
    }
    const money = b.money || {},
      proj = b.projects || {},
      ops = b.ops || {},
      people = b.people || {},
      sales = b.sales || {};
    const projList = proj.list || [];
    const has = (...words) => words.some(w => t.includes(w));

    // Greeting
    if (has('hello', 'hi ', 'hey', 'morning', 'good morning') && t.length < 24) {
      return `Morning. ${proj.active || 0} active projects, ${fmtGBP(money.cash || 0)} in the bank, ${ops.openTasks || 0} open tasks. What do you need?`;
    }
    // Cash / money
    if (has('cash', 'bank', 'balance', 'money', 'how much')) {
      return `Cash balance is ${fmtGBP(money.cash || 0)}. You've got ${fmtGBP(money.outstanding || 0)} outstanding across invoices${money.overdue ? `, ${money.overdue} overdue` : ''}. Pipeline value is ${fmtGBP(money.pipeline || 0)}.`;
    }
    // Margin
    if (has('margin', 'profit', 'profitable')) {
      const best = [...projList].filter(p => p.margin > 0).sort((a, c) => c.margin - a.margin)[0];
      return `Average margin is ${money.avgMargin || 0}% across active jobs.${best ? ` Best performer is ${best.name} at ${best.margin}%.` : ''}`;
    }
    // Overdue / chase
    if (has('overdue', 'chase', 'unpaid', 'owe', 'owed')) {
      return money.overdue ? `${money.overdue} invoice${money.overdue > 1 ? 's are' : ' is'} overdue, ${fmtGBP(money.outstanding || 0)} outstanding in total. I'd chase the oldest first — open Money to draft a reminder.` : `Nothing overdue right now. ${fmtGBP(money.outstanding || 0)} is outstanding but within terms.`;
    }
    // Projects
    if (has('project', 'job', 'site')) {
      if (projList.length === 0) return `No projects loaded yet.`;
      const active = projList.filter(p => p.status === 'active' || p.status === 'snagging');
      const lines = active.slice(0, 4).map(p => `${p.name} (${p.pct}%, ${p.status})`).join('; ');
      return `${proj.active || active.length} active: ${lines}. Tap Projects to drill in.`;
    }
    // Tasks
    if (has('task', 'todo', 'to do', 'to-do', "what should", 'priorit', 'focus')) {
      return `${ops.openTasks || 0} open tasks${ops.highPriorityTasks ? `, ${ops.highPriorityTasks} high priority` : ''}. ${ops.openRFIs ? `${ops.openRFIs} RFIs and ` : ''}${ops.openSnags || 0} snags also need attention.`;
    }
    // Team / people
    if (has('team', 'who', 'crew', 'staff', 'on site', 'available')) {
      return `${people.team || 0} on the team, ${people.onSite || 0} on site right now.${people.certsExpiring ? ` Heads up: ${people.certsExpiring} certs expiring soon.` : ''}${people.pendingTimesheets ? ` ${people.pendingTimesheets} timesheets need approval.` : ''}`;
    }
    // Safety / compliance
    if (has('safe', 'rams', 'cscs', 'permit', 'cdm', 'compliance', 'inspection')) {
      return `${ops.openInspections || 0} inspections scheduled, ${b.compliance && b.compliance.permitsActive || 0} active permits.${people.certsExpiring ? ` ${people.certsExpiring} certs expiring — book renewals.` : ' Certs all current.'} I apply CDM 2015 and BS 7671 to any docs I draft.`;
    }
    // Materials / stock
    if (has('material', 'stock', 'order', 'supplies')) {
      return ops.lowStock ? `${ops.lowStock} material${ops.lowStock > 1 ? 's are' : ' is'} below minimum stock. Open Materials for an AI reorder forecast.` : `Stock levels are healthy — nothing below minimum.`;
    }
    // Leads / sales / grow
    if (has('lead', 'sales', 'grow', 'pipeline', 'win', 'new business')) {
      return `${sales.newLeads || 0} new leads in the pipeline worth ${fmtGBP(sales.activeQuotes || 0)} in active quotes. Ask Vera to hunt for more on the CEO screen.`;
    }
    // Variations / change orders
    if (has('variation', 'change order', 'extra')) {
      return `${ops.pendingVariations || 0} variations pending approval. Each one is margin you don't want to leave on the table — get them signed off.`;
    }
    // Status / summary / how are we doing
    if (has('status', 'summary', 'how are we', 'overview', 'doing', 'health', 'briefing')) {
      return `Quick read: ${fmtGBP(money.cash || 0)} cash, ${proj.active || 0} active jobs, ${money.avgMargin || 0}% avg margin. ${ops.openTasks || 0} tasks, ${ops.openSnags || 0} snags, ${ops.openRFIs || 0} RFIs open.${money.overdue ? ` ${money.overdue} overdue invoice to chase.` : ' Cashflow looks clean.'}`;
    }
    // Help / capabilities
    if (has('help', 'what can you', 'how do i')) {
      return `Ask me about cash, projects, tasks, team, safety, materials, leads, or margins — I read your live data. I work offline too, so I'll always answer.`;
    }
    // Fallback — never empty
    return `Here's where things stand: ${fmtGBP(money.cash || 0)} cash, ${proj.active || 0} active projects, ${ops.openTasks || 0} open tasks, ${money.avgMargin || 0}% margin. Ask me about money, jobs, team, safety, or materials and I'll give you specifics.`;
  }

  // ─────────────────────────────────────────────────────────────
  // Tier 2 — WebLLM (lazy, optional)
  // ─────────────────────────────────────────────────────────────
  let webllmEngine = null;
  let webllmTried = false;
  let webllmAvailable = false;
  async function initWebLLM(onProgress) {
    if (webllmTried) return webllmEngine;
    webllmTried = true;
    try {
      if (!navigator.gpu) return null; // no WebGPU → skip silently
      const mod = await import('https://esm.run/@mlc-ai/web-llm');
      webllmEngine = await mod.CreateMLCEngine('Llama-3.2-1B-Instruct-q4f16_1-MLC', {
        initProgressCallback: p => {
          if (onProgress) onProgress(p.text);
        }
      });
      webllmAvailable = true;
      return webllmEngine;
    } catch (e) {
      webllmEngine = null;
      return null;
    }
  }
  async function webllmRespond(question, sys) {
    if (!webllmEngine) return null;
    try {
      const res = await webllmEngine.chat.completions.create({
        messages: [{
          role: 'system',
          content: sys
        }, {
          role: 'user',
          content: question
        }],
        temperature: 0.6,
        max_tokens: 300
      });
      return res?.choices?.[0]?.message?.content || null;
    } catch (e) {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Tier 1 — Cloud, wrapped with a hard timeout
  // ─────────────────────────────────────────────────────────────
  async function cloudRespond(question) {
    if (!window.claude || !window.claude.complete) return null;
    let sys = 'You are Cortex, an AI assistant inside a UK construction management app. Be concise and practical. UK English.';
    try {
      if (window.Backend && Backend.brain) sys += ' Live business state: ' + JSON.stringify(Backend.brain.snapshot()).slice(0, 1500);
    } catch (e) {}
    const call = window.claude.complete({
      messages: [{
        role: 'user',
        content: `${sys}\n\nUser: ${question}`
      }]
    });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS));
    try {
      const res = await Promise.race([call, timeout]);
      return typeof res === 'string' && res.trim() ? res.trim() : null;
    } catch (e) {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Orchestrator — always resolves, never throws
  // ─────────────────────────────────────────────────────────────
  const CortexLocalAgent = {
    _cloudOK: null,
    async respond(question, opts = {}) {
      const q = (question || '').toString();
      // 1) Cloud
      try {
        const cloud = await cloudRespond(q);
        if (cloud) {
          this._cloudOK = true;
          return cloud;
        }
      } catch (e) {}
      this._cloudOK = false;
      // 2) WebLLM (only if already initialised — don't block first answer on a download)
      try {
        if (webllmAvailable && webllmEngine) {
          let sys = 'You are Cortex, an assistant in a UK construction app. Be concise, UK English.';
          try {
            if (window.Backend?.brain) sys += ' State: ' + JSON.stringify(Backend.brain.snapshot()).slice(0, 800);
          } catch (e) {}
          const local = await webllmRespond(q, sys);
          if (local) return local;
        }
      } catch (e) {}
      // 3) Deterministic — cannot fail
      return localReason(q);
    },
    // Opt-in heavy local model (call from a settings toggle)
    async enableWebLLM(onProgress) {
      return initWebLLM(onProgress);
    },
    localReason: localReason,
    // exposed so the LLM shim can hit the deterministic tier without re-entering window.claude
    status() {
      return {
        cloud: this._cloudOK,
        webgpu: !!navigator.gpu,
        webllm: webllmAvailable,
        local: true // always
      };
    }
  };
  window.CortexLocalAgent = CortexLocalAgent;

  // Make the existing AI layer resilient: route Backend.ai.ask through the agent
  // so EVERY AI call in the app gets the never-fail fallback for free.
  function patchBackend() {
    if (!window.Backend || !Backend.ai) {
      setTimeout(patchBackend, 300);
      return;
    }
    if (Backend.ai.__resilient) return;
    const orig = Backend.ai.ask.bind(Backend.ai);
    Backend.ai.ask = async (userMsg, opts = {}) => {
      try {
        const r = await orig(userMsg, opts);
        if (r && r.trim()) return r;
      } catch (e) {}
      // fall through to the local engine — guarantees a response
      return localReason(userMsg || opts && opts.system || '');
    };
    Backend.ai.__resilient = true;
  }
  patchBackend();
})();