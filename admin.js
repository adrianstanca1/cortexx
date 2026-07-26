
const API = '/api';
let TOKEN = localStorage.getItem('cb_admin_token');

function fmt(d){ if(!d) return '—'; try{ return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }catch{ return '—'; } }
function fmtTime(d){ if(!d) return '—'; try{ return new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }catch{ return '—'; } }
function money(n){ n = Number(n)||0; return '£'+n.toLocaleString('en-GB',{maximumFractionDigits:0}); }
function pill(txt, cls){ return `<span class="pill ${cls||''}">${txt}</span>`; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function shortId(id){ return id? String(id).slice(0,8):'—'; }

async function api(path, opts={}){
  const r = await fetch(API+path, {
    ...opts,
    headers: {...(opts.headers||{}), 'content-type':'application/json', ...(TOKEN?{authorization:'Bearer '+TOKEN}:{})}
  });
  if(!r.ok){ const e = await r.json().catch(()=>({error:r.status})); throw e; }
  return r.json();
}

function toast(msg, kind){
  let el = document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.style.display='block';
  el.style.background = kind==='error'?'rgba(239,68,68,0.2)':'var(--bg3)';
  el.style.color = kind==='error'?'#ff9a9a':'var(--t1)';
  clearTimeout(el._t); el._t = setTimeout(()=>{ el.style.display='none'; }, 2400);
}

/* ---------- auth ---------- */
document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const err = document.getElementById('loginErr'); err.textContent='';
  try{
    const { token, user } = await api('/auth/login', {method:'POST', body:JSON.stringify({
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    })});
    if(user.is_platform_admin !== true){ err.textContent='This account is not a platform admin.'; return; }
    TOKEN = token; localStorage.setItem('cb_admin_token', token);
    enterApp(user);
  }catch(e){ err.textContent = (e.error==='invalid credentials')?'Invalid email or password.':(e.error==='account_disabled'?'This account has been disabled.':'Login failed: '+(e.error||'unknown')); }
});
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  TOKEN=null; localStorage.removeItem('cb_admin_token'); location.reload();
});

function enterApp(user){
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('meEmail').textContent = user.email || 'admin';
  showView('dashboard');
}

/* ---------- routing ---------- */
const TITLES = {
  dashboard:['Dashboard','Platform overview & health'],
  tenants:['Tenants','All customer workspaces'],
  users:['Users','Platform-wide user directory'],
  billing:['Billing','Revenue, plans & invoices'],
  support:['Support','Customer tickets'],
  activity:['Activity','Cross-tenant event stream'],
  system:['System','Services, health & audit'],
  settings:['Settings','Operator actions & preferences']
};
const RENDER = {
  dashboard:renderDashboard, tenants:renderTenants, users:renderUsers, billing:renderBilling,
  support:renderSupport, activity:renderActivity, system:renderSystem, settings:renderSettings
};
document.getElementById('nav').addEventListener('click', (e)=>{
  const a = e.target.closest('a[data-view]'); if(!a) return;
  showView(a.dataset.view);
});
document.getElementById('refreshBtn').addEventListener('click', ()=>{ const v = document.querySelector('.nav a.active').dataset.view; RENDER[v](); });

function showView(v){
  document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('active', a.dataset.view===v));
  document.getElementById('viewTitle').textContent = TITLES[v][0];
  document.getElementById('viewSub').textContent = TITLES[v][1];
  document.getElementById('view').innerHTML = '<div class="empty">Loading…</div>';
  RENDER[v]();
}

async function guard(fn){
  try{ await fn(); }
  catch(e){
    const v = document.getElementById('view');
    if(e.error==='unauthorized'||e.error==='forbidden'){ TOKEN=null; localStorage.removeItem('cb_admin_token'); location.reload(); return; }
    v.innerHTML = `<div class="err-banner">Failed to load: ${esc(e.error||'unknown error')}</div>`;
  }
}

