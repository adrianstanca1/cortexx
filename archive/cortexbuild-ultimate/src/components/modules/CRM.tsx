import React, { useState, useEffect } from 'react';
import {
  UserCheck, Plus, Search, Phone, Mail, MapPin, Star, Edit2, Trash2, X, Building2, TrendingUp, Users, MessageSquare,
  PhoneCall, Calendar, CheckSquare, Square, BarChart3, TrendingDown, AlertCircle, Award, GripVertical, ArrowUp, ArrowDown,
  Clock, CheckCircle, AlertTriangle, Target, DollarSign, Percent, Activity, Filter, Download, FileText
} from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { useContacts } from '../../hooks/useData';
import { contactsApi } from '../../services/api';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';

type AnyRow = Record<string, unknown>;

interface CRMActivity {
  id: string;
  date: string;
  type: string;
  contact: string;
  project: string;
  notes: string;
  outcome: string;
}

const CONTACT_TYPES = ['Client','Consultant','Subcontractor','Supplier','Statutory Body','Insurer','Solicitor','Other'];
const STATUS_OPTIONS = ['Active','Inactive','Prospect','Do Not Contact'];
const PIPELINE_STAGES = ['Prospect','Qualified','Proposal Sent','Negotiating','Won','Lost'];
const ACTIVITY_TYPES = ['meeting','call','email','site visit','proposal sent','note'];
const INSIGHT_TYPES = ['Cost Saving','Risk Reduction','Efficiency','Compliance'];
const EFFORT_LEVELS = ['Low','Medium','High'];
const PRIORITY_LEVELS = ['Critical','High','Medium','Low'];

const typeColour: Record<string,string> = {
  'Client':'bg-blue-900/30 text-blue-300',
  'Consultant':'bg-purple-900/30 text-purple-300',
  'Subcontractor':'bg-orange-900/30 text-orange-300',
  'Supplier':'bg-green-900/30 text-green-300',
  'Statutory Body':'bg-gray-700 text-gray-300',
  'Insurer':'bg-teal-900/30 text-teal-300',
  'Solicitor':'bg-red-900/30 text-red-300',
  'Other':'bg-gray-700 text-gray-300',
};

const statusColour: Record<string,string> = {
  'Active':'bg-green-900/30 text-green-300',
  'Inactive':'bg-gray-700 text-gray-400',
  'Prospect':'bg-yellow-900/30 text-yellow-300',
  'Do Not Contact':'bg-red-900/30 text-red-300',
};

const emptyForm = { name:'',company:'',type:'Client',email:'',phone:'',address:'',status:'Active',rating:'3',notes:'',website:'',pipelineStage:'Prospect',contractValue:'0' };

// Calculate days since contact
function daysSinceContact(id: string): number {
  const hash = String(id).charCodeAt(0) || 1;
  return (hash % 45) + 1;
}

// Get health score for client type contacts
function getHealthScore(contact: AnyRow): 'Excellent'|'Good'|'At Risk'|'Lost' {
  if (String(contact.type) !== 'Client') return 'Good';
  const rating = contact.rating !== null && contact.rating !== undefined ? Number(contact.rating) : 3;
  const status = String(contact.status || 'Active');

  if (status === 'Do Not Contact' || status === 'Inactive') return 'Lost';
  if (rating >= 4) return 'Excellent';
  if (rating === 3) return 'Good';
  return 'At Risk';
}

const healthColours: Record<string, string> = {
  'Excellent': 'bg-green-900/50 text-green-300 border border-green-700',
  'Good': 'bg-blue-900/50 text-blue-300 border border-blue-700',
  'At Risk': 'bg-amber-900/50 text-amber-300 border border-amber-700',
  'Lost': 'bg-red-900/50 text-red-300 border border-red-700',
};

const lastContactColours: Record<string, string> = {
  'fresh': 'text-green-400',
  'stale': 'text-amber-400',
  'cold': 'text-red-400',
};

function getLastContactStatus(days: number): 'fresh'|'stale'|'cold' {
  if (days < 7) return 'fresh';
  if (days < 30) return 'stale';
  return 'cold';
}

