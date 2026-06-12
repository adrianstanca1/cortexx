// Cortexx — full app screens (Projects, Tasks, Team, Safety)
// Plus shared sub-atoms used by main app

// ── Shared atoms for app screens ────────────────────────────
const Section = ({ title, action, children, pad = 16 }) => (
  <div style={{ marginBottom: 16 }}>
    {title && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 20px 8px' }}>
        <div style={{ fontFamily: SF, fontSize: 12, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</div>
        {action && <button style={{ background: 'none', border: 'none', color: T.blueL, fontFamily: SF, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{action}</button>}
      </div>
    )}
    <div style={{ padding: `0 ${pad}px` }}>{children}</div>
  </div>
);

const GroupedList = ({ children }) => (
  <div style={{ background: T.bg2, borderRadius: 14, overflow: 'hidden', border: `0.5px solid ${T.hair}` }}>{children}</div>
);

const Row = ({ icon, iconBg, title, sub, right, danger, isLast, onClick }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px',
    borderBottom: isLast ? 'none' : `0.5px solid ${T.hair}`,
    cursor: onClick ? 'pointer' : 'default',
  }}>
    {icon && (
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: iconBg ? `${iconBg}22` : `${T.blue}22`,
        color: danger ? T.red : (iconBg || T.blueL),
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{React.cloneElement(icon, { size: 17 })}</div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: SF, fontSize: 15, fontWeight: 500, color: danger ? T.red : T.t1, lineHeight: 1.25 }}>{title}</div>
      {sub && <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 2 }}>{sub}</div>}
    </div>
    {right ?? (onClick && <div style={{ color: T.t3 }}>{Ic.chevR}</div>)}
  </div>
);