/* ---------- DASHBOARD ---------- */
async function renderDashboard(){
  const v = document.getElementById('view');
  const o = await api('/admin/overview?range=7d');
  const k = o.kpis;
  const kpis = [
    ['Workspaces', k.workspaces, 'amber', o.plan_distribution],
    ['Users', k.users, 'blue'],
    ['Active projects', k.projects_active, 'green'],
    ['Open tickets', k.open_tickets, 'red'],
    ['Total invoiced', money(k.total_invoiced), 'amber'],
    ['Total paid', money(k.total_paid), 'green'],
    ['Pro tenants', k.active_pro_tenants, 'blue'],
    ['New (7d)', k.new_workspaces_range, 'blue'],
  ];
  v.innerHTML = `
    <div class="kpis">${kpis.map(([l,n,c])=>`<div class="kpi ${c}"><div class="kpi-n">${n}</div><div class="kpi-l">${l}</div></div>`).join('')}</div>
    <div class="grid2">
      <div class="panel">
        <h2><span class="dot"></span>Plan distribution</h2>
        ${o.plan_distribution.length?`<table><thead><tr><th>Plan</th><th>Tenants</th><th></th></tr></thead><tbody>${
          o.plan_distribution.map(p=>`<tr><td>${esc(p.plan)}</td><td>${p.n}</td><td><div class="bar"><span style="width:${Math.round(p.n/Math.max(...o.plan_distribution.map(x=>x.n))*100)}%"></span></div></td></tr>`).join('')
        }</tbody></table>`:'<div class="empty">No tenants yet.</div>'}
      </div>
      <div class="panel">
        <h2><span class="dot"></span>Open tickets by priority</h2>
        ${o.ticket_priority.length?`<table><thead><tr><th>Priority</th><th>Count</th></tr></thead><tbody>${
          o.ticket_priority.map(t=>`<tr><td>${pill(t.priority, t.priority)}</td><td>${t.n}</td></tr>`).join('')
        }</tbody></table>`:'<div class="empty">No open tickets.</div>'}
        <div style="margin-top:16px"><button class="btn btn-ghost btn-sm" onclick="showView('support')">View support queue →</button></div>
      </div>
    </div>`;
}

/* ---------- TENANTS ---------- */
let tenantFilters = {q:'',plan:'',status:''};
async function renderTenants(){
  const v = document.getElementById('view');
  const qs = new URLSearchParams(tenantFilters).toString();
  const { tenants } = await api('/admin/tenants'+(qs?'?'+qs:''));
  v.innerHTML = `
    <div class="filters">
      <input type="search" id="tq" placeholder="Search name / company / id…" value="${esc(tenantFilters.q)}"/>
      <select id="tplan"><option value="">All plans</option><option value="free">free</option><option value="pro">pro</option><option value="enterprise">enterprise</option></select>
      <select id="tstatus"><option value="">All status</option><option value="active">active</option><option value="suspended">suspended</option></select>
      <button class="btn btn-primary btn-sm" id="tapply">Apply</button>
      <button class="btn btn-ghost btn-sm" id="treset">Reset</button>
    </div>
    <div class="panel">
      <h2><span class="dot"></span>Tenants <span class="mini">(${tenants.length})</span></h2>
      ${tenants.length?`<table><thead><tr><th>Workspace</th><th>Plan</th><th>Users</th><th>Projects</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead><tbody>${
        tenants.map(w=>`<tr>
          <td><b>${esc(w.name||w.company||'—')}</b><br><span class="mini">${shortId(w.id)}</span></td>
          <td>${pill(w.plan||'free', w.plan)}</td>
          <td>${w.users}</td><td>${w.projects}</td><td>${fmt(w.created_at)}</td>
          <td>${w.suspended?pill('suspended','suspended'):pill('active','active')}</td>
          <td><div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="openTenant('${w.id}')">Manage</button>
            <button class="btn ${w.suspended?'btn-ghost':'btn-danger'} btn-sm" onclick="toggleSuspend('${w.id}', ${!w.suspended})">${w.suspended?'Reactivate':'Suspend'}</button>
          </div></td></tr>`).join('')
      }</tbody></table>`:'<div class="empty">No tenants match.</div>'}
    </div>`;
  document.getElementById('tapply').onclick = ()=>{
    tenantFilters = { q:document.getElementById('tq').value, plan:document.getElementById('tplan').value, status:document.getElementById('tstatus').value };
    renderTenants();
  };
  document.getElementById('treset').onclick = ()=>{ tenantFilters={q:'',plan:'',status:''}; renderTenants(); };
}

