import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, Plus, Search, AlertOctagon, Edit2, Trash2, X, ChevronDown, ChevronUp, TrendingUp, BarChart3, CheckCircle2, Clock, Users, Target, Calendar, CheckSquare, Square, Download, Mail, ArrowUp, ArrowDown } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useRiskRegister } from '../../hooks/useData';
import { riskRegisterApi } from '../../services/api';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';

type AnyRow = Record<string, unknown>;

const STATUS_OPTIONS = ['All', 'Open','Mitigated','Closed','Accepted','Transferred'];
const CATEGORIES = ['All', 'Commercial','Technical','Environmental','Regulatory','H&S','Financial','Programme','Stakeholder'];
const LIKELIHOOD = ['Rare','Unlikely','Possible','Likely','Almost Certain'];
const IMPACT = ['Insignificant','Minor','Moderate','Major','Catastrophic'];
const RESPONSE_TYPES = ['Avoid','Reduce','Transfer','Accept'];
const RATINGS: Record<string,number> = { 'Rare':1,'Unlikely':2,'Possible':3,'Likely':4,'Almost Certain':5,'Insignificant':1,'Minor':2,'Moderate':3,'Major':4,'Catastrophic':5 };

const statusColour: Record<string,string> = {
  'Open':'bg-red-900/40 text-red-300 border border-red-700','Mitigated':'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  'Closed':'bg-green-900/40 text-green-300 border border-green-700','Accepted':'bg-blue-900/40 text-blue-300 border border-blue-700','Transferred':'bg-purple-900/40 text-purple-300 border border-purple-700',
};

const pastRiskReports = [
  { id: 'RR-2026-Q1', period: 'Q1 2026', submittedDate: '2026-04-10', totalRisks: 28, criticalCount: 2, newRisks: 5, closedRisks: 3 },
  { id: 'RR-2025-Q4', period: 'Q4 2025', submittedDate: '2026-01-08', totalRisks: 26, criticalCount: 3, newRisks: 4, closedRisks: 2 },
  { id: 'RR-2025-Q3', period: 'Q3 2025', submittedDate: '2025-10-09', totalRisks: 24, criticalCount: 2, newRisks: 6, closedRisks: 4 },
  { id: 'RR-2025-Q2', period: 'Q2 2025', submittedDate: '2025-07-11', totalRisks: 22, criticalCount: 1, newRisks: 3, closedRisks: 2 },
  { id: 'RR-2025-Q1', period: 'Q1 2025', submittedDate: '2025-04-10', totalRisks: 21, criticalCount: 2, newRisks: 5, closedRisks: 3 },
  { id: 'RR-2024-Q4', period: 'Q4 2024', submittedDate: '2025-01-09', totalRisks: 19, criticalCount: 1, newRisks: 4, closedRisks: 2 },
];

const treatmentPlansMock = [
  { riskId: 'R-001', riskName: 'Supply chain delay', actions: [
    { id: 'A-001', description: 'Engage alternative suppliers', owner: 'John Smith', dueDate: '2026-05-15', status: 'In Progress', effectiveness: 0 },
    { id: 'A-002', description: 'Establish supplier backup list', owner: 'Jane Doe', dueDate: '2026-06-01', status: 'Not Started', effectiveness: 0 },
  ]},
  { riskId: 'R-002', riskName: 'Cost overrun', actions: [
    { id: 'A-003', description: 'Monthly budget reviews', owner: 'Mike Johnson', dueDate: '2026-05-30', status: 'In Progress', effectiveness: 0 },
  ]},
  { riskId: 'R-003', riskName: 'Weather impact', actions: [
    { id: 'A-004', description: 'Install weatherproofing', owner: 'Sarah Williams', dueDate: '2026-04-30', status: 'Complete', effectiveness: 85 },
    { id: 'A-005', description: 'Create weather contingency schedule', owner: 'Tom Davis', dueDate: '2026-05-20', status: 'In Progress', effectiveness: 0 },
  ]},
];

function riskScore(likelihood: string, impact: string): number {
  return Number(RATINGS[likelihood]??1)*Number(RATINGS[impact]??1);
}

function riskLevel(score: number): { label:string; colour:string; bg:string; textColour: string } {
  if (score >= 15) return { label:'Critical', colour:'text-red-400', bg:'bg-red-900/40 border border-red-700', textColour:'text-red-300' };
  if (score >= 9) return { label:'High', colour:'text-orange-400', bg:'bg-orange-900/40 border border-orange-700', textColour:'text-orange-300' };
  if (score >= 4) return { label:'Medium', colour:'text-yellow-400', bg:'bg-yellow-900/40 border border-yellow-700', textColour:'text-yellow-300' };
  return { label:'Low', colour:'text-green-400', bg:'bg-green-900/40 border border-green-700', textColour:'text-green-300' };
}