const SegControl = ({ value, onChange, options, accent = T.blue }) => (
  <div style={{
    background: T.bg1, borderRadius: 9, padding: 3,
    display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 2,
    border: `0.5px solid ${T.hair}`,
  }}>
    {options.map(o => {
      const active = value === o.k;
      return (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          background: active ? T.bg3 : 'transparent',
          border: 'none', borderRadius: 7,
          padding: '7px 8px',
          fontFamily: SF, fontSize: 13, fontWeight: 600,
          color: active ? T.t1 : T.t2, cursor: 'pointer',
          boxShadow: active ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
        }}>{o.l}{o.n != null && <span style={{ color: T.t3, marginLeft: 4, fontFamily: SFMono }}>{o.n}</span>}</button>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════════
// Date helpers — convert ISO due dates to human-readable
const daysUntil = (iso) => {
  if (!iso) return null;
  const today = new Date('2026-05-22');
  const d = new Date(iso);
  return Math.ceil((d - today) / (24*60*60*1000));
};
const formatDue = (iso, status) => {
  if (status === 'complete') return 'Done';
  if (status === 'quoting') return '—';
  const days = daysUntil(iso);
  if (days == null) return '—';
  if (days < 0) return `${-days}d late`;
  if (days === 0) return 'Today';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days/7)}wk`;
  return `${Math.round(days/30)}mo`;
};
const STATUS_C = { active: T.blue, snagging: T.amber, quoting: T.purple, complete: T.green };
const fmt = n => '£' + (n >= 1000 ? (n/1000).toFixed(0) + 'k' : n);

function ProjectsScreen({ openProject, accent }) {
  const [seg, setSeg] = React.useState('active');
  const projects = useDB('projects');
  const counts = {
    all: projects.length,
    active: projects.filter(p => ['active','snagging'].includes(p.status)).length,
    pipeline: projects.filter(p => p.status === 'quoting').length,
    closed: projects.filter(p => p.status === 'complete').length,
  };
  const filtered = seg === 'all' ? projects
    : seg === 'active' ? projects.filter(p => ['active','snagging'].includes(p.status))
    : seg === 'pipeline' ? projects.filter(p => p.status === 'quoting')
    : projects.filter(p => p.status === 'complete');

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 150 }}>
        <MobileHeader
          title="Projects"
          subtitle={`${projects.length} total · ${counts.active} active`}
          right={<div style={{ display: 'flex', gap: 8 }}>
            <HeaderBtn icon={Ic.search} onClick={() => window.cortexxNav('search')}/>
            <button onClick={() => window.cortexxNav('addproject')} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {React.cloneElement(Ic.plus, { size: 20 })}
            </button>
          </div>}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <SegControl value={seg} onChange={setSeg} options={[
            { k: 'all', l: 'All', n: counts.all },
            { k: 'active', l: 'Active', n: counts.active },
            { k: 'pipeline', l: 'Pipeline', n: counts.pipeline },
            { k: 'closed', l: 'Closed', n: counts.closed },
          ]} accent={accent}/>
        </div>

        {/* Summary strip */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { l: 'Pipeline', v: '£' + (projects.reduce((s,p)=>s+p.value,0)/1000).toFixed(0) + 'k', c: T.t1 },
            { l: 'In progress', v: counts.active, c: accent },
            { l: 'Avg margin', v: '24%', c: T.green },
          ].map((s,i) => (
            <div key={i} style={{ background: T.bg2, borderRadius: 10, padding: '8px 10px', border: `0.5px solid ${T.hair}` }}>
              <div style={{ fontFamily: SF, fontSize: 9, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.l}</div>
              <div style={{ fontFamily: SFMono, fontSize: 16, color: s.c, fontWeight: 700, marginTop: 2, letterSpacing: -0.3 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Project cards */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => openProject(p)}
              onPointerDown={e => e.currentTarget.style.transform = 'scale(0.985)'}
              onPointerUp={e => e.currentTarget.style.transform = ''}
              onPointerLeave={e => e.currentTarget.style.transform = ''}
              style={{
              background: T.bg2, borderRadius: 14, padding: 14,
              border: `0.5px solid ${T.hair}`, cursor: 'pointer',
              transition: 'transform 0.12s ease, border-color 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SF, fontSize: 16, fontWeight: 600, color: T.t1, lineHeight: 1.2 }}>{p.name}</div>
                  <div style={{ fontFamily: SF, fontSize: 12, color: T.t2, marginTop: 3 }}>{p.client} · {p.addr}</div>
                </div>
                <Pill c={STATUS_C[p.status]}>{p.status}</Pill>
              </div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Value</div>
                  <div style={{ fontFamily: SFMono, fontSize: 14, color: T.t1, fontWeight: 600, marginTop: 2 }}>{fmt(p.value)}</div>
                </div>
                <div style={{ width: 1, background: T.hair }}/>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Team</div>
                  <div style={{ fontFamily: SFMono, fontSize: 14, color: T.t1, fontWeight: 600, marginTop: 2 }}>{p.team || '—'}</div>
                </div>
                <div style={{ width: 1, background: T.hair }}/>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 10, color: T.t2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Due</div>
                  <div style={{ fontFamily: SFMono, fontSize: 14, color: T.t1, fontWeight: 600, marginTop: 2 }}>{formatDue(p.due, p.status)}</div>
                </div>
                <div style={{ flex: 1 }}/>
                <div style={{ alignSelf: 'flex-end', fontFamily: SFMono, fontSize: 13, color: STATUS_C[p.status], fontWeight: 600 }}>{p.pct}%</div>
              </div>
              <Bar pct={p.pct} c={STATUS_C[p.status]} h={3}/>
            </div>
          ))}
        </div>
      </div>
    </ScreenBg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════
const PRIO_C = { high: T.red, med: T.amber, low: T.t3 };

const formatTaskWhen = (iso) => {
  if (!iso) return '—';
  const days = daysUntil(iso);
  if (days < 0) return `${-days}d ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long' });
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

function TasksScreen({ accent, onAdd }) {
  const [seg, setSeg] = React.useState('todo');
  const [selected, setSelected] = React.useState(new Set());
  // Expose selection state globally so the floating TaskBulkActionBar can act on it.
  React.useEffect(() => {
    window.__cortexxTaskSel = {
      size: selected.size,
      ids: selected,
      clear: () => setSelected(new Set()),
    };
    return () => { if (window.__cortexxTaskSel?.ids === selected) window.__cortexxTaskSel = null; };
  }, [selected]);
  const tasks = useDB('tasks');
  const projects = useDB('projects');
  const todo = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const list = seg === 'todo' ? todo : done;
  const highCount = tasks.filter(t => !t.done && t.prio === 'high').length;
  const projName = (id) => projects.find(p => p.id == id)?.name || 'No project';
  const toggleTask = (id, current) => Backend.db.tasks.update(id, { done: !current });
  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const bulkComplete = async () => {
    for (const id of selected) await Backend.db.tasks.update(id, { done: true });
    toast(`${selected.size} task${selected.size !== 1 ? 's' : ''} completed`, 'success');
    setSelected(new Set());
  };
  const bulkDelete = async () => {
    for (const id of selected) await Backend.db.tasks.remove(id);
    toast(`${selected.size} task${selected.size !== 1 ? 's' : ''} deleted`, 'success');
    setSelected(new Set());
  };
  const bulkPrio = async (prio) => {
    for (const id of selected) await Backend.db.tasks.update(id, { prio });
    toast(`Priority set to ${prio}`, 'success');
    setSelected(new Set());
  };

  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 150 }}>
        <MobileHeader
          title="Tasks"
          subtitle={`${todo.length} to do · ${done.length} done`}
          right={<button onClick={() => { window.cortexxNav('addtask'); }} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {React.cloneElement(Ic.plus, { size: 20 })}
          </button>}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <SegControl value={seg} onChange={setSeg} options={[
            { k: 'todo', l: 'To do', n: todo.length },
            { k: 'done', l: 'Done', n: done.length },
          ]}/>
        </div>

        {/* Priority callout */}
        {seg === 'todo' && highCount > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: `linear-gradient(135deg, ${T.red}22, ${T.amber}22)`,
              border: `0.5px solid ${T.red}33`,
              borderRadius: 12, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ color: T.red }}>{React.cloneElement(Ic.alert, { size: 18 })}</div>
              <div style={{ flex: 1, fontFamily: SF, fontSize: 12, color: T.t1 }}>
                <strong>{highCount} high-priority</strong> task{highCount === 1 ? '' : 's'} open
              </div>
              <span style={{ color: T.t3 }}>{Ic.chevR}</span>
            </div>
          </div>
        )}

        <Section title={seg === 'todo' ? 'Your queue' : 'Completed'}>
          <GroupedList>
            {list.map((task, i) => {
              const isSelected = selected.has(task.id);
              return (
              <SwipeTaskRow key={task.id} task={task} accent={accent}
                onComplete={() => toggleTask(task.id, task.done)}
                onSelect={() => toggleSelect(task.id)}
                onTap={() => selected.size > 0 ? toggleSelect(task.id) : toggleTask(task.id, task.done)}
                isSelected={isSelected} isLast={i === list.length - 1}
                projName={projName} />
              );
            })}
          </GroupedList>
        </Section>
      </div>
    </ScreenBg>
  );
}

