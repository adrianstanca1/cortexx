import { useState, useEffect } from 'react';
import { Layers, Plus, Search, Eye, Download, Edit2, Trash2, X, ChevronDown, ChevronUp, FileText, GitBranch, Send, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { useDocuments } from '../../hooks/useData';
import { documentsApi } from '../../services/api';
import { toast } from 'sonner';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { PieChart, Pie, BarChart, Bar, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';

type AnyRow = Record<string, unknown>;

const DISCIPLINES = ['All','Architectural','Structural','MEP','Civil','Fire','Facade','Drainage','Landscape','HVAC','Electrical'];
const STATUSES = ['Current','For Review','Rejected','Superseded'];
const SCALES = ['1:5','1:10','1:20','1:50','1:100','1:200','1:500','NTS'];
const DISCIPLINE_ABBR: Record<string,string> = { Architectural:'ARC', Structural:'STR', MEP:'MEP', Civil:'CIV', Fire:'FIR', Facade:'FAC', Drainage:'DRN', Landscape:'LSC', HVAC:'HVA', Electrical:'ELE' };
const PURPOSE_CODES = ['IFC','IFT','IFR','IFI'];

const statusColour: Record<string,string> = {
  'Current':'bg-emerald-900/40 text-emerald-300','For Review':'bg-amber-900/40 text-amber-300',
  'Rejected':'bg-red-900/40 text-red-300','Superseded':'bg-gray-700 text-gray-300',
};

const emptyForm = { title:'',document_type:'Drawing',discipline:'Architectural',revision:'A',status:'Current',file_url:'',project_id:'',author:'',date_issued:'',description:'',drawing_number:'',scale:'1:100',sheet_size:'A1' };

interface RevisionRecord {
  letter: string;
  date: string;
  issuedBy: string;
  description: string;
  status: string;
}

interface Transmittal {
  id: string;
  project: string;
  issuedTo: string;
  date: string;
  purpose: string;
  status: string;
  drawings: string[];
}

// Build revision history from actual document fields — each drawing record IS a revision
function buildRevisions(d: AnyRow): RevisionRecord[] {
  return [{
    letter: String(d.revision ?? 'A'),
    date: String(d.dateIssued ?? d.createdAt ?? ''),
    issuedBy: String(d.author ?? 'Unknown'),
    description: String(d.description ?? 'Initial issue'),
    status: String(d.status ?? 'Current'),
  }];
}

export function Drawings() {
  const { useList, useCreate, useUpdate, useDelete } = useDocuments;
  const { data: raw = [], isLoading } = useList();
  const allDocs = raw as AnyRow[];
  const drawings = allDocs.filter(d => String(d.document_type??'').toLowerCase().includes('draw') || String(d.document_type??'') === 'Drawing' || !d.document_type);

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [activeTab, setActiveTab] = useState<'register'|'revisions'|'transmittals'|'discipline'>('register');
  const [disciplineFilter, setDisciplineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedDrawing, setSelectedDrawing] = useState<AnyRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'drawing'|'revision'|'transmittal'>('drawing');
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [revisionForm, setRevisionForm] = useState({ drawingNumber:'', newRevision:'', description:'', reason:'' });
  const [transmittalForm, setTransmittalForm] = useState({ project:'', drawings:'', issuedTo:'', purpose:'IFC' });
  const [expandedDiscipline, setExpandedDiscipline] = useState<string | null>(null);
  const [transmittals, setTransmittals] = useState<Transmittal[]>([]);
  const [transmittalsLoading, setTransmittalsLoading] = useState(false);

  useEffect(() => {
    async function fetchTransmittals() {
      setTransmittalsLoading(true);
      try {
        const data = await documentsApi.getTransmittals();
        const mapped = (data as AnyRow[]).map((t: AnyRow): Transmittal => ({
          id: String(t.id ?? ''),
          project: String(t.project ?? ''),
          issuedTo: String(t.issued_to ?? ''),
          date: String(t.date ?? ''),
          purpose: String(t.purpose ?? ''),
          status: String(t.status ?? ''),
          drawings: ['Drawing'], // placeholder since no junction table
        }));
        setTransmittals(mapped);
      } catch {
        console.error('Failed to');
        toast.error('Failed to load transmittals');
      } finally {
        setTransmittalsLoading(false);
      }
    }
    if (activeTab === 'transmittals') {
      fetchTransmittals();
    }
  }, [activeTab]);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} drawing(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} drawing(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const projects = ['All', ...Array.from(new Set(drawings.map(d=>String(d.project_id??'')).filter(Boolean)))];

  const filtered = drawings.filter(d => {
    const title = String(d.title??'').toLowerCase();
    const num = String(d.drawing_number??d.title??'').toLowerCase();
    const matchSearch = title.includes(search.toLowerCase()) || num.includes(search.toLowerCase());
    const matchDisc = disciplineFilter === 'All' || d.discipline === disciplineFilter;
    const matchStatus = statusFilter === 'All' || d.status === statusFilter;
    const matchProj = projectFilter === 'All' || d.project_id === projectFilter;
    return matchSearch && matchDisc && matchStatus && matchProj;
  });

  const currentRevCount = drawings.filter(d=>d.status==='Current').length;
  const forReviewCount = drawings.filter(d=>d.status==='For Review').length;
  const supersededCount = drawings.filter(d=>d.status==='Superseded').length;
  const _rejectedCount = drawings.filter(d=>d.status==='Rejected').length;
  const disciplinesCount = Array.from(new Set(drawings.map(d=>String(d.discipline??'')).filter(Boolean))).length;

  const disciplineStats = DISCIPLINES.filter(d=>d!=='All').map(disc => ({
    name: disc,
    count: drawings.filter(d=>d.discipline===disc).length,
    current: drawings.filter(d=>d.discipline===disc && d.status==='Current').length,
    superseded: drawings.filter(d=>d.discipline===disc && d.status==='Superseded').length,
  }));

  const revisionStats = DISCIPLINES.filter(d=>d!=='All').map(disc => {
    const discDrawings = drawings.filter(d=>d.discipline===disc);
    return { name: disc, revisions: discDrawings.length };
  }).filter(d=>d.revisions>0);

  const pieData = disciplineStats.filter(d=>d.count>0).map(d=>({ name: d.name, value: d.count }));

  function openCreateDrawing() {
    setModalMode('drawing');
    setEditing(null);
    const num = drawings.length + 1;
    setForm({
      ...emptyForm,
      date_issued:new Date().toISOString().slice(0,10),
      document_type:'Drawing',
      drawing_number:`CW-${DISCIPLINE_ABBR['Architectural']}-${String(num).padStart(3,'0')}`
    });
    setShowModal(true);
  }

  function openEdit(d: AnyRow) {
    setModalMode('drawing');
    setEditing(d);
    setForm({
      title:String(d.title??''),
      document_type:'Drawing',
      discipline:String(d.discipline??'Architectural'),
      revision:String(d.revision??'A'),
      status:String(d.status??'Current'),
      file_url:String(d.file_url??''),
      project_id:String(d.project_id??''),
      author:String(d.author??''),
      date_issued:String(d.date_issued??''),
      description:String(d.description??''),
      drawing_number:String(d.drawing_number??''),
      scale:String(d.scale??'1:100'),
      sheet_size:String(d.sheet_size??'A1')
    });
    setShowModal(true);
  }

  function openRevisionModal() {
    setModalMode('revision');
    setRevisionForm({ drawingNumber:'', newRevision:'', description:'', reason:'' });
    setShowModal(true);
  }

  function openTransmittalModal() {
    setModalMode('transmittal');
    setTransmittalForm({ project:'', drawings:'', issuedTo:'', purpose:'IFC' });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modalMode === 'drawing') {
      const payload = { ...form, document_type: 'Drawing' };
      if (editing) {
        await updateMutation.mutateAsync({ id:String(editing.id), data:payload });
        toast.success('Drawing updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Drawing registered');
      }
    } else if (modalMode === 'revision') {
      // Find the original drawing to copy its metadata
      const original = drawings.find(d => String(d.drawing_number ?? '') === revisionForm.drawingNumber);
      if (!original) { toast.error('Drawing not found'); return; }
      await createMutation.mutateAsync({
        ...original,
        id: undefined,
        revision: revisionForm.newRevision,
        description: revisionForm.description || String(original.description ?? ''),
        status: 'For Review',
        date_issued: new Date().toISOString().slice(0, 10),
      });
      toast.success(`Revision ${revisionForm.newRevision} issued for ${revisionForm.drawingNumber}`);
    } else if (modalMode === 'transmittal') {
      await documentsApi.createTransmittal({
        project:   transmittalForm.project,
        issued_to: transmittalForm.issuedTo,
        date:      new Date().toISOString().slice(0, 10),
        purpose:   transmittalForm.purpose,
        status:    'Sent',
      });
      // Refresh transmittals list
      const updated = await documentsApi.getTransmittals();
      setTransmittals((updated as AnyRow[]).map((t: AnyRow): Transmittal => ({
        id: String(t.id ?? ''),
        project: String(t.project ?? ''),
        issuedTo: String(t.issued_to ?? ''),
        date: String(t.date ?? ''),
        purpose: String(t.purpose ?? ''),
        status: String(t.status ?? ''),
        drawings: ['Drawing'],
      })));
      toast.success('Transmittal created');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this drawing?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Drawing deleted');
  }

  function downloadRegister() {
    const headers = ['Drawing No', 'Title', 'Discipline', 'Revision', 'Status', 'Author', 'Date Issued', 'Scale'];
    const rows = drawings.map(d => [
      String(d.drawing_number ?? ''),
      String(d.title ?? ''),
      String(d.discipline ?? ''),
      String(d.revision ?? ''),
      String(d.status ?? ''),
      String(d.author ?? ''),
      String(d.date_issued ?? ''),
      String(d.scale ?? ''),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `drawing-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Register exported (${drawings.length} drawings)`);
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="drawings" />
      <div className="min-h-screen bg-gray-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Drawings</h1>
          <p className="text-sm text-gray-400 mt-1">Drawing register & revision control</p>
        </div>
        <button type="button" onClick={openCreateDrawing} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
          <Plus size={16}/><span>Add Drawing</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label:'Total Drawings', value:drawings.length, colour:'text-blue-400', bg:'bg-blue-900/30 border-blue-700' },
          { label:'Current Revision', value:currentRevCount, colour:'text-emerald-400', bg:'bg-emerald-900/30 border-emerald-700' },
          { label:'Superseded', value:supersededCount, colour:'text-gray-400', bg:'bg-gray-800/50 border-gray-700' },
          { label:'For Review', value:forReviewCount, colour:'text-amber-400', bg:'bg-amber-900/30 border-amber-700' },
          { label:'Disciplines', value:disciplinesCount, colour:'text-purple-400', bg:'bg-purple-900/30 border-purple-700' },
        ].map(kpi=>(
          <div key={kpi.label} className={`bg-gray-800/40 rounded-xl border ${kpi.bg} p-4`}>
            <p className="text-xs text-gray-400">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.colour} mt-1`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-0 border-b border-gray-700">
        {[
          { key:'register', label:'Drawing Register', icon:FileText },
          { key:'revisions', label:'Revision Control', icon:GitBranch },
          { key:'transmittals', label:'Transmittals', icon:Send },
          { key:'discipline', label:'By Discipline', icon:Layers },
        ].map(t=>{
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={()=>setActiveTab(t.key as 'register'|'revisions'|'transmittals'|'discipline')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab===t.key?'border-orange-500 text-orange-400':'border-transparent text-gray-400 hover:text-gray-300'}`}>
              <Icon size={16}/>{t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'register' && (
        <>
          <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-4">
            {DISCIPLINES.map(disc => {
              const count = drawings.filter(d => d.discipline === disc).length;
              return (
                <button
                  key={disc}
                  onClick={() => setDisciplineFilter(disc)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    disciplineFilter === disc
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {disc}
                  {count > 0 && <span className={`text-xs px-1.5 rounded-full ${disciplineFilter === disc ? 'bg-orange-700' : 'bg-gray-700'}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="Search drawing number, title, or discipline…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e=>setStatusFilter(e.target.value)}
              className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {['All',...STATUSES].map(s=><option key={s}>{s}</option>)}
            </select>
            <select
              value={projectFilter}
              onChange={e=>setProjectFilter(e.target.value)}
              className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {projects.map(p=><option key={p}>{p}</option>)}
            </select>
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} drawing{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>{['No.','Title','Discipline','Rev','Status','Scale','Project','Issued By','Issue Date',''].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filtered.map((d, idx)=>(
                    <tr
                      key={String(d.id)}
                      onClick={()=>setSelectedDrawing(d)}
                      className={`cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/30'} hover:bg-gray-700/50`}
                    >
                      <td className="px-4 py-3">
                        <button type="button" onClick={e => { e.stopPropagation(); toggle(String(d.id)); }}>
                          {selectedIds.has(String(d.id)) ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{String(d.drawing_number??'—')}</td>
                      <td className="px-4 py-3 font-medium text-gray-200 max-w-xs truncate">{String(d.title??'—')}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{String(d.discipline??'—')}</td>
                      <td className="px-4 py-3 text-xs font-mono font-bold text-orange-400">{String(d.revision??'—')}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(d.status??'')] ?? 'bg-gray-700 text-gray-300'}`}>{String(d.status??'')}</span></td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-400">{String(d.scale??'—')}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{String(d.project_id??'—')}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{String(d.author??'—')}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{String(d.date_issued??'—')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!!d.file_url && <a href={String(d.file_url)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded" onClick={e=>e.stopPropagation()} title="View"><Eye size={14}/></a>}
                          <button type="button" onClick={(e)=>{e.stopPropagation();openEdit(d);}} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded" title="Edit"><Edit2 size={14}/></button>
                          <button type="button" onClick={(e)=>{e.stopPropagation();handleDelete(String(d.id));}} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded" title="Delete"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <EmptyState
                  icon={FileText}
                  title="No drawings found"
                  description="Upload drawings and plans to keep your team aligned on project specifications."
                />
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
        </>
      )}

      {activeTab === 'revisions' && (
        <>
          <div className="flex gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="Search by drawing number…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button type="button" onClick={openRevisionModal} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
              <Plus size={16}/><span>Issue New Revision</span>
            </button>
          </div>

          <div className="space-y-6">
            {drawings.filter(d=>search.length===0 || String(d.drawing_number??'').toLowerCase().includes(search.toLowerCase())).map(d=>(
              <div key={String(d.id)} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="mb-4 pb-3 border-b border-gray-700">
                  <h3 className="text-lg font-bold text-white font-mono">{String(d.drawing_number??'—')}</h3>
                  <p className="text-sm text-gray-400 mt-1">{String(d.title??'—')}</p>
                </div>
                <div className="space-y-3">
                  {buildRevisions(d).map((rev, idx)=>(
                    <div key={idx} className={`relative pl-8 pb-4 ${idx < buildRevisions(d).length - 1 ? 'border-l border-dashed border-gray-600' : ''}`}>
                      <div className={`absolute -left-3 top-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${rev.status==='Current'?'bg-blue-500 border-blue-400':'bg-gray-600 border-gray-500'}`}>
                        {rev.status==='Current' && <CheckCircle2 size={12} className="text-white"/>}
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-white">Revision {rev.letter}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{rev.date} by {rev.issuedBy}</p>
                          <p className="text-sm text-gray-300 mt-2">{rev.description}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ml-3 ${rev.status==='Current'?'bg-blue-900/40 text-blue-300 border border-blue-700':'bg-gray-700 text-gray-300'}`}>
                          {rev.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'transmittals' && (
        <>
          <div className="flex gap-3 items-center justify-between mb-4">
            <button type="button" onClick={openTransmittalModal} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
              <Plus size={16}/><span>New Transmittal</span>
            </button>
            <button type="button" onClick={downloadRegister} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors">
              <Download size={16}/><span>Download Register</span>
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-700">
                <tr>{['Transmittal No.','Project','Drawings Included','Issued To','Issue Date','Purpose','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {transmittalsLoading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading transmittals...</td></tr>
                ) : transmittals.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No transmittals</td></tr>
                ) : (
                  transmittals.map((t, idx)=>(
                    <tr key={t.id} className={`transition-colors ${idx % 2 === 0 ? 'bg-gray-800/50' : 'bg-gray-800/30'}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 font-bold">{t.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{t.project}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">1 drawing</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{t.issuedTo}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{t.date}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-900/40 text-purple-300">{t.purpose}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${t.status==='Issued'?'bg-emerald-900/40 text-emerald-300':'bg-amber-900/40 text-amber-300'}`}>{t.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'discipline' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-lg font-bold text-white mb-4">Drawings by Discipline</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({name,value})=>`${name} (${value})`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#06b6d4'].map((colour,idx)=><Cell key={`cell-${idx}`} fill={colour}/>)}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #4b5563',borderRadius:'8px',color:'#e5e7eb'}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h3 className="text-lg font-bold text-white mb-4">Revisions per Discipline</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revisionStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #4b5563',borderRadius:'8px',color:'#e5e7eb'}}/>
                  <Bar dataKey="revisions" fill="#f97316" radius={[8,8,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            {disciplineStats.filter(d=>d.count>0).map(disc=>(
              <div key={disc.name} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <button
                  onClick={()=>setExpandedDiscipline(expandedDiscipline===disc.name?null:disc.name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-bold text-white">{disc.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{disc.count} drawing{disc.count !== 1 ? 's' : ''} • {disc.current} current • {disc.superseded} superseded</p>
                    </div>
                  </div>
                  {expandedDiscipline===disc.name ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                </button>
                {expandedDiscipline===disc.name && (
                  <div className="border-t border-gray-700 px-6 py-4 bg-gray-800/50">
                    <div className="space-y-2">
                      {drawings.filter(d=>d.discipline===disc.name).map(d=>(
                        <div key={String(d.id)} className="flex items-center justify-between text-sm py-2 border-b border-gray-700 last:border-0">
                          <div>
                            <p className="font-mono text-gray-200">{String(d.drawing_number??'—')}</p>
                            <p className="text-xs text-gray-500">{String(d.title??'—')}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(d.status??'')] ?? 'bg-gray-700 text-gray-300'}`}>
                            {String(d.status??'')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {selectedDrawing && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-800 border-l border-gray-700 shadow-2xl overflow-y-auto z-40">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Drawing Details</h3>
              <button type="button" onClick={() => setSelectedDrawing(null)} className="p-1 hover:bg-gray-700 rounded"><X size={20} className="text-gray-400"/></button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase">Drawing Number</p>
                  <p className="text-sm font-mono text-gray-200 mt-1">{String(selectedDrawing.drawing_number??'—')}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase">Title</p>
                  <p className="text-sm text-gray-200 mt-1">{String(selectedDrawing.title??'—')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">Scale</p>
                    <p className="text-sm text-gray-300 mt-1">{String(selectedDrawing.scale??'—')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">Sheet Size</p>
                    <p className="text-sm text-gray-300 mt-1">{String(selectedDrawing.sheet_size??'A1')}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 uppercase font-semibold">Discipline</p>
                  <p className="text-gray-200 mt-1">{String(selectedDrawing.discipline??'—')}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase font-semibold">Drawn By</p>
                  <p className="text-gray-200 mt-1">{String(selectedDrawing.author??'—')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 uppercase font-semibold">Revision</p>
                  <p className="text-gray-200 font-bold mt-1">{String(selectedDrawing.revision??'—')}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase font-semibold">Issued</p>
                  <p className="text-gray-200 mt-1">{String(selectedDrawing.date_issued??'—')}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Status</p>
                <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${statusColour[String(selectedDrawing.status??'')] ?? 'bg-gray-700 text-gray-300'}`}>
                  {String(selectedDrawing.status??'')}
                </span>
              </div>

              {Boolean(selectedDrawing.description) && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase">Notes</p>
                  <p className="text-sm text-gray-300 mt-1 bg-gray-700/30 p-2 rounded border border-gray-600">{String(selectedDrawing.description??'—')}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">Revision Timeline</p>
                <div className="space-y-2 bg-gray-700/30 rounded border border-gray-600 p-3">
                  {buildRevisions(selectedDrawing).slice(0,3).map((rev, idx)=>(
                    <div key={idx} className="flex items-center justify-between text-xs py-1">
                      <span className="font-mono font-bold text-gray-300">Rev {rev.letter}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${rev.status==='Current'?'bg-blue-900/40 text-blue-300':'bg-gray-600 text-gray-400'}`}>
                        {rev.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-700">
                {!!selectedDrawing.file_url && <a href={String(selectedDrawing.file_url)} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 rounded border border-blue-700 text-sm font-medium"><Download size={14}/>View</a>}
                <button type="button" onClick={()=>{setSelectedDrawing(null);openEdit(selectedDrawing);}} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm font-medium"><Edit2 size={14}/>Edit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-white">
                {modalMode === 'drawing' ? (editing ? 'Edit Drawing' : 'Register Drawing') : modalMode === 'revision' ? 'Issue New Revision' : 'New Transmittal'}
              </h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {modalMode === 'drawing' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Drawing Title *</label>
                    <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Drawing Number</label>
                    <input value={form.drawing_number} onChange={e=>setForm(f=>({...f,drawing_number:e.target.value}))} placeholder="CW-ARC-001" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Discipline</label>
                    <select value={form.discipline} onChange={e=>setForm(f=>({...f,discipline:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {DISCIPLINES.filter(d => d !== 'All').map(d=><option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Revision</label>
                    <input value={form.revision} onChange={e=>setForm(f=>({...f,revision:e.target.value}))} placeholder="A, B, C, etc." className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Status</label>
                    <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Scale</label>
                    <select value={form.scale} onChange={e=>setForm(f=>({...f,scale:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {SCALES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Project ID</label>
                    <input value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))} placeholder="Project identifier" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Issued By</label>
                    <input value={form.author} onChange={e=>setForm(f=>({...f,author:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Issue Date</label>
                    <input type="date" value={form.date_issued} onChange={e=>setForm(f=>({...f,date_issued:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">File / CAD URL</label>
                    <input type="url" value={form.file_url} onChange={e=>setForm(f=>({...f,file_url:e.target.value}))} placeholder="https://…" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Description / Notes</label>
                    <textarea rows={3} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                  </div>
                </div>
              )}

              {modalMode === 'revision' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Select Drawing *</label>
                    <select required value={revisionForm.drawingNumber} onChange={e=>setRevisionForm(f=>({...f,drawingNumber:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">Choose a drawing…</option>
                      {drawings.map(d=><option key={String(d.id)} value={String(d.drawing_number??'')}>{String(d.drawing_number??'')} - {String(d.title??'')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">New Revision Letter *</label>
                    <input required value={revisionForm.newRevision} onChange={e=>setRevisionForm(f=>({...f,newRevision:e.target.value}))} placeholder="C, D, etc." className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Description of Changes *</label>
                    <textarea required rows={3} value={revisionForm.description} onChange={e=>setRevisionForm(f=>({...f,description:e.target.value}))} placeholder="What changed in this revision?" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Reason for Issue *</label>
                    <select required value={revisionForm.reason} onChange={e=>setRevisionForm(f=>({...f,reason:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">Select reason…</option>
                      <option value="Design changes">Design changes</option>
                      <option value="Client feedback">Client feedback</option>
                      <option value="Regulatory update">Regulatory update</option>
                      <option value="Coordination issue">Coordination issue</option>
                      <option value="Error correction">Error correction</option>
                    </select>
                  </div>
                </div>
              )}

              {modalMode === 'transmittal' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Project *</label>
                    <input required value={transmittalForm.project} onChange={e=>setTransmittalForm(f=>({...f,project:e.target.value}))} placeholder="Project name" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Drawings Included *</label>
                    <textarea required rows={3} value={transmittalForm.drawings} onChange={e=>setTransmittalForm(f=>({...f,drawings:e.target.value}))} placeholder="Drawing numbers, one per line" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none font-mono"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Issued To *</label>
                    <input required value={transmittalForm.issuedTo} onChange={e=>setTransmittalForm(f=>({...f,issuedTo:e.target.value}))} placeholder="Recipient name/company" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Purpose *</label>
                    <select required value={transmittalForm.purpose} onChange={e=>setTransmittalForm(f=>({...f,purpose:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {PURPOSE_CODES.map(p=><option key={p}>{p} - {p==='IFC'?'Issued for Construction':p==='IFT'?'Issued for Tender':p==='IFR'?'Issued for Review':'Issued for Information'}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
                  {modalMode === 'drawing' ? (editing ? 'Update' : 'Register') : modalMode === 'revision' ? 'Issue Revision' : 'Create Transmittal'}
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
export default Drawings;
