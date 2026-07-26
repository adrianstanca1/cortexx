// CortexBuild Pro — Admin Console UI logic.
// Talks to /api/admin/* (operator surface). All calls carry the Bearer token.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $('#view');
  let TOKEN = localStorage.getItem('admin_token') || '';
  let ME = null;
  let state = { tenants: [], features: [], roles: [], settings: {} };

  const api = async (path, opts = {}) => {
    const res = await fetch('/api/admin' + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN, ...(opts.headers || {}) },
    });
    if (res.status === 401) { logout(); throw new Error('unauthorized'); }
    return res;
  };
  const j = async (p, o) => { const r = await api(p, o); return r.json(); };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pill = (cls, txt) => `<span class="pill ${cls}">${esc(txt)}</span>`;
  const toast = (msg) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };
  const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString('en-GB'));

  // ── auth ────────────────────────────────────────────────
  async function login(email, password) {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok || !d.token) { $('#loginErr').textContent = d.error || 'Login failed'; return; }
    TOKEN = d.token; localStorage.setItem('admin_token', TOKEN); ME = d.user;
    await boot();
  }
  function logout() { TOKEN = ''; localStorage.removeItem('admin_token'); $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }

  async function boot() {
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
    const me = await j('/auth/me').catch(() => null);
    ME = me ? me.user : ME;
    $('#meEmail').textContent = ME?.email || '—';
    await loadTenants();
    navigate('dashboard');
  }

  async function loadTenants() {
    try {
      const d = await j('/tenants?limit=500');
      state.tenants = d.tenants || [];
      const sel = $('#tenantPicker');
      sel.innerHTML = '<option value="">— select tenant —</option>' +
        state.tenants.map(t => `<option value="${t.id}">${esc(t.name)} (${esc(t.plan)})</option>`).join('');
    } catch {}
  }
  const currentTenant = () => $('#tenantPicker').value || (state.tenants[0] && state.tenants[0].id) || '';

  // ── nav ─────────────────────────────────────────────────
  const TITLES = {
    dashboard: ['Dashboard', 'Platform overview'], tenants: ['Tenants', 'Workspace directory'],
    users: ['Users', 'User directory'], billing: ['Billing', 'Revenue & plans'],
    features: ['Features (VERA)', 'AI intelligence, memory, skills, knowledge, agents, packages'],
    access: ['Access & RBAC', 'Roles, permissions & package assignment'],
    ai: ['AI Control', 'Provider, models, memory & agent config'],
    settings: ['Settings', 'Global platform configuration'],
    support: ['Support', 'Tickets'], activity: ['Activity', 'Cross-tenant feed'],
    system: ['System', 'Health & config'],
  };
  function navigate(v) {
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === v));
    $('#viewTitle').textContent = TITLES[v]?.[0] || v;
    $('#viewSub').textContent = TITLES[v]?.[1] || '';
    $('#tenantPicker').classList.toggle('hidden', !['features', 'access', 'ai'].includes(v));
    render(v);
  }
  async function render(v) {
    view.innerHTML = '<div class="empty">Loading…</div>';
    try {
      if (v === 'dashboard') return renderDashboard();
      if (v === 'tenants') return renderTenants();
      if (v === 'users') return renderUsers();
      if (v === 'billing') return renderBilling();
      if (v === 'features') return renderFeatures();
      if (v === 'access') return renderAccess();
      if (v === 'ai') return renderAI();
      if (v === 'settings') return renderSettings();
      if (v === 'support') return renderSupport();
      if (v === 'activity') return renderActivity();
      if (v === 'system') return renderSystem();
    } catch (e) { view.innerHTML = `<div class="err-banner">Error: ${esc(e.message)}</div>`; }
  }

  // ── dashboard ────────────────────────────────────────────
  async function renderDashboard() {
    const d = await j('/overview?range=7d');
    const k = d.kpis || {};
    view.innerHTML = `
      <div class="kpis">
        ${kpi('amber', fmt(k.workspaces), 'Workspaces')}
        ${kpi('blue', fmt(k.users), 'Users')}
        ${kpi('green', fmt(k.projects_active), 'Active projects')}
        ${kpi('red', fmt(k.open_tickets), 'Open tickets')}
      </div>
      <div class="grid2">
        <div class="panel">
          <h2><span class="dot"></span>Plan distribution</h2>
          <table><thead><tr><th>Plan</th><th>Tenants</th></tr></thead><tbody>
            ${(d.plan_distribution || []).map(p => `<tr><td>${pill(p.plan, p.plan)}</td><td>${fmt(p.n)}</td></tr>`).join('') || emptyRow(2)}
          </tbody></table>
        </div>
        <div class="panel">
          <h2><span class="dot"></span>Revenue (lifetime)</h2>
          <div class="kv"><span>Total invoiced</span><b>£${fmt(k.total_invoiced)}</b></div>
          <div class="kv"><span>Total paid</span><b>£${fmt(k.total_paid)}</b></div>
          <div class="kv"><span>Active pro tenants</span><b>${fmt(k.active_pro_tenants)}</b></div>
          <div class="kv"><span>New workspaces (7d)</span><b>${fmt(k.new_workspaces_range)}</b></div>
        </div>
      </div>`;
  }
  const kpi = (c, n, l) => `<div class="kpi ${c}"><div class="kpi-n">${n}</div><div class="kpi-l">${l}</div></div>`;
  const emptyRow = (n) => `<tr><td colspan="${n}" class="empty">No data</td></tr>`;

  // ── tenants ─────────────────────────────────────────────
  async function renderTenants() {
    const d = await j('/tenants');
    view.innerHTML = `
      <div class="filters"><input type="search" id="tq" placeholder="Search tenants…"><select id="tp"><option value="">All plans</option><option>free</option><option>pro</option><option>enterprise</option></select></div>
      <div class="panel"><table><thead><tr><th>Name</th><th>Company</th><th>Plan</th><th>Users</th><th>Projects</th><th>Status</th><th></th></tr></thead>
      <tbody id="trows"></tbody></table></div>`;
    const rows = $('#trows');
    const draw = (list) => rows.innerHTML = list.map(t => `<tr>
      <td>${esc(t.name)}</td><td>${esc(t.company || '—')}</td><td>${pill(t.plan, t.plan)}</td>
      <td>${fmt(t.users)}</td><td>${fmt(t.projects)}</td>
      <td>${t.suspended ? pill('suspended', 'suspended') : pill('active', 'active')}</td>
      <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-edit="${t.id}">Manage</button></div></td></tr>`).join('') || emptyRow(7);
    draw(d.tenants || []);
    $('#tq').oninput = (e) => { const q = e.target.value.toLowerCase(); draw((d.tenants || []).filter(t => (t.name + t.company).toLowerCase().includes(q))); };
    $('#tp').onchange = (e) => draw((d.tenants || []).filter(t => !e.target.value || t.plan === e.target.value));
    $$('[data-edit]', rows).forEach(b => b.onclick = () => editTenant(b.dataset.edit));
  }
  async function editTenant(id) {
    const d = await j('/tenants/' + id);
    const t = d.tenant;
    openModal(`Manage tenant — ${esc(t.name)}`, `
      <label>Plan</label><select id="mPlan"><option>free</option><option>pro</option><option>enterprise</option></select>
      <label>Suspended</label><select id="mSus"><option value="false">Active</option><option value="true">Suspended</option></select>
      <div class="kv"><span>Invoiced</span><b>£${fmt(d.invoiced)}</b></div>
      <div class="kv"><span>Users</span><b>${fmt((d.users || []).length)}</b></div>
      <div class="kv"><span>Projects</span><b>${fmt((d.projects || []).length)}</b></div>
      <div class="row-actions"><button class="btn btn-danger btn-sm" id="mDel">Delete tenant</button></div>`,
      [
        { label: 'Save', cls: 'btn-primary', fn: async () => {
            await api('/tenants/' + id, { method: 'PUT', body: JSON.stringify({ plan: $('#mPlan').value, suspended: $('#mSus').value === 'true' }) });
            toast('Saved'); closeModal(); renderTenants();
          } },
        { label: 'Cancel', cls: 'btn-ghost', fn: closeModal },
      ]);
    $('#mPlan').value = t.plan; $('#mSus').value = String(!!t.suspended);
    $('#mDel').onclick = async () => { if (confirm('Delete this tenant and ALL its data?')) { await api('/tenants/' + id, { method: 'DELETE' }); toast('Deleted'); closeModal(); renderTenants(); } };
  }

  // ── users ───────────────────────────────────────────────
  async function renderUsers() {
    const d = await j('/users');
    view.innerHTML = `
      <div class="filters"><input type="search" id="uq" placeholder="Search users…"><select id="ua"><option value="">All</option><option value="1">Admins</option><option value="0">Non-admins</option></select></div>
      <div class="panel"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Workspace</th><th>Status</th><th></th></tr></thead>
      <tbody id="urows"></tbody></table></div>`;
    const rows = $('#urows');
    const draw = (list) => rows.innerHTML = list.map(u => `<tr>
      <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${pill('cat-core', u.role || 'director')}</td>
      <td>${esc(u.workspace || '—')}</td>
      <td>${u.disabled ? pill('disabled', 'disabled') : (u.is_platform_admin ? pill('admin', 'platform admin') : pill('active', 'active'))}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-adm="${u.id}" data-on="${!u.is_platform_admin}">${u.is_platform_admin ? 'Revoke admin' : 'Make admin'}</button>
        <button class="btn btn-ghost btn-sm" data-dis="${u.id}" data-on="${!u.disabled}">${u.disabled ? 'Enable' : 'Disable'}</button>
      </div></td></tr>`).join('') || emptyRow(6);
    draw(d.users || []);
    $('#uq').oninput = (e) => { const q = e.target.value.toLowerCase(); draw((d.users || []).filter(u => (u.name + u.email).toLowerCase().includes(q))); };
    $('#ua').onchange = (e) => draw((d.users || []).filter(u => e.target.value === '' || (e.target.value === '1') === !!u.is_platform_admin));
    $$('[data-adm]', rows).forEach(b => b.onclick = async () => { await api('/users/' + b.dataset.adm + '/grant-admin', { method: 'POST', body: JSON.stringify({ grant: b.dataset.on === 'true' }) }); toast('Admin updated'); renderUsers(); });
    $$('[data-dis]', rows).forEach(b => b.onclick = async () => { await api('/users/' + b.dataset.dis + '/disable', { method: 'POST', body: JSON.stringify({ disabled: b.dataset.on === 'true' }) }); toast('User updated'); renderUsers(); });
  }

  // ── billing ─────────────────────────────────────────────
  async function renderBilling() {
    const d = await j('/billing');
    view.innerHTML = `
      <div class="kpis">
        ${kpi('green', '£' + fmt(d.total_paid), 'Paid')}
        ${kpi('amber', '£' + fmt(d.total_invoiced), 'Invoiced')}
        ${kpi('blue', fmt(d.recurring_tenants), 'Recurring tenants')}
        ${kpi('red', fmt((d.invoices_by_status || []).find(s => s.status !== 'paid') ? (d.invoices_by_status || []).reduce((a, s) => a + (s.status !== 'paid' ? s.n : 0), 0) : 0), 'Unpaid invoices')}
      </div>
      <div class="grid2">
        <div class="panel"><h2><span class="dot"></span>Plans</h2><table><thead><tr><th>Plan</th><th>Tenants</th><th>Active</th></tr></thead><tbody>
          ${(d.plan_distribution || []).map(p => `<tr><td>${pill(p.plan, p.plan)}</td><td>${fmt(p.tenants)}</td><td>${fmt(p.active)}</td></tr>`).join('') || emptyRow(3)}
        </tbody></table></div>
        <div class="panel"><h2><span class="dot"></span>Invoices by status</h2><table><thead><tr><th>Status</th><th>Count</th><th>Total</th></tr></thead><tbody>
          ${(d.invoices_by_status || []).map(s => `<tr><td>${pill(s.status, s.status)}</td><td>${fmt(s.n)}</td><td>£${fmt(s.total)}</td></tr>`).join('') || emptyRow(3)}
        </tbody></table></div>
      </div>`;
  }

  // ── FEATURES (VERA) ────────────────────────────────────
  async function renderFeatures() {
    const ws = currentTenant();
    if (!ws) { view.innerHTML = '<div class="empty">Select a tenant above to manage VERA features.</div>'; return; }
    const [cat, tnt] = await Promise.all([j('/features/catalog?workspace_id=' + ws), j('/features/tenant/' + ws)]);
    const enabledMap = Object.fromEntries((tnt.features || []).map(f => [f.key, f.enabled]));
    view.innerHTML = `
      <div class="panel"><h2><span class="dot"></span>VERA Feature Matrix — tenant ${esc(tnt.plan || '')}</h2>
        <div class="filters"><button class="btn btn-primary btn-sm" id="saveFeat">Save feature state</button>
        <button class="btn btn-ghost btn-sm" id="applyPkg">Apply package</button></div>
        <div id="featList">
          ${(cat.features || []).map(f => `
            <div class="feat-row" data-key="${f.key}">
              <div><b>${esc(f.name)}</b> ${pill('cat-' + f.category, f.category)}<div class="feat-meta">${esc(f.description || '')} · min plan ${esc(f.min_plan)}</div></div>
              <label class="switch"><input type="checkbox" data-feat="${f.key}" ${enabledMap[f.key] ? 'checked' : ''}/><span class="slider"></span></label>
            </div>`).join('')}
        </div>
      </div>
      <div class="panel"><h2><span class="dot"></span>Assigned packages</h2><div id="pkgList">${ (tnt.packages || []).map(p => pill('cat-packages', p)).join(' ') || '<span class="mini">none</span>' }</div></div>`;
    $('#saveFeat').onclick = async () => {
      const overrides = {};
      $$('[data-feat]').forEach(c => overrides[c.dataset.feat] = c.checked);
      await api('/features/tenant/' + ws, { method: 'PUT', body: JSON.stringify({ overrides }) });
      toast('Feature state saved'); renderFeatures();
    };
    $('#applyPkg').onclick = () => applyPackage(ws);
  }
  async function applyPackage(ws) {
    const pkgs = await j('/features/packages');
    openModal('Apply package', `<label>Package</label><select id="pSel">${pkgs.packages.map(p => `<option value="${p.key}">${esc(p.name)} — £${p.monthly_price}/mo</option>`).join('')}</select>`, [
      { label: 'Assign', cls: 'btn-primary', fn: async () => { await api('/access/tenant/' + ws + '/package', { method: 'PUT', body: JSON.stringify({ package_key: $('#pSel').value, assign: true }) }); toast('Package applied'); closeModal(); renderFeatures(); } },
      { label: 'Cancel', cls: 'btn-ghost', fn: closeModal },
    ]);
  }

  // ── ACCESS / RBAC ───────────────────────────────────────
  async function renderAccess() {
    const ws = currentTenant();
    if (!ws) { view.innerHTML = '<div class="empty">Select a tenant above to manage access control.</div>'; return; }
    const [roles, tnt] = await Promise.all([j('/access/roles'), j('/access/tenant/' + ws)]);
    view.innerHTML = `
      <div class="panel"><h2><span class="dot"></span>Role catalog</h2>
        <div class="filters"><button class="btn btn-primary btn-sm" id="newRole">+ New role</button></div>
        <table><thead><tr><th>Key</th><th>Name</th><th>Type</th><th>Permissions</th><th></th></tr></thead><tbody id="rrows"></tbody></table>
      </div>
      <div class="panel"><h2><span class="dot"></span>Tenant users &amp; roles</h2>
        <table><thead><tr><th>Name</th><th>Email</th><th>Current role</th><th></th></tr></thead><tbody id="urows"></tbody></table>
      </div>`;
    $('#rrows').innerHTML = (roles.roles || []).map(r => `<tr>
      <td>${esc(r.key)}</td><td>${esc(r.name)}</td><td>${r.is_system ? pill('cat-core', 'system') : pill('cat-ai', 'custom')}</td>
      <td class="mini">${Object.keys(r.permissions || {}).filter(k => r.permissions[k]).join(', ') || '—'}</td>
      <td><div class="row-actions">${r.is_system ? '' : `<button class="btn btn-ghost btn-sm" data-delrole="${r.key}">Delete</button>`}<button class="btn btn-ghost btn-sm" data-editrole="${r.key}">Edit</button></div></td></tr>`).join('') || emptyRow(5);
    $('#urows').innerHTML = (tnt.users || []).map(u => `<tr>
      <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${pill('cat-core', u.role_key || u.role || 'director')}</td>
      <td><button class="btn btn-ghost btn-sm" data-role="${u.id}" data-cur="${u.role_key || u.role || 'member'}">Set role</button></td></tr>`).join('') || emptyRow(4);
    $('#newRole').onclick = () => editRole(null, roles.roles);
    $$('[data-editrole]').forEach(b => b.onclick = () => editRole(b.dataset.editrole, roles.roles));
    $$('[data-delrole]').forEach(b => b.onclick = async () => { if (confirm('Delete custom role?')) { await api('/access/roles/' + b.dataset.delrole, { method: 'DELETE' }); toast('Role deleted'); renderAccess(); } });
    $$('[data-role]').forEach(b => b.onclick = () => setUserRole(ws, b.dataset.role, b.dataset.cur, roles.roles));
  }
  async function editRole(key, roles) {
    const r = key ? roles.find(x => x.key === key) : null;
    openModal(key ? 'Edit role' : 'New role', `
      <label>Key (unique)</label><input id="rk" value="${esc(r?.key || '')}" ${r ? 'readonly' : ''}>
      <label>Name</label><input id="rn" value="${esc(r?.name || '')}">
      <label>Permissions (comma separated)</label><input id="rp" value="${esc(Object.keys(r?.permissions || {}).filter(k => r.permissions[k]).join(','))}">
      <div class="mini">Available: projects, invoices, clients, team, settings, users, ai</div>`, [
      { label: 'Save', cls: 'btn-primary', fn: async () => {
          const perms = {}; $('#rp').value.split(',').map(s => s.trim()).filter(Boolean).forEach(p => perms[p] = true);
          await api('/access/roles/' + ($('#rk').value.trim()), { method: 'PUT', body: JSON.stringify({ name: $('#rn').value.trim(), permissions: perms, description: '' }) });
          toast('Role saved'); closeModal(); renderAccess();
        } },
      { label: 'Cancel', cls: 'btn-ghost', fn: closeModal },
    ]);
  }
  async function setUserRole(ws, uid, cur, roles) {
    openModal('Assign role', `<label>Role</label><select id="sel">${roles.map(r => `<option value="${r.key}" ${r.key === cur ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`, [
      { label: 'Assign', cls: 'btn-primary', fn: async () => { await api('/access/user/' + uid + '/role', { method: 'PUT', body: JSON.stringify({ role_key: $('#sel').value }) }); toast('Role assigned'); closeModal(); renderAccess(); } },
      { label: 'Cancel', cls: 'btn-ghost', fn: closeModal },
    ]);
  }

  // ── AI CONTROL ──────────────────────────────────────────
  async function renderAI() {
    const ws = currentTenant();
    if (!ws) { view.innerHTML = '<div class="empty">Select a tenant above to control AI.</div>'; return; }
    const [cfg, prov, usage] = await Promise.all([j('/ai/config/' + ws), j('/ai/providers'), j('/ai/usage/' + ws)]);
    const c = cfg.config || {};
    view.innerHTML = `
      <div class="grid2">
        <div class="panel"><h2><span class="dot"></span>AI configuration ${c.is_default ? '(platform default)' : ''}</h2>
          <div class="kv"><span>Provider</span>
            <select id="aiProv">${prov.providers.map(p => `<option value="${p.key}" ${p.key === c.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></div>
          <div class="kv"><span>Model</span><input id="aiModel" value="${esc(c.model || 'qwen2.5-7b')}"></div>
          <div class="kv"><span>Base URL</span><input id="aiUrl" value="${esc(c.base_url || '')}" placeholder="optional override"></div>
          <label class="feat-row"><span>Memory enabled</span><label class="switch"><input type="checkbox" id="aiMem" ${c.memory_enabled ? 'checked' : ''}><span class="slider"></span></label></label>
          <label class="feat-row"><span>Knowledge base enabled</span><label class="switch"><input type="checkbox" id="aiKb" ${c.knowledge_enabled ? 'checked' : ''}><span class="slider"></span></label></label>
          <label class="feat-row"><span>Agents enabled</span><label class="switch"><input type="checkbox" id="aiAgents" ${c.agents_enabled ? 'checked' : ''}><span class="slider"></span></label></label>
          <div class="kv"><span>Max tokens</span><input id="aiTok" type="number" value="${c.max_tokens || 2048}" style="width:120px"></div>
          <div class="kv"><span>Temperature</span><input id="aiTemp" type="number" step="0.1" value="${c.temperature || 0.7}" style="width:120px"></div>
          <div class="filters"><button class="btn btn-primary btn-sm" id="aiSave">Save config</button><button class="btn btn-ghost btn-sm" id="aiTest">Test connection</button></div>
          <div class="mini" id="aiTestOut"></div>
        </div>
        <div class="panel"><h2><span class="dot"></span>Providers &amp; status</h2>
          ${(prov.providers || []).map(p => `<div class="feat-row"><div><b>${esc(p.label)}</b><div class="feat-meta">${esc(p.key)}</div></div>${pill(p.status.startsWith('online') ? 'on' : (p.status === 'offline' ? 'off' : 'cat-core'), p.status)}</div>`).join('')}
          <h3 style="margin-top:16px">Usage (7d)</h3>
          <div class="kv"><span>Calls</span><b>${fmt(usage.usage?.calls || 0)}</b></div>
          <div class="kv"><span>Tokens</span><b>${fmt(usage.usage?.tokens || 0)}</b></div>
        </div>
      </div>`;
    $('#aiSave').onclick = async () => {
      await api('/ai/config/' + ws, { method: 'PUT', body: JSON.stringify({
        provider: $('#aiProv').value, model: $('#aiModel').value, base_url: $('#aiUrl').value || null,
        memory_enabled: $('#aiMem').checked, knowledge_enabled: $('#aiKb').checked, agents_enabled: $('#aiAgents').checked,
        max_tokens: +$('#aiTok').value, temperature: +$('#aiTemp').value,
      }) });
      toast('AI config saved'); renderAI();
    };
    $('#aiTest').onclick = async () => {
      const r = await api('/ai/test/' + ws, { method: 'POST' }); const d = await r.json();
      $('#aiTestOut').textContent = d.ok ? `OK — ${d.latency_ms}ms (${d.provider}/${d.model})` : `FAIL — ${d.error || d.status}`;
    };
  }

  // ── SETTINGS ────────────────────────────────────────────
  async function renderSettings() {
    const d = await j('/settings');
    const groups = {};
    (d.settings || []).forEach(s => { groups[s.key] = s.value; });
    const general = groups.general || {};
    const branding = groups.branding || {};
    const aiDef = groups.ai_defaults || {};
    view.innerHTML = `
      <div class="grid2">
        <div class="panel"><h2><span class="dot"></span>General</h2>
          <div class="kv"><span>Platform name</span><input id="sgName" value="${esc(general.platform_name || '')}"></div>
          <div class="kv"><span>Support email</span><input id="sgEmail" value="${esc(general.support_email || '')}"></div>
          <label class="feat-row"><span>Maintenance mode</span><label class="switch"><input type="checkbox" id="sgMaint" ${general.maintenance_mode ? 'checked' : ''}><span class="slider"></span></label></label>
          <label class="feat-row"><span>Open signups</span><label class="switch"><input type="checkbox" id="sgSign" ${general.signups_open ? 'checked' : ''}><span class="slider"></span></label></label>
          <button class="btn btn-primary btn-sm" id="saveGeneral">Save general</button>
        </div>
        <div class="panel"><h2><span class="dot"></span>AI defaults</h2>
          <div class="kv"><span>Provider</span><input id="sdProv" value="${esc(aiDef.provider || 'ollama')}"></div>
          <div class="kv"><span>Model</span><input id="sdModel" value="${esc(aiDef.model || 'qwen2.5-7b')}"></div>
          <label class="feat-row"><span>Memory</span><label class="switch"><input type="checkbox" id="sdMem" ${aiDef.memory_enabled ? 'checked' : ''}><span class="slider"></span></label></label>
          <label class="feat-row"><span>Knowledge base</span><label class="switch"><input type="checkbox" id="sdKb" ${aiDef.knowledge_enabled ? 'checked' : ''}><span class="slider"></span></label></label>
          <label class="feat-row"><span>Agents</span><label class="switch"><input type="checkbox" id="sdAgents" ${aiDef.agents_enabled ? 'checked' : ''}><span class="slider"></span></label></label>
          <button class="btn btn-primary btn-sm" id="saveAiDef">Save AI defaults</button>
        </div>
        <div class="panel"><h2><span class="dot"></span>Branding</h2>
          <div class="kv"><span>Primary color</span><input id="sbColor" value="${esc(branding.primary_color || '#ffb000')}" style="width:140px"></div>
          <div class="kv"><span>Logo URL</span><input id="sbLogo" value="${esc(branding.logo_url || '')}"></div>
          <button class="btn btn-primary btn-sm" id="saveBrand">Save branding</button>
        </div>
        <div class="panel"><h2><span class="dot"></span>Recent setting changes</h2><div id="setAudit" class="mini">loading…</div></div>
      </div>`;
    const putSetting = async (key, value) => { await api('/settings/' + key, { method: 'PUT', body: JSON.stringify({ value }) }); toast('Saved ' + key); };
    $('#saveGeneral').onclick = () => putSetting('general', { platform_name: $('#sgName').value, support_email: $('#sgEmail').value, maintenance_mode: $('#sgMaint').checked, signups_open: $('#sgSign').checked });
    $('#saveAiDef').onclick = () => putSetting('ai_defaults', { provider: $('#sdProv').value, model: $('#sdModel').value, memory_enabled: $('#sdMem').checked, knowledge_enabled: $('#sdKb').checked, agents_enabled: $('#sdAgents').checked });
    $('#saveBrand').onclick = () => putSetting('branding', { primary_color: $('#sbColor').value, logo_url: $('#sbLogo').value || null, custom_css: null });
    const aud = await j('/settings/audit?limit=20');
    $('#setAudit').innerHTML = (aud.audit || []).map(a => `<div class="kv"><span>${esc(a.action)}</span><b class="mini">${esc(a.actor)} · ${esc(new Date(a.created_at).toLocaleString())}</b></div>`).join('') || '<span class="mini">none</span>';
  }

  // ── support / activity / system (lightweight) ──────────
  async function renderSupport() {
    const d = await j('/support/tickets');
    view.innerHTML = `<div class="panel"><table><thead><tr><th>Subject</th><th>From</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody id="srows"></tbody></table></div>`;
    $('#srows').innerHTML = (d.tickets || []).map(t => `<tr><td>${esc(t.subject)}</td><td>${esc(t.email)}</td><td>${pill(t.priority, t.priority)}</td><td>${pill(t.status, t.status)}</td><td><button class="btn btn-ghost btn-sm" data-tk="${t.id}">Open</button></td></tr>`).join('') || emptyRow(5);
    $$('[data-tk]').forEach(b => b.onclick = async () => { const t = await j('/support/tickets/' + b.dataset.tk); openModal('Ticket ' + t.ticket.id, `<label>Status</label><select id="ts">${['open','in_progress','resolved','closed'].map(s => `<option ${s === t.ticket.status ? 'selected' : ''}>${s}</option>`).join('')}</select><label>Reply</label><textarea id="tr" rows="4">${esc(t.ticket.reply || '')}</textarea>`, [{ label: 'Update', cls: 'btn-primary', fn: async () => { await api('/support/tickets/' + b.dataset.tk, { method: 'PUT', body: JSON.stringify({ status: $('#ts').value, reply: $('#tr').value }) }); toast('Updated'); closeModal(); renderSupport(); } }, { label: 'Close', cls: 'btn-ghost', fn: closeModal }]); });
  }
  async function renderActivity() {
    const d = await j('/activity?limit=100');
    view.innerHTML = `<div class="panel"><table><thead><tr><th>When</th><th>Tenant</th><th>Action</th><th>Detail</th></tr></thead><tbody>${(d.activity || []).map(a => `<tr><td class="mini">${esc(new Date(a.at).toLocaleString())}</td><td>${esc(a.workspace_name || '—')}</td><td>${esc(a.kind)}</td><td>${esc(a.title)}</td></tr>`).join('') || emptyRow(4)}</tbody></table></div>`;
  }
  async function renderSystem() {
    const d = await j('/audit?limit=50');
    view.innerHTML = `<div class="panel"><h2><span class="dot"></span>Operator audit trail</h2><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>${(d.audit || []).map(a => `<tr><td class="mini">${esc(new Date(a.created_at).toLocaleString())}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td class="mini">${esc(a.target)}</td></tr>`).join('') || emptyRow(4)}</tbody></table></div>`;
  }

  // ── modal helpers ───────────────────────────────────────
  function openModal(title, bodyHtml, buttons) {
    $('#modalHost').innerHTML = `<div class="modal-bg"><div class="modal"><div class="m-head"><h3>${esc(title)}</h3><button class="x" id="mClose">×</button></div><div class="m-body">${bodyHtml}</div><div class="m-foot" id="mFoot"></div></div></div>`;
    const foot = $('#mFoot');
    (buttons || []).forEach(b => { const el = document.createElement('button'); el.className = b.cls || 'btn-ghost'; el.textContent = b.label; el.onclick = b.fn; foot.appendChild(el); });
    $('#mClose').onclick = closeModal;
  }
  function closeModal() { $('#modalHost').innerHTML = ''; }

  // ── wire up ─────────────────────────────────────────────
  $('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); login($('#email').value, $('#password').value); });
  $('#logoutBtn').onclick = logout;
  $('#refreshBtn').onclick = () => navigate($('.nav a.active').dataset.view);
  $('#tenantPicker').onchange = () => { const v = $('.nav a.active').dataset.view; if (['features', 'access', 'ai'].includes(v)) render(v); };
  $$('.nav a').forEach(a => a.onclick = () => navigate(a.dataset.view));

  // boot: if we have a token, try it; else show login
  if (TOKEN) { boot().catch(logout); } else { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
})();
