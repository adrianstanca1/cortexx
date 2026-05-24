import { useState, useMemo } from 'react';
import { ClipboardCheck, Plus, Search, CheckCircle, XCircle, Clock, Edit2, Trash2, X, ChevronDown, ChevronUp, CheckSquare, Square, BarChart3, PieChart, Download, TrendingUp, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useInspections } from '../../hooks/useData';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { BarChart, Bar, AreaChart, Area, PieChart as PieChartComponent, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type AnyRow = Record<string, unknown>;

const STATUS_OPTIONS = ['Scheduled','In Progress','Passed','Failed','Conditional Pass','Cancelled'];
const INSPECTION_TYPES = ['Structural','Electrical','Fire Safety','MEWP','Scaffold','Environmental','Quality'];

const INSPECTION_CHECKLISTS: Record<string, string[]> = {
  'Structural': [
    'Foundation integrity check',
    'Structural cracks assessment',
    'Load-bearing walls inspection',
    'Concrete strength verification',
    'Reinforcement placement check',
    'Joint integrity inspection',
    'Deflection measurements',
    'Finishing quality verification',
    'Connections integrity check',
    'Safety barriers installation'
  ],
  'Electrical': [
    'Earthing system test',
    'Insulation resistance check',
    'Circuit breaker operation',
    'Cable sizing verification',
    'Termination quality check',
    'Cable segregation compliance',
    'Labeling completeness',
    'Emergency lighting test',
    'RCD device functionality',
    'Phase rotation verification',
    'Load distribution check',
    'Documentation completeness'
  ],
  'Fire Safety': [
    'Fire door installation',
    'Fire rating certification',
    'Compartmentalization check',
    'Fire escape route clearance',
    'Emergency lighting functionality',
    'Exit signage visibility',
    'Smoke detection installation',
    'Sprinkler system test',
    'Fire extinguisher placement',
    'Fire safety plan availability'
  ],
  'MEWP': [
    'Machine inspection certificate',
    'Hydraulic system pressure test',
    'Structural integrity check',
    'Safety harness installation',
    'Control system functionality',
    'Emergency descent verification',
    'Load test completion',
    'Safety label placement'
  ],
  'Scaffold': [
    'Scaffold certification validity',
    'Joint and coupler condition',
    'Base plate stability',
    'Guard rail installation',
    'Toe board installation',
    'Access provision check',
    'Load capacity verification',
    'Debris netting installation'
  ],
  'Environmental': [
    'Waste segregation compliance',
    'Noise monitoring records',
    'Dust control effectiveness',
    'Water management compliance',
    'Contamination prevention measures',
    'Environmental permits display',
    'Spillage containment check',
    'Wildlife protection measures'
  ],
  'Quality': [
    'Dimensional accuracy check',
    'Surface finish quality',
    'Material certification review',
    'Workmanship inspection',
    'Installation sequence verification',
    'Testing documentation complete',
    'Defect register accuracy',
    'Photos and records available'
  ]
};

const _statusColour: Record<string,string> = {
  'Scheduled':'bg-blue-900/30 text-blue-300','In Progress':'bg-yellow-900/30 text-yellow-300',
  'Passed':'bg-green-900/30 text-green-300','Failed':'bg-red-900/30 text-red-300',
  'Conditional Pass':'bg-orange-900/30 text-orange-300','Cancelled':'bg-gray-700/50 text-gray-400',
};

const emptyForm = { title:'',inspection_type:'Quality',inspection_date:'',inspector:'',location:'',status:'Scheduled',checklist_items: [] as AnyRow[],defect_count: 0,overall_score:0,project_id:'',next_due:'',notes:'' };

export function Inspections() {
  const { useList, useCreate, useUpdate, useDelete } = useInspections;
  const { data: raw = [], isLoading } = useList();
  const inspections = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState('results');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formChecklist, setFormChecklist] = useState<{item: string; result: 'pass'|'fail'|'na'; defect?: string}[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reportExportFormat, setReportExportFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const today = new Date().toISOString().slice(0,10);

  const filtered = inspections.filter(i => {
    const title = String(i.title??'').toLowerCase();
    const matchSearch = title.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    const matchType = typeFilter === 'All' || i.inspection_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const scheduledCount = inspections.filter(i=>i.status==='Scheduled').length;
  const passedCount = inspections.filter(i=>i.status==='Passed').length;
  const failedCount = inspections.filter(i=>i.status==='Failed').length;
  const dueSoon = inspections.filter(i => {
    if (!i.next_due) return false;
    const diff = (new Date(String(i.next_due)).getTime()-Date.now())/86400000;
    return diff >= 0 && diff <= 14;
  }).length;

  function getScoreColour(score: number) {
    if (score >= 90) return { bg: 'bg-green-900/30', border: 'border-green-700', text: 'text-green-300', label: 'PASS' };
    if (score >= 75) return { bg: 'bg-yellow-900/30', border: 'border-yellow-700', text: 'text-yellow-300', label: 'CONDITIONAL' };
    return { bg: 'bg-red-900/30', border: 'border-red-700', text: 'text-red-300', label: 'FAIL' };
  }

  function openCreate() { setEditing(null); setForm({ ...emptyForm, inspection_date:today, inspection_type:'Quality' }); setShowModal(true); }

  function openFormModal(type: string) {
    const items = INSPECTION_CHECKLISTS[type] || [];
    setFormChecklist(items.map(item => ({ item, result: 'pass' as const })));
    setForm(f => ({ ...f, inspection_type: type }));
    setShowFormModal(true);
  }

  function openEdit(i: AnyRow) {
    setEditing(i);
    setForm({ title:String(i.title??''),inspection_type:String(i.inspection_type??'Quality'),inspection_date:String(i.inspection_date??''),inspector:String(i.inspector??''),location:String(i.location??''),status:String(i.status??'Scheduled'),checklist_items: Array.isArray(i.checklist_items) ? i.checklist_items : [],defect_count: Number(i.defect_count??0),overall_score: Number(i.overall_score??0),project_id:String(i.project_id??''),next_due:String(i.next_due??''),notes:String(i.notes??'') });
    setShowModal(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const passCount = formChecklist.filter(c => c.result === 'pass').length;
    const totalApplicable = formChecklist.filter(c => c.result !== 'na').length;
    const score = totalApplicable > 0 ? Math.round((passCount / totalApplicable) * 100) : 0;
    const defectCount = formChecklist.filter(c => c.result === 'fail').length;

    let status = 'Passed';
    if (defectCount > 0) status = 'Failed';
    if (score >= 75 && defectCount > 0) status = 'Conditional Pass';

    const payload = { ...form, checklist_items: formChecklist, overall_score: score, defect_count: defectCount, status };

    if (editing) { await updateMutation.mutateAsync({ id:String(editing.id), data:payload }); toast.success('Inspection updated'); }
    else { await createMutation.mutateAsync(payload); toast.success('Inspection created'); }
    setShowFormModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) { await updateMutation.mutateAsync({ id:String(editing.id), data:form }); toast.success('Inspection updated'); }
    else { await createMutation.mutateAsync(form); toast.success('Inspection created'); }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this inspection?')) return;
    await deleteMutation.mutateAsync(id); toast.success('Inspection deleted');
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="inspections" />
      <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white">Inspections</h1>
          <p className="text-sm text-gray-400 mt-1">Quality, safety & compliance inspections</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={()=>openFormModal('Quality')} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
            <Plus size={16}/><span>Quick Inspection</span>
          </button>
          <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium">
            <Plus size={16}/><span>Manual Entry</span>
          </button>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <XCircle size={18} className="text-red-500"/>
          <p className="text-sm text-red-200"><span className="font-semibold">{failedCount} failed inspection{failedCount>1?'s':''}</span> — corrective actions required.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Scheduled', value:scheduledCount, colour:'text-blue-400', bg:'bg-blue-900/30', border:'border-blue-700' },
          { label:'Passed', value:passedCount, colour:'text-green-400', bg:'bg-green-900/30', border:'border-green-700' },
          { label:'Failed', value:failedCount, colour:failedCount>0?'text-red-400':'text-gray-400', bg:failedCount>0?'bg-red-900/30':'bg-gray-800', border:failedCount>0?'border-red-700':'border-gray-700' },
          { label:'Due in 14 Days', value:dueSoon, colour:dueSoon>0?'text-orange-400':'text-gray-400', bg:dueSoon>0?'bg-orange-900/30':'bg-gray-800', border:dueSoon>0?'border-orange-700':'border-gray-700' },
        ].map(kpi=>(
          <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-xl p-4`}>
            <div className="flex items-center gap-3">
              <div><p className={`text-xs ${kpi.colour}`}>{kpi.label}</p><p className="text-xl font-display text-white mt-1">{kpi.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {([
          { key:'results', label:'Results', count:inspections.length },
          { key:'defects', label:'Defects', count:inspections.reduce((sum, i) => sum + Number(i.defect_count??0), 0) },
          { key:'schedule', label:'Schedule', count:scheduledCount },
          { key:'calendar', label:'Calendar', count:scheduledCount },
          { key:'analytics', label:'Analytics', count:inspections.length },
          { key:'reports', label:'Reports', count:8 },
        ]).map(t=>(
          <button type="button"  key={t.key} onClick={()=>setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${subTab===t.key?'border-orange-500 text-orange-500':'border-transparent text-gray-400 hover:text-gray-300'}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.key==='results'?'bg-gray-700 text-gray-400':'bg-gray-700 text-gray-400'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {subTab === 'results' && (
        <>
          <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search inspections…" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"/>
            </div>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="text-sm border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {['All',...INSPECTION_TYPES].map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="text-sm border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {['All',...STATUS_OPTIONS].map(s=><option key={s}>{s}</option>)}
            </select>
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} inspections</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
          ) : (
            <div className="space-y-3">
              {filtered.length === 0 && (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No inspections found"
                  description="Schedule your first inspection to maintain quality assurance on site."
                />
              )}
              {filtered.map(i => {
                const id = String(i.id??'');
                const isSelected = selectedIds.has(id);
                const isExp = expanded === id;
                const score = Number(i.overall_score??0);
                const scoreColour = getScoreColour(score);
                const defectCount = Number(i.defect_count??0);
                return (
                  <div key={id} className="card bg-base-200 overflow-hidden hover:border-gray-600 transition-colors">
                    <div className="p-4 cursor-pointer hover:bg-gray-750" onClick={()=>setExpanded(isExp?null:id)}>
                      <div className="flex items-start justify-between gap-4">
                        <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                          {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{String(i.title??'Untitled')}</p>
                          <p className="text-sm text-gray-400 mt-1">{String(i.inspection_type??'')} · {String(i.inspection_date??'—')} {i.inspector?`· ${i.inspector}`:''}</p>
                        </div>
                        {score > 0 && (
                          <div className={`flex-shrink-0 px-3 py-2 rounded-lg ${scoreColour.bg} border ${scoreColour.border}`}>
                            <p className={`text-sm font-bold ${scoreColour.text}`}>{score}%</p>
                            <p className={`text-xs ${scoreColour.text}`}>{scoreColour.label}</p>
                          </div>
                        )}
                        {defectCount > 0 && (
                          <div className="flex-shrink-0 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700">
                            <p className="text-sm font-bold text-red-300">{defectCount}</p>
                            <p className="text-xs text-red-300">Defects</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button" onClick={e=>{e.stopPropagation();openEdit(i);}} className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded"><Edit2 size={14}/></button>
                          <button type="button" onClick={e=>{e.stopPropagation();handleDelete(id);}} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"><Trash2 size={14}/></button>
                          {isExp?<ChevronUp size={16} className="text-gray-500"/>:<ChevronDown size={16} className="text-gray-500"/>}
                        </div>
                      </div>
                    </div>
                    {isExp && (
                      <div className="px-6 pb-4 bg-gray-900/50 space-y-3 text-sm border-t border-gray-700">
                        {Boolean(i.notes) && <div><p className="text-xs text-gray-400 mb-1">NOTES</p><p className="text-gray-300">{String(i.notes)}</p></div>}
                        {Array.isArray(i.checklist_items) && i.checklist_items.length > 0 && (
                          <div><p className="text-xs font-semibold text-gray-400 mb-2">CHECKLIST</p>
                            <div className="space-y-1">
                              {(i.checklist_items as { result: string; item: string }[]).map((c, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  {c.result === 'pass' && <CheckCircle size={12} className="text-green-500 flex-shrink-0"/>}
                                  {c.result === 'fail' && <XCircle size={12} className="text-red-500 flex-shrink-0"/>}
                                  {c.result === 'na' && <span className="w-3 h-3 rounded-full bg-gray-600 flex-shrink-0"/>}
                                  <span className="text-gray-400">{String(c.item ?? '')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            actions={[
              { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
            ]}
            onClearSelection={clearSelection}
          />
        </>
      )}

      {subTab === 'defects' && (
        <div className="space-y-3">
          {inspections.filter(i => Number(i.defect_count??0) > 0).length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-gray-800 rounded-xl border border-gray-700"><CheckCircle size={40} className="mx-auto mb-3 opacity-30 text-green-500"/><p className="font-medium">No defects recorded</p></div>
          ) : (
            inspections.filter(i => Number(i.defect_count??0) > 0).map(i => {
              const defectCount = Number(i.defect_count??0);
              return (
                <div key={String(i.id??'')} className="card bg-base-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{String(i.title??'Untitled')}</p>
                      <p className="text-sm text-gray-400 mt-1">From: {String(i.inspection_type??'')} on {String(i.inspection_date??'—')}</p>
                      <div className="mt-2 px-2 py-1 bg-red-900/30 border border-red-700 rounded inline-block">
                        <p className="text-sm font-semibold text-red-300">{defectCount} defect{defectCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded whitespace-nowrap">Open</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {subTab === 'schedule' && (
        <div className="space-y-3">
          {scheduledCount === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-gray-800 rounded-xl border border-gray-700"><Clock size={40} className="mx-auto mb-3 opacity-30"/><p>No scheduled inspections</p></div>
          ) : (
            inspections.filter(i => i.status === 'Scheduled').map(i => (
              <div key={String(i.id??'')} className="card bg-base-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{String(i.title??'Untitled')}</p>
                    <p className="text-sm text-gray-400 mt-1">{String(i.inspection_type??'')} scheduled for {String(i.inspection_date??'—')}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-blue-900/30 border border-blue-700 text-blue-300 rounded">Scheduled</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'calendar' && <InspectionsCalendarTab inspections={inspections} />}

      {subTab === 'analytics' && <InspectionsAnalyticsTab inspections={inspections} />}

      {subTab === 'reports' && <InspectionsReportsTab reportExportFormat={reportExportFormat} setReportExportFormat={setReportExportFormat} />}

      {showFormModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">Inspection Checklist</h2>
              <button type="button" onClick={()=>setShowFormModal(false)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400"><X size={18}/></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Inspection Date</label>
                  <input type="date" value={form.inspection_date} onChange={e=>setForm(f=>({...f,inspection_date:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Inspector</label>
                  <input value={form.inspector} onChange={e=>setForm(f=>({...f,inspector:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-300">{String(form.inspection_type)} Inspection Checklist</p>
                {formChecklist.map((item, idx) => (
                  <div key={idx} className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-gray-300">{item.item}</p>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" checked={item.result === 'pass'} onChange={() => setFormChecklist(fc => [...fc.slice(0, idx), { ...item, result: 'pass' }, ...fc.slice(idx+1)])} className="accent-green-500"/>
                        <span className="text-green-400">Pass</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" checked={item.result === 'fail'} onChange={() => setFormChecklist(fc => [...fc.slice(0, idx), { ...item, result: 'fail' }, ...fc.slice(idx+1)])} className="accent-red-500"/>
                        <span className="text-red-400">Fail</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" checked={item.result === 'na'} onChange={() => setFormChecklist(fc => [...fc.slice(0, idx), { ...item, result: 'na' }, ...fc.slice(idx+1)])} className="accent-gray-500"/>
                        <span className="text-gray-400">N/A</span>
                      </label>
                    </div>
                    {item.result === 'fail' && (
                      <textarea placeholder="Describe the defect..." value={item.defect||''} onChange={e => setFormChecklist(fc => [...fc.slice(0, idx), { ...item, defect: e.target.value }, ...fc.slice(idx+1)])} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" rows={2}/>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={()=>setShowFormModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  Complete Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">{editing?'Edit Inspection':'Manual Entry'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Inspection Title *</label>
                  <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select value={form.inspection_type} onChange={e=>setForm(f=>({...f,inspection_type:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {INSPECTION_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Inspection Date</label>
                  <input type="date" value={form.inspection_date} onChange={e=>setForm(f=>({...f,inspection_date:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Inspector</label>
                  <input value={form.inspector} onChange={e=>setForm(f=>({...f,inspector:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                  <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Overall Score (%)</label>
                  <input type="number" min="0" max="100" value={form.overall_score} onChange={e=>setForm(f=>({...f,overall_score:Number(e.target.value)}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Next Due Date</label>
                  <input type="date" value={form.next_due} onChange={e=>setForm(f=>({...f,next_due:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {editing?'Update Inspection':'Create Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function InspectionsCalendarTab({ inspections }: { inspections: AnyRow[] }) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getInspectionsForDate = (day: number | null) => {
    if (day === null) return [];
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = date.toISOString().slice(0, 10);
    return inspections.filter(i => String(i.inspection_date ?? '').startsWith(dateStr));
  };

  const upcomingInspections = useMemo(() => {
    const next14Days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      next14Days.push(...inspections.filter(insp => String(insp.inspection_date ?? '').startsWith(dateStr)));
    }
    return next14Days;
  }, [inspections]);

  return (
    <div className="space-y-6 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{new Date(currentYear, currentMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => {
            const dayInspections = getInspectionsForDate(day);
            const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
            return (
              <div key={idx} className={`min-h-20 p-2 rounded-lg border ${isToday ? 'bg-blue-900/30 border-blue-700' : 'bg-gray-800 border-gray-700'} ${day === null ? 'opacity-0' : ''}`}>
                {day !== null && (
                  <>
                    <p className={`text-sm font-semibold ${isToday ? 'text-blue-300' : 'text-white'}`}>{day}</p>
                    {dayInspections.length > 0 && (
                      <div className="mt-1 inline-block px-2 py-1 bg-orange-600/30 text-orange-300 text-xs rounded font-medium">{dayInspections.length}</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Upcoming (Next 14 Days)</h3>
        {upcomingInspections.length === 0 ? (
          <p className="text-gray-400 text-sm">No inspections scheduled</p>
        ) : (
          <div className="space-y-2">
            {upcomingInspections.map(i => (
              <div key={String(i.id??'')} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-white">{String(i.title??'Untitled')}</p>
                  <p className="text-xs text-gray-400">{String(i.inspection_date??'')} · {String(i.inspection_type??'')}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${String(i.status) === 'Scheduled' ? 'bg-blue-900/30 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>{String(i.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InspectionsAnalyticsTab({ inspections }: { inspections: AnyRow[] }) {
  const passCount = inspections.filter(i => i.status === 'Passed').length;
  const failedCount = inspections.filter(i => i.status === 'Failed').length;
  const conditionalCount = inspections.filter(i => i.status === 'Conditional Pass').length;
  const scheduledCount = inspections.filter(i => i.status === 'Scheduled').length;

  const passRate = inspections.length > 0 ? Math.round((passCount / inspections.length) * 100) : 0;
  const thisMonth = inspections.filter(i => {
    const date = new Date(String(i.inspection_date ?? ''));
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const passFailData = [
    { name: 'Passed', value: passCount, fill: '#10b981' },
    { name: 'Failed', value: failedCount, fill: '#ef4444' },
    { name: 'Conditional', value: conditionalCount, fill: '#f97316' },
  ];

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    inspections.forEach(i => {
      const type = String(i.inspection_type ?? 'Other');
      counts[type] = (counts[type] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [inspections]);

  const inspectors = [
    { name: 'James Morrison', inspections: 12, passRate: 94, status: 'Excellent' },
    { name: 'Sarah Campbell', inspections: 10, passRate: 88, status: 'Good' },
    { name: 'Michael Davies', inspections: 8, passRate: 85, status: 'Good' },
    { name: 'Emma Thompson', inspections: 7, passRate: 92, status: 'Excellent' },
    { name: 'David Wilson', inspections: 6, passRate: 78, status: 'Fair' },
  ];

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">PASS RATE</p>
          <p className="text-3xl font-bold text-green-400">{passRate}%</p>
          <p className="text-xs text-gray-500 mt-1">{passCount} passed</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">THIS MONTH</p>
          <p className="text-3xl font-bold text-blue-400">{thisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">{scheduledCount} scheduled</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">FAILED</p>
          <p className="text-3xl font-bold text-red-400">{failedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Require action</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">TOTAL INSPECTIONS</p>
          <p className="text-3xl font-bold text-gray-200">{inspections.length}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Status Distribution</h3>
          {passFailData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={passFailData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No data</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">By Inspection Type</h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChartComponent>
                <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label>
                  {typeData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={['#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899'][idx % 6]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
              </PieChartComponent>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">No data</p>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Inspector Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Inspector</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Inspections</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Pass Rate</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {inspectors.map((insp, idx) => (
                <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-2 text-white font-medium">{insp.name}</td>
                  <td className="py-3 px-2 text-gray-300">{insp.inspections}</td>
                  <td className="py-3 px-2"><span className="text-green-400 font-semibold">{insp.passRate}%</span></td>
                  <td className="py-3 px-2"><span className={`text-xs px-2 py-1 rounded ${insp.status === 'Excellent' ? 'bg-green-900/30 text-green-300' : insp.status === 'Good' ? 'bg-blue-900/30 text-blue-300' : 'bg-orange-900/30 text-orange-300'}`}>{insp.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InspectionsReportsTab({ reportExportFormat, setReportExportFormat }: { reportExportFormat: 'pdf' | 'csv' | 'xlsx'; setReportExportFormat: (format: 'pdf' | 'csv' | 'xlsx') => void }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRange, setDateRange] = useState('all');

  const mockReports = [
    { id: 1, name: 'Monthly Compliance Report - March', date: '2026-03-31', status: 'Completed', inspections: 12, passRate: 92 },
    { id: 2, name: 'Q1 Site Inspection Summary', date: '2026-03-28', status: 'Completed', inspections: 34, passRate: 88 },
    { id: 3, name: 'Electrical Safety Audit', date: '2026-03-20', status: 'Completed', inspections: 8, passRate: 95 },
    { id: 4, name: 'Structural Integrity Report', date: '2026-03-15', status: 'Completed', inspections: 6, passRate: 85 },
    { id: 5, name: 'Fire Safety Compliance', date: '2026-03-10', status: 'Completed', inspections: 4, passRate: 100 },
    { id: 6, name: 'MEWP Inspection Log', date: '2026-03-05', status: 'Completed', inspections: 3, passRate: 89 },
    { id: 7, name: 'Scaffold Certification Report', date: '2026-02-28', status: 'Completed', inspections: 5, passRate: 91 },
    { id: 8, name: 'Environmental Compliance Check', date: '2026-02-20', status: 'Completed', inspections: 7, passRate: 87 },
  ];

  const handleExport = (report: typeof mockReports[0], format: 'pdf' | 'csv' | 'xlsx') => {
    toast.success(`Exported ${report.name} as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option>All</option>
              <option>Completed</option>
              <option>Pending</option>
              <option>Draft</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Date Range</label>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Export Format</label>
            <select value={reportExportFormat} onChange={e => setReportExportFormat(e.target.value as 'pdf' | 'csv' | 'xlsx')} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {mockReports.map(report => (
          <div key={report.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors">
            <div className="flex-1">
              <p className="font-semibold text-white">{report.name}</p>
              <div className="flex gap-4 mt-2 text-sm text-gray-400">
                <span>{report.date}</span>
                <span>{report.inspections} inspections</span>
                <span className="text-green-400">{report.passRate}% pass rate</span>
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <button type="button" onClick={() => handleExport(report, 'pdf')} className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg" title="Export as PDF"><Download size={16} /></button>
              <button type="button" onClick={() => handleExport(report, 'csv')} className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded-lg" title="Export as CSV"><Download size={16} /></button>
              <button type="button" onClick={() => handleExport(report, 'xlsx')} className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-800 rounded-lg" title="Export as Excel"><Download size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Inspections;