// Swipe-to-complete task row (touch drag reveals action, snaps back)
function SwipeTaskRow({ task, accent, onComplete, onSelect, onTap, isSelected, isLast, projName }) {
  const [dx, setDx] = React.useState(0);
  const start = React.useRef(null);
  const moved = React.useRef(false);
  const onStart = (e) => { start.current = (e.touches ? e.touches[0].clientX : e.clientX); moved.current = false; };
  const onMove = (e) => {
    if (start.current == null) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const d = Math.max(-96, Math.min(0, x - start.current));
    if (Math.abs(d) > 6) moved.current = true;
    setDx(d);
  };
  const onEnd = () => {
    if (dx < -64) { onComplete(); }
    setDx(0); start.current = null;
  };
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: isLast ? 'none' : `0.5px solid ${T.hair}` }}>
      {/* reveal action behind */}
      <div style={{ position: 'absolute', inset: 0, background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20 }}>
        <span style={{ color: '#fff', fontFamily: SF, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{React.cloneElement(Ic.check, { size: 15, sw: 3 })} {task.done ? 'Reopen' : 'Done'}</span>
      </div>
      <div
        onClick={() => { if (!moved.current) onTap(); }}
        onContextMenu={(e) => { e.preventDefault(); onSelect(); }}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', cursor: 'pointer',
          background: isSelected ? `${accent}11` : T.bg2,
          opacity: task.done ? 0.55 : 1,
          transform: `translateX(${dx}px)`,
          transition: start.current == null ? 'transform 0.2s cubic-bezier(.2,.7,.3,1)' : 'none',
          position: 'relative',
        }}>
        <div onClick={(e) => { e.stopPropagation(); onSelect(); }} style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          border: `1.5px solid ${isSelected ? accent : T.hairMid}`,
          background: isSelected ? accent : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{isSelected && <span style={{ color: '#fff' }}>{React.cloneElement(Ic.check, { size: 12, sw: 3 })}</span>}</div>
        <div style={{
          width: 22, height: 22, borderRadius: 11,
          border: task.done ? 'none' : `2px solid ${PRIO_C[task.prio]}`,
          background: task.done ? T.green : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'background 0.15s',
        }}>
          {task.done && <span style={{ color: '#fff' }}>{React.cloneElement(Ic.check, { size: 14, sw: 3 })}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: SF, fontSize: 14, fontWeight: 500, color: T.t1,
            textDecoration: task.done ? 'line-through' : 'none', lineHeight: 1.3,
          }}>{task.t}</div>
          <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 2 }}>
            {projName(task.projectId)} · {task.assignee} · {formatTaskWhen(task.due)}
          </div>
        </div>
        {!task.done && <Pill c={PRIO_C[task.prio]} size="xs">{task.prio}</Pill>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TEAM
// ═══════════════════════════════════════════════════════════════════
const STATUS_LABEL = { 'on-site': { l: 'On site', c: T.green }, 'off': { l: 'Off today', c: T.t3 } };

function TeamScreen({ accent }) {
  const team = useDB('team');
  const sites = [...new Set(team.map(t => t.site))];
  return (
    <ScreenBg accent={accent}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 150 }}>
        <MobileHeader
          title="Team"
          subtitle={`${team.length} members · ${team.filter(t=>t.status==='on-site').length} on site`}
          right={<div style={{ display: 'flex', gap: 8 }}>
            <HeaderBtn icon={Ic.search} onClick={() => window.cortexxNav('search')}/>
            <button onClick={() => window.cortexxNav('addteam')} style={{ width: 36, height: 36, borderRadius: 18, background: accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {React.cloneElement(Ic.plus, { size: 20 })}
            </button>
          </div>}
        />

        {/* Site groupings */}
        {sites.map(site => {
          const members = team.filter(t => t.site === site);
          const onSite = members.filter(t => t.status === 'on-site').length;
          return (
            <div key={site} style={{ marginBottom: 18 }}>
              <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{site}</div>
                  <div style={{ fontFamily: SF, fontSize: 11, color: T.t2 }}>{onSite}/{members.length} present</div>
                </div>
                <Pill c={onSite > 0 ? T.green : T.t3} size="xs">{onSite > 0 ? 'ACTIVE' : 'NO ONE'}</Pill>
              </div>
              <div style={{ padding: '0 16px' }}>
                <GroupedList>
                  {members.map((m, i) => (
                    <div key={m.id} onClick={() => window.cortexxNav('member', m)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      padding: '12px 14px',
                      borderBottom: i === members.length - 1 ? 'none' : `0.5px solid ${T.hair}`,
                    }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar name={m.n} size={40} c={m.color}/>
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2,
                          width: 14, height: 14, borderRadius: 7,
                          background: STATUS_LABEL[m.status].c,
                          border: `2px solid ${T.bg2}`,
                        }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: SF, fontSize: 14, fontWeight: 600, color: T.t1 }}>{m.n}</div>
                        <div style={{ fontFamily: SF, fontSize: 11, color: T.t2, marginTop: 1 }}>{m.r} · CSCS {m.cscs}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: SFMono, fontSize: 13, color: T.t1, fontWeight: 600 }}>{m.hours}h</div>
                        <div style={{ fontFamily: SF, fontSize: 10, color: T.t3 }}>this wk</div>
                      </div>
                    </div>
                  ))}
                </GroupedList>
              </div>
            </div>
          );
        })}
      </div>
    </ScreenBg>
  );
}

Object.assign(window, {
  Section, GroupedList, Row, SegControl,
  STATUS_C, fmt, daysUntil, formatDue, formatTaskWhen, PRIO_C,
  ProjectsScreen, TasksScreen, TeamScreen,
});