async function toggleSuspend(id, suspend){
  try{ await api(`/admin/tenants/${id}`, {method:'PUT', body:JSON.stringify({suspended:suspend})}); toast(suspend?'Tenant suspended':'Tenant reactivated'); renderTenants(); }
  catch(e){ toast('Action failed: '+(e.error||'error'),'error'); }
}

async function openTenant(id){
  const { tenant, users, projects, activity, invoiced } = await api(`/admin/tenants/${id}`);
  openModal(`Tenant · ${esc(tenant.name||tenant.company||'—')}`, `
    <div class="mini">ID: ${tenant.id}</div>
    <label>Plan</label>
    <select id="mPlan"><option value="free" ${tenant.plan==='free'?'selected':''}>free</option><option value="pro" ${tenant.plan==='pro'?'selected':''}>pro</option><option value="enterprise" ${tenant.plan==='enterprise'?'selected':''}>enterprise</option></select>
    <label>Status</label>
    <div>${tenant.suspended?pill('suspended','suspended'):pill('active','active')} · invoiced ${money(invoiced)}</div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" onclick="saveTenant('${id}')">Save changes</button>
  `);
  // user + project lists
  const body = document.querySelector('.modal .m-body');
  const extra = document.createElement('div');
  extra.innerHTML = `
    <label>Users (${users.length})</label>
    <div class="mini">${users.map(u=>`${esc(u.name)} · ${esc(u.email)} ${u.is_platform_admin?pill('admin','admin'):''}`).join('<br>')||'none'}</div>
    <label style="margin-top:12px">Recent projects (${projects.length})</label>
    <table><tbody>${
      projects.slice(0,8).map(p=>`<tr><td>${esc(p.name)}</td><td>${pill(p.status, p.status)}</td><td>${money(p.value)}</td><td>${p.pct||0}%</td></tr>`).join('')||'<tr><td class="mini">none</td></tr>'
    }</tbody></table>
    <label style="margin-top:12px">Danger zone</label>
    <button class="btn btn-danger btn-sm" onclick="deleteTenant('${id}')">Delete tenant (irreversible)</button>`;
  body.appendChild(extra);
}
async function saveTenant(id){
  try{ await api(`/admin/tenants/${id}`, {method:'PUT', body:JSON.stringify({plan:document.getElementById('mPlan').value})}); toast('Tenant updated'); closeModal(); renderTenants(); }
  catch(e){ toast('Update failed: '+(e.error||'error'),'error'); }
}
async function deleteTenant(id){
  if(!confirm('Permanently delete this tenant and ALL its data? This cannot be undone.')) return;
  try{ await api(`/admin/tenants/${id}`, {method:'DELETE'}); toast('Tenant deleted'); closeModal(); renderTenants(); }
  catch(e){ toast('Delete failed: '+(e.error||'error'),'error'); }
}