const emptyForm = { title:'',category:'Commercial',description:'',likelihood:'Possible',impact:'Moderate',status:'Open',owner:'',response_type:'Reduce',mitigation:'',contingency:'',residual_likelihood:'Unlikely',residual_impact:'Minor',project_id:'',review_date:'',notes:'' };

const actionStatusColor: Record<string,string> = {
  'Not Started':'bg-gray-800 text-gray-300',
  'In Progress':'bg-blue-900/40 text-blue-300 border border-blue-700',
  'Completed':'bg-green-900/40 text-green-300 border border-green-700',
  'Overdue':'bg-red-900/40 text-red-300 border border-red-700',
};

export function RiskRegister() {
  const { useList, useCreate, useUpdate, useDelete } = useRiskRegister;
  const { data: raw = [], isLoading } = useList();
  const risks = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState<'register'|'matrix'|'actions'|'trends'|'heatmap'|'treatment'|'reporting'>('register');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{lik:string; imp:string} | null>(null);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const [mitigationActions, setMitigationActions] = useState<AnyRow[]>([]);

  useEffect(() => {
    riskRegisterApi.getMitigationActions().then(data => setMitigationActions(data as AnyRow[])).catch((err) => {
      console.error('Failed to load mitigation actions:', err);
    });
  }, []);

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} risk(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} risk(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const filtered = useMemo(() => {
    return risks.filter(r => {
      const title = String(r.title??'').toLowerCase();
      const matchSearch = title.includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      const matchCat = categoryFilter === 'All' || r.category === categoryFilter;
      const matchProject = projectFilter === 'All' || r.project_id === projectFilter;
      return matchSearch && matchStatus && matchCat && matchProject;
    });
  }, [risks, search, statusFilter, categoryFilter, projectFilter]);

  const allProjects = useMemo(() => {
    const projects = new Set<string>();
    risks.forEach(r => {
      const proj = String(r.project_id??'');
      if (proj) projects.add(proj);
    });
    return ['All', ...Array.from(projects)];
  }, [risks]);

  const totalRisks = risks.length;
  const criticalCount = risks.filter(r=>{
    const score = riskScore(String(r.likelihood??''), String(r.impact??''));
    return score >= 15;
  }).length;
  const openCount = risks.filter(r=>r.status==='Open').length;
  const mitigatedCount = risks.filter(r=>r.status==='Mitigated').length;
  const avgRiskScore = totalRisks > 0
    ? Math.round(risks.reduce((acc, r) => acc + riskScore(String(r.likelihood??''), String(r.impact??'')), 0) / totalRisks * 100) / 100
    : 0;

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(r: AnyRow) {
    setEditing(r);
    setForm({ title:String(r.title??''),category:String(r.category??'Health & Safety'),description:String(r.description??''),likelihood:String(r.likelihood??'Possible'),impact:String(r.impact??'Moderate'),status:String(r.status??'Open'),owner:String(r.owner??''),response_type:String(r.response_type??'Reduce'),mitigation:String(r.mitigation??''),contingency:String(r.contingency??''),residual_likelihood:String(r.residual_likelihood??'Unlikely'),residual_impact:String(r.residual_impact??'Minor'),project_id:String(r.project_id??''),review_date:String(r.review_date??''),notes:String(r.notes??'') });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const score = riskScore(form.likelihood, form.impact);
    const residualScore = riskScore(form.residual_likelihood, form.residual_impact);
    const payload = { ...form, risk_score: score, residual_score: residualScore };
    if (editing) { await updateMutation.mutateAsync({ id:String(editing.id), data:payload }); toast.success('Risk updated'); }
    else { await createMutation.mutateAsync(payload); toast.success('Risk added to register'); }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this risk?')) return;
    await deleteMutation.mutateAsync(id); toast.success('Risk deleted');
  }

  async function _mitigate(r: AnyRow) {
    await updateMutation.mutateAsync({ id:String(r.id), data:{ status:'Mitigated' } });
    toast.success('Risk marked as mitigated');
  }

  const formScore = riskScore(form.likelihood, form.impact);
  const formLevel = riskLevel(formScore);

  return (
    <>
      <ModuleBreadcrumbs currentModule="risk-register" />
      <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-white">Risk Register</h1>
          <p className="text-sm text-gray-400 mt-1">UK construction project risk identification, assessment & mitigation</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
          <Plus size={16}/><span>Add Risk</span>
        </button>
      </div>

      {criticalCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3">
          <AlertOctagon size={18} className="text-red-400"/>
          <p className="text-sm text-red-200"><span className="font-display">{criticalCount} critical risk{criticalCount>1?'s':''}</span> — urgent mitigation required</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label:'Total Risks', value:totalRisks, icon:AlertTriangle, dot:'bg-gray-500' },
          { label:'Critical (≥15)', value:criticalCount, icon:AlertOctagon, dot:'bg-red-500' },
          { label:'Open Risks', value:openCount, icon:Clock, dot:'bg-orange-500' },
          { label:'Mitigated', value:mitigatedCount, icon:CheckCircle2, dot:'bg-green-500' },
          { label:'Avg Risk Score', value:String(avgRiskScore), icon:Target, dot:'bg-blue-500' },
        ].map(kpi=>{
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card bg-base-200 p-4 hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-xs text-gray-400 mb-1">{kpi.label}</p><p className="text-2xl font-display text-white">{kpi.value}</p></div>
                <Icon size={20} className="text-gray-500 flex-shrink-0 mt-0.5"/>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {([
          { key:'register', label:'Risk Register', count:filtered.length },
          { key:'heatmap',   label:'Heat Map',   count:null },
          { key:'treatment',  label:'Treatment Plans', count:null },
          { key:'reporting',  label:'Reporting',        count:null },
          { key:'trends',   label:'Trends',        count:null },
        ] as const).map(t=>(
          <button type="button"  key={t.key} onClick={()=>setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${subTab===t.key?'border-orange-500 text-orange-500':'border-transparent text-gray-400 hover:text-gray-300'}`}>
            {t.label}
            {t.count!==null && <span className={`text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── HEAT MAP tab ─────────────────────────────────── */}
      {subTab==='heatmap' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 cb-table-scroll touch-pan-x">
            <h3 className="font-display text-white mb-4">Risk Heat Map (5×5 Matrix)</h3>
            <div className="text-xs text-gray-400 mb-2 ml-20">Impact ⟶</div>
            <div className="flex gap-3">
              <div className="flex flex-col justify-around text-xs text-gray-400 text-right w-20 flex-shrink-0 font-display">
                <div>Almost Certain (5)</div>
                <div>Likely (4)</div>
                <div>Possible (3)</div>
                <div>Unlikely (2)</div>
                <div>Rare (1)</div>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex gap-1 mb-1 px-0.5">
                  {IMPACT.map((imp, idx) => <div key={imp} className="flex-1 text-center text-xs text-gray-400 font-display tracking-widest truncate">({idx+1})<br/>{imp}</div>)}
                </div>
                {[...LIKELIHOOD].reverse().map(lik=>(
                  <div key={lik} className="flex gap-1">
                    {IMPACT.map(imp=>{
                      const score = Number(RATINGS[lik]??1)*Number(RATINGS[imp]??1);
                      const cellRisks = risks.filter(r=>r.likelihood===lik&&r.impact===imp);
                      const bgClass = score >= 15 ? 'bg-red-900/40 border-red-700 cursor-pointer hover:bg-red-900/60'
                        : score >= 9 ? 'bg-orange-900/40 border-orange-700 cursor-pointer hover:bg-orange-900/60'
                        : score >= 4 ? 'bg-yellow-900/40 border-yellow-700 cursor-pointer hover:bg-yellow-900/60'
                        : 'bg-green-900/40 border-green-700 cursor-pointer hover:bg-green-900/60';
                      const isSelected = selectedMatrixCell?.lik === lik && selectedMatrixCell?.imp === imp;
                      return (
                        <button
                          key={imp}
                          onClick={() => setSelectedMatrixCell(isSelected ? null : { lik, imp })}
                          className={`flex-1 h-14 rounded border transition-all ${bgClass} ${isSelected ? 'ring-2 ring-orange-500' : 'border'} flex flex-col items-center justify-center relative group`}
                          title={`${lik}×${imp}: Score ${score}`}
                        >
                          <span className="text-sm font-display text-white">{score}</span>
                          {cellRisks.length>0 && (
                            <span className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-display">{cellRisks.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-6 text-xs">
              {[
                {label:'Low (1–4)',colour:'bg-green-900/40 border border-green-700'},
                {label:'Medium (5–9)',colour:'bg-yellow-900/40 border border-yellow-700'},
                {label:'High (10–15)',colour:'bg-orange-900/40 border border-orange-700'},
                {label:'Critical (16–25)',colour:'bg-red-900/40 border border-red-700'}
              ].map(l=>(
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded ${l.colour}`}/>
                  <span className="text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedMatrixCell && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h4 className="font-display text-white mb-4">Risks in {selectedMatrixCell.lik} × {selectedMatrixCell.imp} cell (Score: {Number(RATINGS[selectedMatrixCell.lik]??1)*Number(RATINGS[selectedMatrixCell.imp]??1)})</h4>
              <div className="space-y-2">
                {risks.filter(r=>r.likelihood===selectedMatrixCell.lik&&r.impact===selectedMatrixCell.imp).length === 0 ? (
                  <p className="text-gray-400 text-sm">No risks in this cell</p>
                ) : (
                  risks.filter(r=>r.likelihood===selectedMatrixCell.lik&&r.impact===selectedMatrixCell.imp).map(r => {
                    const score = riskScore(String(r.likelihood??''), String(r.impact??''));
                    const level = riskLevel(score);
                    return (
                      <div key={String(r.id??'')} className="flex items-center justify-between gap-3 p-3 bg-gray-900/50 rounded border border-gray-700">
                        <div>
                          <p className="text-sm font-medium text-white">{String(r.title??'Untitled')}</p>
                          <p className="text-xs text-gray-400">{String(r.category??'')} • Owner: {String(r.owner??'Unassigned')}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-display whitespace-nowrap ${level.bg}`}>{level.label}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TREATMENT PLANS tab ────────────────────────────── */}
      {subTab==='treatment' && (
        <div className="space-y-4">
          {treatmentPlansMock.map((plan) => (
            <div key={plan.riskId} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="p-4 bg-gray-900/50 border-b border-gray-700">
                <h4 className="font-display text-white text-sm">{plan.riskName}</h4>
                <p className="text-gray-400 text-xs mt-1">Risk ID: {plan.riskId}</p>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {plan.actions.map((action) => {
                    const isOverdue = new Date(action.dueDate) < new Date() && action.status !== 'Complete';
                    const completedActions = plan.actions.filter(a => a.status === 'Complete').length;
                    const progressPercent = Math.round((completedActions / plan.actions.length) * 100);
                    return (
                      <div key={action.id} className={`border border-gray-700 rounded-lg p-4 ${isOverdue ? 'bg-red-900/10' : 'bg-gray-700/20'}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-white font-medium text-sm">{action.description}</p>
                            <p className="text-gray-400 text-xs mt-1">Owner: {action.owner} • Due: {action.dueDate}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            action.status === 'Complete' ? 'bg-green-900/40 text-green-300 border border-green-700' :
                            action.status === 'In Progress' ? 'bg-blue-900/40 text-blue-300 border border-blue-700' :
                            'bg-gray-800 text-gray-300'
                          }`}>
                            {action.status}
                          </span>
                        </div>
                        {action.status === 'Complete' && action.effectiveness > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${action.effectiveness}%` }} />
                            </div>
                            <p className="text-xs text-green-400 font-medium">{action.effectiveness}% effective</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-xs font-display">Progress</p>
                    <p className="text-gray-300 text-xs font-medium">{Math.round((plan.actions.filter(a => a.status === 'Complete').length / plan.actions.length) * 100)}%</p>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${Math.round((plan.actions.filter(a => a.status === 'Complete').length / plan.actions.length) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REPORTING tab ────────────────────────────────────── */}
      {subTab==='reporting' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-white">Risk Report Generator</h3>
                <p className="text-gray-400 text-xs mt-1">Generate and export periodic risk reports</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                  <Download size={16} /> Export PDF
                </button>
                <button type="button" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                  <Mail size={16} /> Subscribe Digest
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-2">Total Risks</p>
                <p className="text-2xl font-display text-white">28</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-2">Critical Risks</p>
                <p className="text-2xl font-display text-red-400">2</p>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-2">New This Period</p>
                <div className="flex items-center gap-2">
                  <ArrowUp size={16} className="text-red-400" />
                  <p className="text-2xl font-display text-white">5</p>
                </div>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs mb-2">Closed This Period</p>
                <div className="flex items-center gap-2">
                  <ArrowDown size={16} className="text-green-400" />
                  <p className="text-2xl font-display text-white">3</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-200 p-6">
            <h3 className="font-display text-white mb-4">Risk Trend (6-Month)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={[
                { month: 'Nov', total: 18, critical: 1 },
                { month: 'Dec', total: 20, critical: 2 },
                { month: 'Jan', total: 22, critical: 1 },
                { month: 'Feb', total: 25, critical: 3 },
                { month: 'Mar', total: 27, critical: 2 },
                { month: 'Apr', total: 28, critical: 2 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis stroke="#9ca3af" style={{fontSize: '12px'}}/>
                <YAxis stroke="#9ca3af" style={{fontSize: '12px'}}/>
                <Tooltip contentStyle={{backgroundColor: '#1f2937', border: '1px solid #4b5563'}}/>
                <Legend wrapperStyle={{paddingTop: '16px'}}/>
                <Line type="monotone" dataKey="total" stroke="#ea580c" strokeWidth={2} name="Total Risks" dot={{fill:'#ea580c'}}/>
                <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} name="Critical Risks" dot={{fill:'#dc2626'}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card bg-base-200 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h3 className="font-display text-white">Past Risk Reports</h3>
            </div>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900/50">
                    <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Report ID</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Period</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Submitted</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-display tracking-widest">Total Risks</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-display tracking-widest">Critical</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-display tracking-widest">New</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-display tracking-widest">Closed</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-display tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {pastRiskReports.map((report) => (
                    <tr key={report.id} className="border-b border-gray-700 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-orange-400 font-mono font-medium">{report.id}</td>
                      <td className="px-4 py-3 text-gray-300">{report.period}</td>
                      <td className="px-4 py-3 text-gray-300">{report.submittedDate}</td>
                      <td className="px-4 py-3 text-center text-white font-medium">{report.totalRisks}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/40 text-red-300">{report.criticalCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-orange-400 font-medium">+{report.newRisks}</td>
                      <td className="px-4 py-3 text-center text-green-400 font-medium">−{report.closedRisks}</td>
                      <td className="px-4 py-3 text-center">
                        <button className="p-1 hover:bg-blue-900/30 rounded inline-block">
                          <Download size={14} className="text-blue-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Mail className="text-blue-400 flex-shrink-0 mt-1" size={20} />
              <div>
                <h4 className="font-display text-blue-300 mb-2">Weekly Risk Digest</h4>
                <p className="text-sm text-gray-300 mb-3">Subscribe to receive a weekly email summary of critical risks, new items, and mitigation progress.</p>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                  Subscribe Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RISK MATRIX tab ─────────────────────────────────── */}
      {subTab==='matrix' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 cb-table-scroll touch-pan-x">
            <h3 className="font-display text-white mb-4">5×5 Likelihood-Impact Heat Map</h3>
            <div className="text-xs text-gray-400 mb-2 ml-20">Impact ⟶</div>
            <div className="flex gap-3">
              <div className="flex flex-col justify-around text-xs text-gray-400 text-right w-20 flex-shrink-0 font-display">
                <div>Almost Certain (5)</div>
                <div>Likely (4)</div>
                <div>Possible (3)</div>
                <div>Unlikely (2)</div>
                <div>Rare (1)</div>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex gap-1 mb-1 px-0.5">
                  {IMPACT.map((imp, idx) => <div key={imp} className="flex-1 text-center text-xs text-gray-400 font-display tracking-widest truncate">({idx+1})<br/>{imp}</div>)}
                </div>
                {[...LIKELIHOOD].reverse().map(lik=>(
                  <div key={lik} className="flex gap-1">
                    {IMPACT.map(imp=>{
                      const score = Number(RATINGS[lik]??1)*Number(RATINGS[imp]??1);
                      const cellRisks = risks.filter(r=>r.likelihood===lik&&r.impact===imp);
                      const bgClass = score >= 15 ? 'bg-red-900/40 border-red-700 cursor-pointer hover:bg-red-900/60'
                        : score >= 9 ? 'bg-orange-900/40 border-orange-700 cursor-pointer hover:bg-orange-900/60'
                        : score >= 4 ? 'bg-yellow-900/40 border-yellow-700 cursor-pointer hover:bg-yellow-900/60'
                        : 'bg-green-900/40 border-green-700 cursor-pointer hover:bg-green-900/60';
                      const isSelected = selectedMatrixCell?.lik === lik && selectedMatrixCell?.imp === imp;
                      return (
                        <button
                          key={imp}
                          onClick={() => setSelectedMatrixCell(isSelected ? null : { lik, imp })}
                          className={`flex-1 h-14 rounded border transition-all ${bgClass} ${isSelected ? 'ring-2 ring-orange-500' : 'border'} flex flex-col items-center justify-center relative group`}
                          title={`${lik}×${imp}: Score ${score}`}
                        >
                          <span className="text-sm font-display text-white">{score}</span>
                          {cellRisks.length>0 && (
                            <span className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-display">{cellRisks.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-6 text-xs">
              {[
                {label:'Low (1–3)',colour:'bg-green-900/40 border border-green-700'},
                {label:'Medium (4–8)',colour:'bg-yellow-900/40 border border-yellow-700'},
                {label:'High (9–14)',colour:'bg-orange-900/40 border border-orange-700'},
                {label:'Critical (15–25)',colour:'bg-red-900/40 border border-red-700'}
              ].map(l=>(
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded ${l.colour}`}/>
                  <span className="text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedMatrixCell && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h4 className="font-display text-white mb-4">Risks in {selectedMatrixCell.lik} × {selectedMatrixCell.imp} cell (Score: {Number(RATINGS[selectedMatrixCell.lik]??1)*Number(RATINGS[selectedMatrixCell.imp]??1)})</h4>
              <div className="space-y-2">
                {risks.filter(r=>r.likelihood===selectedMatrixCell.lik&&r.impact===selectedMatrixCell.imp).length === 0 ? (
                  <p className="text-gray-400 text-sm">No risks in this cell</p>
                ) : (
                  risks.filter(r=>r.likelihood===selectedMatrixCell.lik&&r.impact===selectedMatrixCell.imp).map(r => {
                    const score = riskScore(String(r.likelihood??''), String(r.impact??''));
                    const level = riskLevel(score);
                    return (
                      <div key={String(r.id??'')} className="flex items-center justify-between gap-3 p-3 bg-gray-900/50 rounded border border-gray-700">
                        <div>
                          <p className="text-sm font-medium text-white">{String(r.title??'Untitled')}</p>
                          <p className="text-xs text-gray-400">{String(r.category??'')} • Owner: {String(r.owner??'Unassigned')}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-display whitespace-nowrap ${level.bg}`}>{level.label}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MITIGATION ACTIONS tab ────────────────────────────── */}
      {subTab==='actions' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="font-display text-white">Mitigation Action Items</h3>
              <p className="text-sm text-gray-400 mt-1">Track and manage risk mitigation actions</p>
            </div>
            <button type="button" onClick={openCreate} className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 transition-colors">
              <Plus size={14}/><span>Add Action</span>
            </button>
          </div>
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900/50">
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Risk #</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Title</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Mitigation Action</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Owner</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Due Date</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-display tracking-widest">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {mitigationActions.sort((a: AnyRow, b: AnyRow) => new Date(String(a.due_date??'')).getTime() - new Date(String(b.due_date??'')).getTime()).map((action: AnyRow) => {
                  const isOverdue = new Date(String(action.due_date??'')) < new Date() && action.status !== 'Completed';
                  const rowClass = isOverdue ? 'bg-red-900/10' : '';
                  return (
                    <tr key={String(action.id??'')} className={`border-b border-gray-700 hover:bg-gray-750 transition-colors ${rowClass}`}>
                      <td className="px-4 py-3 text-gray-300 font-mono">#R{String(action.risk_id??'').slice(-3)}</td>
                      <td className="px-4 py-3 text-gray-300 font-medium text-wrap">{String(action.title??'')}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm max-w-xs truncate">{String(action.title??'')}</td>
                      <td className="px-4 py-3 text-gray-300 flex items-center gap-1">
                        <Users size={14} className="text-gray-500"/>{String(action.owner??'Unassigned')}
                      </td>
                      <td className="px-4 py-3 text-gray-300 flex items-center gap-1">
                        <Calendar size={14} className="text-gray-500"/>{String(action.due_date??'')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${actionStatusColor[String(action.status??'')]}`}>
                          {String(action.status??'Not Started')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{width: `${Number(action.progress??0)}%`}}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{Number(action.progress??0)}%</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {mitigationActions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Target size={40} className="mx-auto mb-3 opacity-30"/>
                <p className="text-sm">No mitigation actions yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TRENDS tab ────────────────────────────────────── */}
      {subTab==='trends' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Risks Closed This Month', value: '3', icon: CheckCircle2, color: 'text-green-400' },
              { label: 'New Risks This Month', value: '5', icon: AlertOctagon, color: 'text-orange-400' },
              { label: 'Risks Overdue for Review', value: '2', icon: Clock, color: 'text-red-400' },
            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div key={idx} className="card bg-base-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
<p className="text-2xl font-display text-white">{kpi.value}</p>
                    </div>
                    <Icon size={24} className={`${kpi.color} opacity-50`}/>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card bg-base-200 p-6">
            <h3 className="font-display text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-orange-400"/>
              Risk Count by Rating (6-Month Trend)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[
                { month: 'Sept', critical: 2, high: 4, medium: 6, low: 8 },
                { month: 'Oct', critical: 3, high: 5, medium: 7, low: 9 },
                { month: 'Nov', critical: 2, high: 4, medium: 8, low: 10 },
                { month: 'Dec', critical: 4, high: 6, medium: 7, low: 8 },
                { month: 'Jan', critical: 3, high: 5, medium: 6, low: 9 },
                { month: 'Feb', critical: 5, high: 7, medium: 5, low: 7 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis stroke="#9ca3af" style={{fontSize: '12px'}}/>
                <YAxis stroke="#9ca3af" style={{fontSize: '12px'}}/>
                <Tooltip
                  contentStyle={{backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px'}}
                  labelStyle={{color: '#f3f4f6'}}
                />
                <Legend wrapperStyle={{paddingTop: '16px'}}/>
                <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} name="Critical" dot={{fill:'#dc2626'}}/>
                <Line type="monotone" dataKey="high" stroke="#ea580c" strokeWidth={2} name="High" dot={{fill:'#ea580c'}}/>
                <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={2} name="Medium" dot={{fill:'#eab308'}}/>
                <Line type="monotone" dataKey="low" stroke="#16a34a" strokeWidth={2} name="Low" dot={{fill:'#16a34a'}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card bg-base-200 p-6">
            <h3 className="font-display text-white mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400"/>
              Risks by Category
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { category: 'Commercial', count: 8 },
                { category: 'Technical', count: 6 },
                { category: 'Environmental', count: 4 },
                { category: 'Regulatory', count: 5 },
                { category: 'H&S', count: 7 },
                { category: 'Financial', count: 9 },
                { category: 'Programme', count: 6 },
                { category: 'Stakeholder', count: 3 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                <XAxis stroke="#9ca3af" style={{fontSize: '12px'}} angle={-45} textAnchor="end" height={80}/>
                <YAxis stroke="#9ca3af" style={{fontSize: '12px'}}/>
                <Tooltip
                  contentStyle={{backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: '8px'}}
                  labelStyle={{color: '#f3f4f6'}}
                />
                <Bar dataKey="count" fill="#ea580c" radius={[6, 6, 0, 0]}>
                  {[
                    { dataKey: 'count', fill: '#f97316' },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#f97316"/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── REGISTER tab ────────────────────────────────────── */}
      {subTab==='register' && (
        <>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title…" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-600 bg-gray-900 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"/>
              </div>
              <div className="flex flex-wrap gap-3">
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="text-sm border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                </select>
                <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="text-sm border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
                <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="text-sm border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {allProjects.map(p=><option key={p}>{p}</option>)}
                </select>
                <span className="text-sm text-gray-400 ml-auto">{filtered.length} risk{filtered.length!==1?'s':''}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
            ) : (
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <EmptyState title="No risks found" variant="error" />
                ) : (
                  filtered.map(r => {
                    const id = String(r.id??'');
                    const isExp = expanded === id;
                    const isSelected = selectedIds.has(id);
                    const score = riskScore(String(r.likelihood??''), String(r.impact??''));
                    const level = riskLevel(score);
                    const statusClass = statusColour[String(r.status??'Open')] || statusColour['Open'];
                    return (
                      <div key={id} className="card bg-base-200 overflow-hidden hover:border-gray-600 transition-colors">
                        <div className="p-4 cursor-pointer hover:bg-gray-750" onClick={()=>setExpanded(isExp?null:id)}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }} className="mt-1 flex-shrink-0">
                              {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="font-display text-white truncate">{String(r.title??'Untitled')}</p>
                              <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                                <span>{String(r.category??'')}</span>
                                {!!r.owner && <span>•</span>}
                                {!!r.owner && <span>Owner: {String(r.owner)}</span>}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <div className={`px-3 py-2 rounded text-center ${level.bg}`}>
                                <p className={`text-xs font-display ${level.colour}`}>{score}</p>
                                <p className={`text-xs ${level.textColour}`}>{level.label}</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${statusClass}`}>
                                {String(r.status??'Open')}
                              </span>
                            </div>
                            <div className="flex-shrink-0">
                              {isExp?<ChevronUp size={18} className="text-gray-500"/>:<ChevronDown size={18} className="text-gray-500"/>}
                            </div>
                          </div>
                        </div>
                        {isExp && (
                          <div className="px-6 pb-4 bg-gray-900/50 space-y-4 text-sm border-t border-gray-700">
                            {!!r.description && <div><p className="text-xs font-display text-gray-400 mb-1 tracking-widest">DESCRIPTION</p><p className="text-gray-300">{String(r.description)}</p></div>}
                            <div className="grid grid-cols-2 gap-4">
                              <div><p className="text-xs text-gray-500 mb-1">Likelihood</p><p className="text-gray-300 font-medium">{String(r.likelihood??'—')}</p></div>
                              <div><p className="text-xs text-gray-500 mb-1">Impact</p><p className="text-gray-300 font-medium">{String(r.impact??'—')}</p></div>
                              <div><p className="text-xs text-gray-500 mb-1">Response Type</p><p className="text-gray-300 font-medium">{String(r.response_type??'—')}</p></div>
                              {!!r.review_date && <div><p className="text-xs text-gray-500 mb-1">Review Date</p><p className="text-gray-300 font-medium">{String(r.review_date)}</p></div>}
                            </div>
                            {!!r.mitigation && <div><p className="text-xs font-display text-yellow-400 mb-1 tracking-widest">MITIGATION PLAN</p><p className="text-gray-300">{String(r.mitigation)}</p></div>}
                            {!!r.contingency && <div><p className="text-xs font-display text-blue-400 mb-1 tracking-widest">CONTINGENCY PLAN</p><p className="text-gray-300">{String(r.contingency)}</p></div>}
                            <div className="flex gap-2 pt-2 border-t border-gray-700">
                              <button type="button" onClick={()=>openEdit(r)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-orange-900/40 border border-orange-700 text-orange-300 rounded hover:bg-orange-900/60 font-medium transition-colors">
                                <Edit2 size={14}/><span>Edit</span>
                              </button>
                              <button type="button" onClick={()=>handleDelete(id)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-900/40 border border-red-700 text-red-300 rounded hover:bg-red-900/60 font-medium transition-colors">
                                <Trash2 size={14}/><span>Delete</span>
                              </button>
                              {r.status === 'Open' && (
                                <button type="button" onClick={async ()=>{await updateMutation.mutateAsync({ id, data:{ status:'Mitigated' } }); toast.success('Risk marked as mitigated');}} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-900/40 border border-green-700 text-green-300 rounded hover:bg-green-900/60 font-medium transition-colors">
                                  <CheckCircle2 size={14}/><span>Mark Mitigated</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <BulkActionsBar
                  selectedIds={Array.from(selectedIds)}
                  actions={[
                    { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
                  ]}
                  onClearSelection={clearSelection}
                />
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-display text-white">{editing?'Edit Risk':'Add Risk'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formScore > 0 && (
                <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${formLevel.bg} border ${formLevel.colour}`}>
                  <span className={`text-lg font-black ${formLevel.textColour}`}>{formScore}</span>
                  <div><p className={`text-sm font-display ${formLevel.textColour}`}>{formLevel.label} Risk</p><p className="text-xs text-gray-400">Likelihood × Impact = Score</p></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Risk Title *</label>
                  <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Owner</label>
                  <input value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Likelihood</label>
                  <select value={form.likelihood} onChange={e=>setForm(f=>({...f,likelihood:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {LIKELIHOOD.map(l=><option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Impact</label>
                  <select value={form.impact} onChange={e=>setForm(f=>({...f,impact:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {IMPACT.map(i=><option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Response Type</label>
                  <select value={form.response_type} onChange={e=>setForm(f=>({...f,response_type:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {RESPONSE_TYPES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Review Date</label>
                  <input type="date" value={form.review_date} onChange={e=>setForm(f=>({...f,review_date:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div className="col-span-2 border-t border-gray-700 pt-4">
                  <p className="text-xs font-display text-gray-400 mb-3 tracking-widest">Residual Risk (After Mitigation)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Residual Likelihood</label>
                      <select value={form.residual_likelihood} onChange={e=>setForm(f=>({...f,residual_likelihood:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        {LIKELIHOOD.map(l=><option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Residual Impact</label>
                      <select value={form.residual_impact} onChange={e=>setForm(f=>({...f,residual_impact:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        {IMPACT.map(i=><option key={i}>{i}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Mitigation Plan</label>
                  <textarea rows={2} value={form.mitigation} onChange={e=>setForm(f=>({...f,mitigation:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contingency Plan</label>
                  <textarea rows={2} value={form.contingency} onChange={e=>setForm(f=>({...f,contingency:e.target.value}))} className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {editing?'Update Risk':'Add Risk'}
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

export default RiskRegister;