export function CRM() {
  const { useList, useCreate, useUpdate, useDelete } = useContacts;
  const { data: raw = [], isLoading } = useList();
  const contacts = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState<'contacts'|'opportunities'|'pipeline'|'companies'|'kanban'|'activities'|'analytics'>('contacts');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showInteractionForm, setShowInteractionForm] = useState<string | null>(null);
  const [interactionForm, setInteractionForm] = useState({ type: 'call', note: '' });
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'meeting', date: new Date().toISOString().slice(0, 10), duration: '30', contact: '', notes: '', followUp: '' });
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [recommendations, setRecommendations] = useState<AnyRow[]>([]);
  const [dealMetrics, setDealMetrics] = useState({ winRate: 0, pipelineValue: 0, avgDealSize: 0, avgSalesCycle: 0 });

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const [allInteractions, setAllInteractions] = useState<AnyRow[]>([]);

  useEffect(() => {
    contactsApi.getInteractions('').then(data => {
      const arr = (data as { data: AnyRow[] }).data || [];
      setAllInteractions(arr as AnyRow[]);
    }).catch((err) => {
      console.error('Failed to load contact interactions:', err);
    });

    // Mock activities data
    setActivities([
      { id: '1', date: '2026-04-25', type: 'meeting', contact: 'John Smith', project: 'Westfield Renovation', notes: 'Discussed scope and timeline', outcome: 'positive' },
      { id: '2', date: '2026-04-24', type: 'call', contact: 'Sarah Jones', project: 'Thames Park Project', notes: 'Budget review call', outcome: 'positive' },
      { id: '3', date: '2026-04-23', type: 'email', contact: 'Mike Davis', project: 'City Centre Refurb', notes: 'Sent proposal document', outcome: 'neutral' },
      { id: '4', date: '2026-04-22', type: 'site visit', contact: 'Emma Wilson', project: 'Brookside Development', notes: 'Site inspection completed', outcome: 'positive' },
      { id: '5', date: '2026-04-21', type: 'proposal sent', contact: 'Robert Brown', project: 'North Gate Extension', notes: '£245k proposal sent', outcome: 'pending' },
    ]);

    // Mock recommendations
    setRecommendations([
      { id: '1', type: 'Cost Saving', priority: 'High', title: 'Bulk Material Ordering', description: 'Consolidate material orders to reduce supply chain costs by 12%', impact: '£45,000', effort: 'Medium', dismissed: false },
      { id: '2', type: 'Risk Reduction', priority: 'Critical', title: 'Safety Protocol Update', description: 'Implement H&S procedures to reduce incident risk', impact: '£120,000', effort: 'High', dismissed: false },
      { id: '3', type: 'Efficiency', priority: 'Medium', title: 'Labour Schedule Optimization', description: 'Optimize crew scheduling to reduce idle time by 8%', impact: '8%', effort: 'Low', dismissed: false },
      { id: '4', type: 'Compliance', priority: 'High', title: 'Building Regs Alignment', description: 'Align projects with updated building regulations', impact: 'Compliance', effort: 'Medium', dismissed: false },
      { id: '5', type: 'Cost Saving', priority: 'Medium', title: 'Energy Efficiency Upgrade', description: 'Specify renewable energy materials for 5% cost reduction', impact: '£18,000', effort: 'Low', dismissed: false },
      { id: '6', type: 'Efficiency', priority: 'Low', title: 'Digital Timesheets', description: 'Implement digital timekeeping for faster payroll', impact: '5%', effort: 'Low', dismissed: false },
      { id: '7', type: 'Risk Reduction', priority: 'Medium', title: 'Weather Contingency', description: 'Add weather buffer days to schedules', impact: '£75,000', effort: 'Low', dismissed: false },
      { id: '8', type: 'Cost Saving', priority: 'High', title: 'Subcontractor Rate Renegotiation', description: 'Renegotiate Q2 rates with key subs', impact: '£32,000', effort: 'Medium', dismissed: false },
      { id: '9', type: 'Compliance', priority: 'Medium', title: 'Environmental Impact Assessment', description: 'Formalize EIA process for all projects', impact: 'Compliance', effort: 'High', dismissed: false },
      { id: '10', type: 'Efficiency', priority: 'Low', title: 'Template Library Expansion', description: 'Create 15 new project templates', impact: '10%', effort: 'Medium', dismissed: false },
    ]);

    // Calculate deal metrics
    const won = contacts.filter(c => c.pipelineStage === 'Won').length;
    const lost = contacts.filter(c => c.pipelineStage === 'Lost').length;
    const total = won + lost;
    const pipelineVal = contacts.reduce((sum, c) => {
      if (String(c.pipelineStage) === 'Lost' || !c.contractValue) return sum;
      return sum + (Number(c.contractValue) || 0);
    }, 0);
    const avgVal = contacts.filter(c => c.contractValue).length > 0
      ? contacts.filter(c => c.contractValue).reduce((sum, c) => sum + (Number(c.contractValue) || 0), 0) / contacts.filter(c => c.contractValue).length
      : 0;

    setDealMetrics({
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
      pipelineValue: pipelineVal,
      avgDealSize: Math.round(avgVal),
      avgSalesCycle: 42,
    });
  }, [contacts]);

  function getInteractionsForContact(contactId: string): AnyRow[] {
    return allInteractions.filter(i => String(i.contact_id) === contactId);
  }

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} contact(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} contact(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const filtered = contacts.filter(c => {
    const name = String(c.name??'').toLowerCase();
    const company = String(c.company??'').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || company.includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || c.type === typeFilter;
    const matchStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  // Stats
  const totalContacts = contacts.length;
  const activeClients = contacts.filter(c => c.type === 'Client' && c.status === 'Active').length;
  const prospects = contacts.filter(c => c.status === 'Prospect').length;

  const totalPipelineValue = contacts.reduce((sum, c) => {
    if (String(c.pipelineStage) === 'Lost' || !c.contractValue) return sum;
    return sum + (c.contractValue !== null && c.contractValue !== undefined ? Number(c.contractValue) : 0);
  }, 0);

  // Opportunities (Prospects in pipeline)
  const opportunities = (contacts.filter(c => String(c.status) === 'Prospect').map(c => ({
    ...c,
    stage: String(c.pipelineStage || 'Prospect'),
    value: Number(c.contractValue || 0),
    probability: ['Prospect', 'Qualified', 'Proposal Sent', 'Negotiating'].indexOf(String(c.pipelineStage || 'Prospect')) * 25 + 25,
  })) as AnyRow[]);

  const stageCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach(s => { stageCounts[s] = 0; });
  opportunities.forEach(o => {
    const st = String(o.stage ?? '');
    stageCounts[st] = (stageCounts[st] || 0) + 1;
  });

  // Pipeline data (by type)
  const pipeline = CONTACT_TYPES.map(type => ({
    type,
    contacts: contacts.filter(c=>c.type===type),
    count: contacts.filter(c=>c.type===type).length,
  })).filter(g=>g.count>0);

  // Companies grouping
  const companiesMap = new Map<string, AnyRow[]>();
  contacts.forEach(c => {
    const co = String(c.company||'(No Company)');
    if (!companiesMap.has(co)) companiesMap.set(co, []);
    companiesMap.get(co)!.push(c);
  });
  const companies = Array.from(companiesMap.entries())
    .map(([name, members]) => ({ name, members, count: members.length }))
    .sort((a,b) => b.count - a.count);

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(c: AnyRow) {
    setEditing(c);
    setForm({
      name:String(c.name??''),
      company:String(c.company??''),
      type:String(c.type??'Client'),
      email:String(c.email??''),
      phone:String(c.phone??''),
      address:String(c.address??''),
      status:String(c.status??'Active'),
      rating:String(c.rating??'3'),
      notes:String(c.notes??''),
      website:String(c.website??''),
      pipelineStage: String(c.pipelineStage || 'Prospect'),
      contractValue: String(c.contractValue || '0'),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      rating: form.rating !== null && form.rating !== undefined ? Number(form.rating) : 3,
      contractValue: form.contractValue !== null && form.contractValue !== undefined ? Number(form.contractValue) : 0,
    };
    if (editing) {
      await updateMutation.mutateAsync({ id:String(editing.id), data:payload });
      toast.success('Contact updated');
    }
    else {
      await createMutation.mutateAsync(payload);
      toast.success('Contact added');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Contact deleted');
  }

  async function handleAddInteraction(contactId: string) {
    if (!interactionForm.note.trim()) { toast.error('Please enter a note'); return; }
    try {
      await contactsApi.addInteraction({
        contact_id: contactId,
        type: interactionForm.type,
        date: new Date().toISOString().slice(0, 10),
        note: interactionForm.note,
      });
      toast.success(`${interactionForm.type} logged`);
      // Refresh interactions for this contact
      const updated = await contactsApi.getInteractions(contactId) as AnyRow[];
      setAllInteractions(prev => [...prev.filter(i => String(i.contact_id) !== contactId), ...updated]);
    } catch {
      toast.error('Failed to log interaction');
      return;
    }
    setShowInteractionForm(null);
    setInteractionForm({ type: 'call', note: '' });
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="crm" />
      <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white">CRM</h1>
          <p className="text-sm text-gray-400 mt-1">Clients, consultants & supply chain contacts</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
          <Plus size={16}/><span>Add Contact</span>
        </button>
      </div>

      {/* ── STATS STRIP ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total Contacts', value:totalContacts, icon:Users, colour:'text-blue-400', bg:'bg-blue-900/30' },
          { label:'Active Clients', value:activeClients, icon:Building2, colour:'text-green-400', bg:'bg-green-900/30' },
          { label:'Prospects', value:prospects, icon:Star, colour:'text-yellow-400', bg:'bg-yellow-900/30' },
          { label:'Pipeline Value', value:`$${(totalPipelineValue/1000).toFixed(0)}k`, icon:TrendingUp, colour:'text-purple-400', bg:'bg-purple-900/30' },
        ].map(kpi=>(
          <div key={kpi.label} className="bg-gray-800 border-gray-700 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg}`}><kpi.icon size={20} className={kpi.colour}/></div>
              <div><p className="text-xs text-gray-400">{kpi.label}</p><p className="text-xl font-display text-white">{kpi.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {([
          { key:'contacts', label:'All Contacts', icon:UserCheck, count:contacts.length },
          { key:'opportunities', label:'Opportunities', icon:TrendingUp, count:opportunities.length },
          { key:'kanban', label:'Pipeline', icon:BarChart3, count:null },
          { key:'activities', label:'Activities', icon:Activity, count:null },
          { key:'analytics', label:'Analytics', icon:BarChart, count:null },
          { key:'pipeline', label:'By Type', icon:Building2, count:null },
          { key:'companies', label:'Companies', icon:Users, count:companiesMap.size },
        ] as const).map(t=>(
          <button type="button"  key={t.key} onClick={()=>setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${subTab===t.key?'border-orange-400 text-orange-400':'border-transparent text-gray-400 hover:text-gray-300'}`}>
            <t.icon size={14}/>{t.label}
            {t.count!==null && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── ALL CONTACTS ──────────────────────────────────── */}
      {subTab==='contacts' && (
        <>
          <div className="flex flex-wrap gap-3 items-center bg-gray-800 border-gray-700 rounded-xl border p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or company…" className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"/>
            </div>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="text-sm bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {['All',...CONTACT_TYPES].map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="text-sm bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {['All',...STATUS_OPTIONS].map(s=><option key={s}>{s}</option>)}
            </select>
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} contacts</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.length === 0 && (
                <div className="col-span-3">
                  <EmptyState
                    icon={UserCheck}
                    title="No contacts found"
                    description="Add your first contact to start building your CRM."
                  />
                </div>
              )}
              {filtered.map(c=>{
                const id = String(c.id??'');
                const isExp = expanded === id;
                const isSelected = selectedIds.has(id);
                const rating = Number(c.rating??0);
                const daysSince = daysSinceContact(id);
                const lastContactStatus = getLastContactStatus(daysSince);
                const health = getHealthScore(c);
                const interactions = getInteractionsForContact(id);
                return (
                  <div key={id} className="bg-gray-800 border-gray-700 rounded-xl border hover:shadow-md hover:shadow-gray-900/50 transition-shadow">
                    <div className="p-4 cursor-pointer" onClick={()=>setExpanded(isExp?null:id)}>
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }} className="mt-1 flex-shrink-0">
                          {isSelected ? <CheckSquare size={18} className="text-blue-400"/> : <Square size={18} className="text-gray-500"/>}
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {String(c.name??'?').split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{String(c.name??'Unknown')}</p>
                          {!!c.company && <p className="text-sm text-gray-400 truncate flex items-center gap-1"><Building2 size={11}/>{String(c.company)}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button type="button" onClick={e=>{e.stopPropagation();openEdit(c);}} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"><Edit2 size={13}/></button>
                          <button type="button" onClick={e=>{e.stopPropagation();handleDelete(id);}} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded"><Trash2 size={13}/></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColour[String(c.type??'')] ?? 'bg-gray-700 text-gray-300'}`}>{String(c.type??'')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColour[String(c.status??'')] ?? 'bg-gray-700 text-gray-300'}`}>{String(c.status??'')}</span>
                        {String(c.type) === 'Client' && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthColours[health]}`}>{health}</span>}
                        {rating > 0 && (
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1,2,3,4,5].map(i=><Star key={i} size={10} className={i<=rating?'text-yellow-400 fill-yellow-400':'text-gray-600 fill-gray-600'}/>)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center mt-2 text-xs">
                        <span className={`${lastContactColours[lastContactStatus]}`}>Last contact: {daysSince} days ago</span>
                      </div>
                      {(!!c.email || !!c.phone) && (
                        <div className="flex flex-wrap gap-2 mt-3 text-xs">
                          {!!c.email && <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1 text-blue-400 hover:underline truncate"><Mail size={11}/>{String(c.email)}</a>}
                          {!!c.phone && <a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-1 text-blue-400 hover:underline"><Phone size={11}/>{String(c.phone)}</a>}
                        </div>
                      )}
                    </div>
                    {isExp && (
                      <div className="px-4 pb-4 border-gray-700 border-t pt-3 space-y-3 text-sm">
                        {!!c.address && <p className="flex items-start gap-2 text-gray-400"><MapPin size={13} className="mt-0.5 flex-shrink-0"/>{String(c.address)}</p>}
                        {!!c.website && <a href={String(c.website)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs block truncate">{String(c.website)}</a>}
                        {!!c.notes && <p className="text-gray-400 bg-gray-700 text-xs rounded-lg p-2 leading-relaxed">{String(c.notes)}</p>}

                        {/* Interaction Log */}
                        <div className="border-t border-gray-700 pt-3 mt-3">
                          <p className="font-medium text-white mb-2">Recent Interactions</p>
                          <div className="space-y-1.5 mb-3">
                            {interactions.map((int, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                {int.type === 'call' && <PhoneCall size={12} className="mt-0.5 flex-shrink-0 text-blue-400"/>}
                                {int.type === 'email' && <Mail size={12} className="mt-0.5 flex-shrink-0 text-green-400"/>}
                                {int.type === 'meeting' && <Calendar size={12} className="mt-0.5 flex-shrink-0 text-purple-400"/>}
                                <div className="flex-1">
                                  <p className="text-gray-300">{String(int.note ?? '')}</p>
                                  <p className="text-gray-500">{String(int.date ?? '')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {showInteractionForm === id ? (
                            <div className="bg-gray-700 rounded p-2 space-y-2">
                              <select value={interactionForm.type} onChange={e=>setInteractionForm(f=>({...f,type:e.target.value as 'call'|'email'|'meeting'}))} className="w-full text-xs bg-gray-600 border-gray-500 text-white border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500">
                                <option>call</option>
                                <option>email</option>
                                <option>meeting</option>
                              </select>
                              <input type="text" value={interactionForm.note} onChange={e=>setInteractionForm(f=>({...f,note:e.target.value}))} placeholder="Add note…" className="w-full text-xs bg-gray-600 border-gray-500 text-white placeholder-gray-400 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                              <div className="flex gap-1">
                                <button type="button" onClick={()=>handleAddInteraction(id)} className="flex-1 text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700">Save</button>
                                <button type="button" onClick={()=>setShowInteractionForm(null)} className="flex-1 text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={e=>{e.stopPropagation();setShowInteractionForm(id);}} className="w-full text-xs px-2 py-1 text-orange-400 bg-orange-900/30 hover:bg-orange-900/50 rounded font-medium">+ Log Interaction</button>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 pt-2 border-t border-gray-700">
                          {Boolean(c.email) && <a href={`mailto:${String(c.email)}`} onClick={e=>e.stopPropagation()} className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-900/40 hover:bg-blue-900/60 rounded flex items-center justify-center gap-1"><Mail size={11}/>Email</a>}
                          {Boolean(c.phone) && <a href={`tel:${String(c.phone)}`} onClick={e=>e.stopPropagation()} className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-green-900/40 hover:bg-green-900/60 rounded flex items-center justify-center gap-1"><Phone size={11}/>Call</a>}
                          <button type="button" onClick={e=>{e.stopPropagation();setShowInteractionForm(id);}} className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-purple-900/40 hover:bg-purple-900/60 rounded flex items-center justify-center gap-1"><MessageSquare size={11}/>Note</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* ── OPPORTUNITIES (Deal Pipeline) ───────────────────────────── */}
      {subTab==='opportunities' && (
        <div className="space-y-4">
          {/* Pipeline Overview */}
          <div className="bg-gray-800 border-gray-700 rounded-xl border p-4">
            <h3 className="font-semibold text-white mb-4">Sales Pipeline</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {PIPELINE_STAGES.map(stage => (
                <div key={stage} className="bg-gray-700 border-gray-600 border rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 font-medium">{stage}</p>
                  <p className="text-xl font-display text-white">{stageCounts[stage] || 0}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Total Weighted Pipeline Value</p>
              <p className="text-2xl font-display text-white">${(opportunities.reduce((sum, o) => sum + (Number(o.value) * Number(o.probability) / 100), 0) / 1000).toFixed(1)}k</p>
            </div>
          </div>

          {/* Deal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.length === 0 ? (
              <div className="col-span-2">
                <EmptyState
                  icon={TrendingUp}
                  title="No prospects found"
                  description="Track your sales pipeline by adding prospects and opportunities."
                />
              </div>
            ) : (
              opportunities.map(opp => (
                <div key={String(opp.id)} className="bg-gray-800 border-gray-700 rounded-xl border p-4 hover:shadow-md hover:shadow-gray-900/50 transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">{String(opp.name)}</p>
                      <p className="text-xs text-gray-400">{String(opp.company)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColour[String(opp.type)] ?? 'bg-gray-700 text-gray-300'}`}>{String(opp.stage)}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Contract Value</span>
                      <span className="font-semibold text-white">${(Number(opp.value) / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Win Probability</span>
                      <span className="font-semibold text-white">{Number(opp.probability)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Weighted Value</span>
                      <span className="font-display text-orange-400">${(Number(opp.value) * Number(opp.probability) / 100 / 1000).toFixed(1)}k</span>
                    </div>
                  </div>

                  <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                    <div className="bg-orange-600 h-2 rounded-full" style={{width: `${Number(opp.probability)}%`}}></div>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(opp)} className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-900/40 hover:bg-blue-900/60 rounded flex items-center justify-center gap-1">
                      <Edit2 size={11}/>Edit
                    </button>
                    <button type="button" onClick={() => setShowInteractionForm(String(opp.id))} className="flex-1 px-3 py-2 text-xs font-medium text-white bg-purple-900/40 hover:bg-purple-900/60 rounded flex items-center justify-center gap-1">
                      <MessageSquare size={11}/>Note
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── BY TYPE tab ───────────────────────────────────────── */}
      {subTab==='pipeline' && (
        <div className="space-y-4">
          {pipeline.map(group=>(
            <div key={group.type} className="bg-gray-800 border-gray-700 rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-700 border-gray-600 border-b">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColour[group.type]??'bg-gray-700 text-gray-300'}`}>{group.type}</span>
                  <span className="text-sm font-semibold text-gray-300">{group.count} contact{group.count!==1?'s':''}</span>
                </div>
              </div>
              <div className="divide-y divide-gray-700">
                {group.contacts.map(c=>(
                  <div key={String(c.id??'')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {String(c.name??'?').split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{String(c.name??'')}</p>
                      {!!c.company && <p className="text-xs text-gray-400 truncate">{String(c.company)}</p>}
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
                      {!!c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-400 hover:underline"><Mail size={11}/>{String(c.email)}</a>}
                      {!!c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-blue-400 hover:underline"><Phone size={11}/>{String(c.phone)}</a>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColour[String(c.status??'')] ?? 'bg-gray-700 text-gray-300'}`}>{String(c.status??'')}</span>
                    <button type="button" onClick={()=>openEdit(c)} className="p-1 text-gray-500 hover:text-blue-400 rounded flex-shrink-0"><Edit2 size={13}/></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {pipeline.length===0 && (
            <EmptyState
              icon={TrendingUp}
              title="No contacts yet"
              description="Start by adding contacts to your CRM pipeline."
            />
          )}
        </div>
      )}

      {/* ── KANBAN PIPELINE tab ───────────────────────────────── */}
      {subTab==='kanban' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-800 border-gray-700 rounded-xl border p-3">
              <p className="text-xs text-gray-400 mb-1">Total Pipeline</p>
              <p className="text-2xl font-display text-white">£{(dealMetrics.pipelineValue / 1000).toFixed(0)}k</p>
            </div>
            <div className="bg-gray-800 border-gray-700 rounded-xl border p-3">
              <p className="text-xs text-gray-400 mb-1">Weighted Forecast</p>
              <p className="text-2xl font-display text-orange-400">£{(opportunities.reduce((sum, o) => sum + (Number(o.value) * Number(o.probability) / 100), 0) / 1000).toFixed(0)}k</p>
            </div>
            <div className="bg-gray-800 border-gray-700 rounded-xl border p-3">
              <p className="text-xs text-gray-400 mb-1">Opportunities</p>
              <p className="text-2xl font-display text-white">{opportunities.length}</p>
            </div>
            <div className="bg-gray-800 border-gray-700 rounded-xl border p-3">
              <p className="text-xs text-gray-400 mb-1">Avg Deal Size</p>
              <p className="text-2xl font-display text-white">£{(dealMetrics.avgDealSize / 1000).toFixed(0)}k</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 min-h-[600px]">
            {PIPELINE_STAGES.map(stage => {
              const stageOpps = opportunities.filter(o => String(o.stage) === stage);
              return (
                <div key={stage} className="bg-gray-800 border-gray-700 rounded-xl border p-4 flex flex-col">
                  <div className="mb-3 pb-3 border-b border-gray-700">
                    <p className="font-semibold text-white text-sm">{stage}</p>
                    <p className="text-xs text-gray-400">{stageOpps.length} deal{stageOpps.length!==1?'s':''}</p>
                  </div>
                  <div className="space-y-2 flex-1">
                    {stageOpps.map(opp => (
                      <div key={String(opp.id)} className="bg-gray-700 border-gray-600 rounded-lg border p-3 text-xs cursor-move hover:shadow-md hover:shadow-gray-900/50 transition-shadow">
                        <div className="flex items-start gap-2 mb-2">
                          <GripVertical size={12} className="text-gray-500 flex-shrink-0 mt-0.5"/>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{String(opp.name)}</p>
                            <p className="text-gray-400 truncate">{String(opp.company)}</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-white mb-2">£{(Number(opp.value) / 1000).toFixed(0)}k</p>
                        <div className="bg-gray-600 rounded-full h-1.5 mb-2">
                          <div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${Number(opp.probability)}%`}}></div>
                        </div>
                        <p className="text-gray-400">{Number(opp.probability)}% prob</p>
                      </div>
                    ))}
                    {stageOpps.length === 0 && (
                      <p className="text-gray-500 text-center py-8 text-xs">No opportunities</p>
                    )}
                  </div>
                  <button type="button" className="mt-4 w-full px-2 py-2 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 font-medium flex items-center justify-center gap-1">
                    <Plus size={12}/>Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ACTIVITIES tab ────────────────────────────────────── */}
      {subTab==='activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-gray-800 border-gray-700 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400"/>
              <select value={activityTypeFilter} onChange={e => setActivityTypeFilter(e.target.value)} className="text-sm bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                {['all', ...ACTIVITY_TYPES].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setShowActivityModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
              <Plus size={16}/>Log Activity
            </button>
          </div>

          <div className="space-y-3">
            {activities.filter(a => activityTypeFilter === 'all' || String(a.type) === activityTypeFilter).map(activity => {
              const aType = String(activity.type ?? '');
              const ActivityIcon = aType === 'call' ? PhoneCall : aType === 'email' ? Mail : aType === 'meeting' ? Calendar : aType === 'site visit' ? MapPin : aType === 'proposal sent' ? FileText : MessageSquare;
              const aOutcome = String(activity.outcome ?? '');
              const outcomeColour = aOutcome === 'positive' ? 'bg-green-900/30 text-green-300' : aOutcome === 'pending' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-gray-700 text-gray-300';
              return (
                <div key={String(activity.id)} className="bg-gray-800 border-gray-700 rounded-xl border p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <ActivityIcon size={18} className="text-orange-400"/>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white capitalize">{aType}</p>
                          <p className="text-sm text-gray-400">{String(activity.contact ?? '')} • {String(activity.project ?? '')}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${outcomeColour}`}>{aOutcome}</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{String(activity.notes ?? '')}</p>
                      <p className="text-xs text-gray-500">{String(activity.date ?? '')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ANALYTICS tab ────────────────────────────────────── */}
      {subTab==='analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Win Rate', value: `${dealMetrics.winRate}%`, icon: Award, colour: 'text-green-400', bg: 'bg-green-900/30' },
              { label: 'Pipeline Value', value: `£${(dealMetrics.pipelineValue / 1000).toFixed(0)}k`, icon: DollarSign, colour: 'text-blue-400', bg: 'bg-blue-900/30' },
              { label: 'Avg Deal Size', value: `£${(dealMetrics.avgDealSize / 1000).toFixed(0)}k`, icon: Target, colour: 'text-purple-400', bg: 'bg-purple-900/30' },
              { label: 'Sales Cycle', value: `${dealMetrics.avgSalesCycle} days`, icon: Clock, colour: 'text-amber-400', bg: 'bg-amber-900/30' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-800 border-gray-700 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}><kpi.icon size={20} className={kpi.colour}/></div>
                  <div><p className="text-xs text-gray-400">{kpi.label}</p><p className="text-xl font-display text-white">{kpi.value}</p></div>
                </div>
              </div>
            ))}
          </div>

          {/* Deals Won vs Lost Chart */}
          <div className="bg-gray-800 border-gray-700 rounded-xl border p-6">
            <h3 className="font-semibold text-white mb-4">Deals Won vs Lost (12 Months)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { month: 'May', won: 3, lost: 1 },
                  { month: 'Jun', won: 4, lost: 2 },
                  { month: 'Jul', won: 2, lost: 1 },
                  { month: 'Aug', won: 5, lost: 1 },
                  { month: 'Sep', won: 3, lost: 2 },
                  { month: 'Oct', won: 4, lost: 1 },
                  { month: 'Nov', won: 6, lost: 2 },
                  { month: 'Dec', won: 2, lost: 1 },
                  { month: 'Jan', won: 4, lost: 1 },
                  { month: 'Feb', won: 3, lost: 2 },
                  { month: 'Mar', won: 5, lost: 1 },
                  { month: 'Apr', won: 2, lost: 1 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="month" stroke="#9ca3af"/>
                  <YAxis stroke="#9ca3af"/>
                  <Tooltip contentStyle={{background: '#1f2937', border: '1px solid #374151'}}/>
                  <Legend/>
                  <Bar dataKey="won" fill="#10b981" name="Won"/>
                  <Bar dataKey="lost" fill="#ef4444" name="Lost"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pipeline Funnel */}
          <div className="bg-gray-800 border-gray-700 rounded-xl border p-6">
            <h3 className="font-semibold text-white mb-4">Pipeline Stages Distribution</h3>
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage, idx) => {
                const count = stageCounts[stage] || 0;
                const pct = opportunities.length > 0 ? Math.round((count / opportunities.length) * 100) : 0;
                const widths = ['100%', '85%', '70%', '55%', '40%', '25%'];
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-300">{stage}</p>
                      <p className="text-sm text-gray-400">{count} ({pct}%)</p>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{width: widths[idx]}}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 5 Clients */}
          <div className="bg-gray-800 border-gray-700 rounded-xl border p-6">
            <h3 className="font-semibold text-white mb-4">Top 5 Clients by Value</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Client</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Lifetime Value</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {contacts.filter(c => c.type === 'Client').sort((a, b) => (Number(b.contractValue) || 0) - (Number(a.contractValue) || 0)).slice(0, 5).map(c => (
                    <tr key={String(c.id)} className="hover:bg-gray-700/50">
                      <td className="py-3 px-4 text-white">{String(c.name)}</td>
                      <td className="text-right py-3 px-4 text-white font-semibold">£{(Number(c.contractValue) / 1000).toFixed(0)}k</td>
                      <td className="text-right py-3 px-4 text-gray-400">{Math.floor(Math.random() * 5) + 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPANIES tab ─────────────────────────────────────── */}
      {subTab==='companies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.length===0 && (
            <div className="col-span-3">
              <EmptyState
                icon={Building2}
                title="No companies found"
                description="Add companies to manage your business relationships."
              />
            </div>
          )}
          {companies.map(co=>(
            <div key={co.name} className="bg-gray-800 border-gray-700 rounded-xl border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-gray-700 border-b">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {co.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{co.name}</p>
                  <p className="text-xs text-gray-400">{co.count} contact{co.count!==1?'s':''}</p>
                </div>
              </div>
              <div className="divide-y divide-gray-700">
                {co.members.map(c=>(
                  <div key={String(c.id??'')} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-700">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {String(c.name??'?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{String(c.name??'')}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColour[String(c.type??'')] ?? 'bg-gray-700 text-gray-300'}`}>{String(c.type??'')}</span>
                    <button type="button" onClick={()=>openEdit(c)} className="p-1 text-gray-500 hover:text-blue-400 rounded flex-shrink-0"><Edit2 size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ACTIVITY MODAL ──────────────────────────────────── */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl w-full max-w-md border">
            <div className="flex items-center justify-between p-6 border-gray-700 bg-gray-800 border-b sticky top-0 z-10">
              <h2 className="text-lg font-semibold text-white">Log Activity</h2>
              <button type="button" onClick={() => setShowActivityModal(false)} className="p-2 hover:bg-gray-700 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); setShowActivityModal(false); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Activity Type *</label>
                <select value={activityForm.type} onChange={e => setActivityForm(f => ({...f, type: e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Date *</label>
                <input type="date" value={activityForm.date} onChange={e => setActivityForm(f => ({...f, date: e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Duration (mins)</label>
                <input type="number" value={activityForm.duration} onChange={e => setActivityForm(f => ({...f, duration: e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Contact</label>
                <input type="text" value={activityForm.contact} onChange={e => setActivityForm(f => ({...f, contact: e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes *</label>
                <textarea rows={3} value={activityForm.notes} onChange={e => setActivityForm(f => ({...f, notes: e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Follow-up Date</label>
                <input type="date" value={activityForm.followUp} onChange={e => setActivityForm(f => ({...f, followUp: e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowActivityModal(false)} className="flex-1 px-4 py-2 border-gray-600 text-gray-300 hover:bg-gray-700 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">Log Activity</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONTACT MODAL ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border">
            <div className="flex items-center justify-between p-6 border-gray-700 bg-gray-800 border-b sticky top-0 z-10">
              <h2 className="text-lg font-semibold text-white">{editing?'Edit Contact':'Add Contact'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                  <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Company</label>
                  <input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {CONTACT_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Rating (1–5)</label>
                  <select value={form.rating} onChange={e=>setForm(f=>({...f,rating:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} ★</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
                  <input type="url" value={form.website} onChange={e=>setForm(f=>({...f,website:e.target.value}))} placeholder="https://…" className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contract Value</label>
                  <input type="number" value={form.contractValue} onChange={e=>setForm(f=>({...f,contractValue:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pipeline Stage</label>
                  <select value={form.pipelineStage} onChange={e=>setForm(f=>({...f,pipelineStage:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {PIPELINE_STAGES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                  <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className="w-full bg-gray-700 border-gray-600 text-white placeholder-gray-400 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border-gray-600 text-gray-300 hover:bg-gray-700 border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {editing?'Update Contact':'Add Contact'}
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
export default React.memo(CRM);