/* ---------- USERS ---------- */
let userFilters = {q:'',role:'',admin:''};
async function renderUsers(){
  const v = document.getElementById('view');
  const qs = new URLSearchParams(userFilters).toString();
  const { users } = await api('/admin/users'+(qs?'?'+qs:''));
  v.innerHTML = `
    <div class="filters">
      <input type="search" id="uq" placeholder="Search name / email…" value="${esc(userFilters.q)}"/>
      <select id="urole"><option value="">All roles</option><option value="owner">owner</option><option value="director">director</option><option value="admin">admin</option><option value="site">site</option><option value="member">member</option></select>
      <select id="uadmin"><option value="">All</option><option value="1">Platform admins</option><option value="0">Non-admins</option></select>
      <button class="btn btn-primary btn-sm" id="uapply">Apply</button>
      <button class="btn btn-ghost btn-sm" id="ureset">Reset</button>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" onclick="openGrantAdmin()">+ Grant admin by email</button>
    </div>
    <div class="panel">
      <h2><span class="dot"></span>Users <span class="mini">(${users.length})</span></h2>
      ${users.length?`<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Workspace</th><th>Admin</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${
        users.map(u=>`<tr>
          <td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td>
          <td>${pill(u.role, u.role)}</td><td>${esc(u.workspace||'—')}</td>
          <td>${u.is_platform_admin?pill('admin','admin'):'—'}</td>
          <td>${u.disabled?pill('disabled','disabled'):pill('active','active')}</td>
          <td>${fmt(u.created_at)}</td>
          <td><div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="toggleDisable('${u.id}', ${!u.disabled})">${u.disabled?'Enable':'Disable'}</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleAdmin('${u.id}', ${!u.is_platform_admin})">${u.is_platform_admin?'Revoke':'Make admin'}</button>
          </div></td></tr>`).join('')
      }</tbody></table>`:'<div class="empty">No users match.</div>'}
    </div>`;
  document.getElementById('uapply').onclick = ()=>{
    userFilters = { q:document.getElementById('uq').value, role:document.getElementById('urole').value, admin:document.getElementById('uadmin').value };
    renderUsers();
  };
  document.getElementById('ureset').onclick = ()=>{ userFilters={q:'',role:'',admin:''}; renderUsers(); };
}
async function toggleDisable(id, disable){
  try{ await api(`/admin/users/${id}/disable`, {method:'POST', body:JSON.stringify({disabled:disable})}); toast(disable?'User disabled':'User enabled'); renderUsers(); }
  catch(e){ toast('Action failed: '+(e.error||'error'),'error'); }
}
async function toggleAdmin(id, grant){
  try{ await api(`/admin/users/${id}/grant-admin`, {method:'POST', body:JSON.stringify({grant})}); toast(grant?'Granted platform admin':'Revoked platform admin'); renderUsers(); }
  catch(e){ toast('Action failed: '+(e.error||'error'),'error'); }
}
function openGrantAdmin(){
  openModal('Grant platform admin', `
    <label>User email</label>
    <input id="gaEmail" placeholder="admin@company.com"/>
    <div class="mini">Grants cross-tenant /api/admin/* access. Revocable any time.</div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="doGrantAdmin()">Grant</button>
  `);
}
async function doGrantAdmin(){
  const email = document.getElementById('gaEmail').value;
  try{ await api('/admin/operator/grant-admin', {method:'POST', body:JSON.stringify({email, grant:true})}); toast('Platform admin granted'); closeModal(); renderUsers(); }
  catch(e){ toast((e.error==='user_not_found'?'No user with that email.':'Failed: '+(e.error||'error')),'error'); }
}

/* ---------- BILLING ---------- */
async function renderBilling(){
  const v = document.getElementById('view');
  const b = await api('/admin/billing');
  const invs = await api('/admin/billing/invoices');
  v.innerHTML = `
    <div class="kpis">
      <div class="kpi amber"><div class="kpi-n">${money(b.total_invoiced)}</div><div class="kpi-l">Total invoiced</div></div>
      <div class="kpi green"><div class="kpi-n">${money(b.total_paid)}</div><div class="kpi-l">Total paid</div></div>
      <div class="kpi blue"><div class="kpi-n">${b.recurring_tenants}</div><div class="kpi-l">Pro tenants</div></div>
      <div class="kpi"><div class="kpi-n">${b.invoices_by_status.length}</div><div class="kpi-l">Invoice states</div></div>
    </div>
    <div class="grid2">
      <div class="panel">
        <h2><span class="dot"></span>Plan distribution</h2>
        <table><thead><tr><th>Plan</th><th>Tenants</th><th>Active</th></tr></thead><tbody>${
          b.plan_distribution.map(p=>`<tr><td>${pill(p.plan,p.plan)}</td><td>${p.tenants}</td><td>${p.active}</td></tr>`).join('')||'<tr><td class="mini">none</td></tr>'
        }</tbody></table>
        <h2 style="margin-top:18px"><span class="dot"></span>Invoices by status</h2>
        <table><thead><tr><th>Status</th><th>Count</th><th>Total</th></tr></thead><tbody>${
          b.invoices_by_status.map(s=>`<tr><td>${pill(s.status,s.status)}</td><td>${s.n}</td><td>${money(s.total)}</td></tr>`).join('')||'<tr><td class="mini">none</td></tr>'
        }</tbody></table>
      </div>
      <div class="panel">
        <h2><span class="dot"></span>Top tenants by invoiced value</h2>
        <table><thead><tr><th>Tenant</th><th>Plan</th><th>Invoiced</th><th>Invoices</th></tr></thead><tbody>${
          b.top_tenants.map(t=>`<tr><td>${esc(t.name||'—')} ${t.suspended?pill('suspended','suspended'):''}</td><td>${pill(t.plan,t.plan)}</td><td>${money(t.invoiced)}</td><td>${t.invoices}</td></tr>`).join('')||'<tr><td class="mini">none</td></tr>'
        }</tbody></table>
      </div>
    </div>
    <div class="panel">
      <h2><span class="dot"></span>Recent invoices</h2>
      <table><thead><tr><th>ID</th><th>Tenant</th><th>Client</th><th>Amount</th><th>Status</th><th>Issued</th><th>Due</th></tr></thead><tbody>${
        invs.invoices.slice(0,40).map(i=>`<tr><td>${esc(i.id)}</td><td>${esc(i.tenant||'—')}</td><td>${esc(i.client||'—')}</td><td>${money(i.amount)}</td><td>${pill(i.status,i.status)}</td><td>${fmt(i.issued)}</td><td>${fmt(i.due)}</td></tr>`).join('')||'<tr><td class="mini">none</td></tr>'
      }</tbody></table>
    </div>`;
}

/* ---------- SUPPORT ---------- */
let supportFilters = {status:''};
async function renderSupport(){
  const v = document.getElementById('view');
  const qs = supportFilters.status?('?status='+supportFilters.status):'';
  const { tickets } = await api('/admin/support/tickets'+qs);
  v.innerHTML = `
    <div class="filters">
      <select id="sstatus"><option value="">All</option><option value="open">open</option><option value="in_progress">in_progress</option><option value="resolved">resolved</option><option value="closed">closed</option></select>
      <button class="btn btn-primary btn-sm" id="sapply">Apply</button>
      <button class="btn btn-ghost btn-sm" id="sreset">Reset</button>
    </div>
    <div class="panel">
      <h2><span class="dot"></span>Tickets <span class="mini">(${tickets.length})</span></h2>
      ${tickets.length?`<table><thead><tr><th>Subject</th><th>From</th><th>Priority</th><th>Status</th><th>Received</th><th>Actions</th></tr></thead><tbody>${
        tickets.map(t=>`<tr>
          <td><b>${esc(t.subject)}</b></td><td>${esc(t.email)}<br><span class="mini">${esc(t.name)}</span></td>
          <td>${pill(t.priority,t.priority)}</td>
          <td><select onchange="setTicketStatus('${t.id}', this.value)" style="padding:3px 8px;border-radius:8px;background:var(--bg2);color:var(--t1);border:0.5px solid var(--hair);font-size:12px">${
            ['open','in_progress','resolved','closed'].map(s=>`<option value="${s}" ${s===t.status?'selected':''}>${s.replace('_',' ')}</option>`).join('')
          }</select></td>
          <td>${fmtTime(t.created_at)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="openTicket('${t.id}')">View</button></td>
        </tr>`).join('')
      }</tbody></table>`:'<div class="empty">No tickets.</div>'}
    </div>`;
  document.getElementById('sapply').onclick = ()=>{ supportFilters={status:document.getElementById('sstatus').value}; renderSupport(); };
  document.getElementById('sreset').onclick = ()=>{ supportFilters={status:''}; renderSupport(); };
}
async function setTicketStatus(id, status){
  try{ await api(`/admin/support/tickets/${id}`, {method:'PUT', body:JSON.stringify({status})}); toast('Ticket → '+status.replace('_',' ')); }
  catch(e){ toast('Update failed: '+(e.error||'error'),'error'); renderSupport(); }
}
async function openTicket(id){
  const { ticket } = await api(`/admin/support/tickets/${id}`);
  openModal(`Ticket · ${esc(ticket.subject)}`, `
    <div class="mini">From: ${esc(ticket.name)} &lt;${esc(ticket.email)}&gt;</div>
    <div>${pill(ticket.priority,t.priority)} ${pill(ticket.status,ticket.status)} · ${fmtTime(ticket.created_at)}</div>
    <div style="background:var(--bg2);border:0.5px solid var(--hair);border-radius:10px;padding:12px;margin-top:8px;white-space:pre-wrap">${esc(ticket.message)}</div>
    <label style="margin-top:12px">Reply / internal note</label>
    <textarea id="tReply" rows="3" placeholder="Optional…">${esc(ticket.reply||'')}</textarea>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    <button class="btn btn-primary" onclick="saveTicket('${id}')">Save</button>
  `);
}
async function saveTicket(id){
  const reply = document.getElementById('tReply').value;
  try{ await api(`/admin/support/tickets/${id}`, {method:'PUT', body:JSON.stringify({reply, status:document.querySelector('.modal select')?.value})}); toast('Ticket saved'); closeModal(); renderSupport(); }
  catch(e){ toast('Save failed: '+(e.error||'error'),'error'); }
}

/* ---------- ACTIVITY ---------- */
async function renderActivity(){
  const v = document.getElementById('view');
  const { activity } = await api('/admin/activity?limit=100');
  v.innerHTML = `<div class="panel"><h2><span class="dot"></span>Cross-tenant activity</h2>${
    activity.length?`<table><thead><tr><th>When</th><th>Tenant</th><th>Kind</th><th>Event</th><th>Detail</th></tr></thead><tbody>${
      activity.map(a=>`<tr><td class="mini">${fmtTime(a.at)}</td><td>${esc(a.workspace_name||shortId(a.workspace_id))}</td><td>${pill(a.kind,a.kind)}</td><td>${esc(a.title)}</td><td class="mini">${esc(a.sub||'')}</td></tr>`).join('')
    }</tbody></table>`:'<div class="empty">No activity recorded.</div>'}</div>`;
}

/* ---------- SYSTEM ---------- */
async function renderSystem(){
  const v = document.getElementById('view');
  let health = {};
  try{ health = await api('/health'); }catch(e){ health = {status:'down'}; }
  let audit = {audit:[]};
  try{ audit = await api('/admin/audit?limit=50'); }catch(e){}
  v.innerHTML = `
    <div class="kpis">
      <div class="kpi ${health.status==='ok'?'green':'red'}"><div class="kpi-n">${health.status||'?'}</div><div class="kpi-l">API status</div></div>
      <div class="kpi"><div class="kpi-n">v${esc(health.version||'?')}</div><div class="kpi-l">Build</div></div>
      <div class="kpi ${health.db==='up'?'green':'red'}"><div class="kpi-n">${health.db||'?'}</div><div class="kpi-l">Database</div></div>
      <div class="kpi"><div class="kpi-n">${health.streams||0}</div><div class="kpi-l">Live streams</div></div>
    </div>
    <div class="grid2">
      <div class="panel">
        <h2><span class="dot"></span>Operator audit trail</h2>
        ${audit.audit.length?`<table><thead><tr><th>When</th><th>Operator</th><th>Action</th><th>Target</th></tr></thead><tbody>${
          audit.audit.map(a=>`<tr><td class="mini">${fmtTime(a.created_at)}</td><td class="mini">${esc(a.actor)}</td><td>${esc(a.action)}</td><td class="mini">${esc(a.target||'')}</td></tr>`).join('')
        }</tbody></table>`:'<div class="empty">No operator actions logged yet.</div>'}
      </div>
      <div class="panel">
        <h2><span class="dot"></span>Broadcast notice</h2>
        <label>Title</label>
        <input id="bTitle" placeholder="Scheduled maintenance"/>
        <label style="margin-top:12px">Message</label>
        <textarea id="bBody" rows="4" placeholder="We'll be upgrading…"></textarea>
        <button class="btn btn-primary" style="margin-top:12px" onclick="doBroadcast()">Send to all active tenants</button>
        <div class="mini" style="margin-top:8px">Delivered via realtime bus + a per-workspace notification row.</div>
      </div>
    </div>`;
}
async function doBroadcast(){
  const title = document.getElementById('bTitle').value;
  const body = document.getElementById('bBody').value;
  if(!title||!body){ toast('Title and message required','error'); return; }
  try{ const r = await api('/admin/operator/broadcast', {method:'POST', body:JSON.stringify({title, body, kind:'system'})}); toast(`Broadcast delivered to ${r.delivered} tenants`); }
  catch(e){ toast('Broadcast failed: '+(e.error||'error'),'error'); }
}

/* ---------- SETTINGS ---------- */
async function renderSettings(){
  const v = document.getElementById('view');
  v.innerHTML = `
    <div class="panel">
      <h2><span class="dot"></span>Session</h2>
      <div class="mini">Signed in as <b id="setEmail">${esc(localStorage.getItem('cb_admin_email')||'admin')}</b>. Platform-admin access is enforced server-side on every /api/admin/* request.</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="document.getElementById('logoutBtn').click()">Sign out</button>
    </div>
    <div class="panel">
      <h2><span class="dot"></span>Platform actions</h2>
      <div class="row-actions">
        <button class="btn btn-ghost" onclick="openGrantAdmin()">Grant platform admin</button>
        <button class="btn btn-ghost" onclick="showView('tenants')">Manage tenants</button>
        <button class="btn btn-ghost" onclick="showView('support')">Open support queue</button>
      </div>
    </div>
    <div class="panel">
      <h2><span class="dot"></span>Security notes</h2>
      <ul class="mini" style="margin:0;padding-left:18px;line-height:1.8">
        <li>Operator authority is gated on the <code>is_platform_admin</code> flag — never on the tenant <code>role</code>.</li>
        <li>Every privileged action (suspend, delete, grant, broadcast) is written to the tamper-evident hash-chained audit log.</li>
        <li>Disabled accounts cannot authenticate; suspension disables a whole tenant without deleting data.</li>
        <li>JWTs carry only {uid, ws}; the admin flag is resolved live from the DB on every request.</li>
      </ul>
    </div>`;
}

/* ---------- modal helpers ---------- */
function openModal(title, bodyHtml, footHtml){
  const host = document.getElementById('modalHost');
  host.innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="m-head"><h3>${esc(title)}</h3><button class="x" onclick="closeModal()">×</button></div>
      <div class="m-body">${bodyHtml}</div>
      <div class="m-foot">${footHtml}</div>
    </div></div>`;
}
function closeModal(){ document.getElementById('modalHost').innerHTML=''; }

/* ---------- boot ---------- */
if(TOKEN){
  // validate token + admin flag before showing app
  (async ()=>{
    try{
      const r = await fetch(API+'/auth/me', {headers:{authorization:'Bearer '+TOKEN}});
      if(!r.ok) throw new Error('unauthorized');
      const { user } = await r.json();
      if(user.is_platform_admin !== true) throw new Error('forbidden');
      localStorage.setItem('cb_admin_email', user.email);
      enterApp(user);
    }catch(e){ TOKEN=null; localStorage.removeItem('cb_admin_token'); }
  })();
}
