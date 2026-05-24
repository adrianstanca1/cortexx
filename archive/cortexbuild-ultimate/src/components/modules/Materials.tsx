import React, { useState } from 'react';
import { Package, Plus, Search, Truck, BarChart3, AlertTriangle, CheckCircle2, Clock, Edit2, Trash2, X, DollarSign, TrendingUp, Filter, CheckSquare, Square } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMaterials } from '../../hooks/useData';
import { toast } from 'sonner';

type AnyRow = Record<string, unknown>;

const STATUS_OPTIONS = ['On Order','In Transit','Delivered','On Site','Used','Returned'];
const UNITS = ['m','m²','m³','kg','tonne','nr','bag','roll','sheet','lm','set'];
const CATEGORIES = ['Concrete & Cement','Steel & Metalwork','Timber','Brickwork & Masonry','Roofing','Insulation','Electrical','Plumbing','Finishes','Plant Hire','PPE & Safety','Other'];

const statusColour: Record<string,string> = {
  'On Order':'bg-yellow-900/30 text-yellow-300','In Transit':'bg-blue-900/30 text-blue-300',
  'Delivered':'bg-gray-700/30 text-gray-300','On Site':'bg-green-900/30 text-green-300',
  'Used':'bg-gray-700/30 text-gray-300','Returned':'bg-gray-700/30 text-gray-300',
  'on_site':'bg-green-900/30 text-green-300','ordered':'bg-blue-900/30 text-blue-300',
  'delivered':'bg-gray-700/30 text-gray-300','pending':'bg-yellow-900/30 text-yellow-300',
  'short':'bg-red-900/30 text-red-300',
};

const emptyForm = { name:'',category:'',quantity:'',unit:'nr',unit_cost:'',supplier:'',po_number:'',order_date:'',delivery_date:'',project_id:'',status:'On Order',notes:'',quantity_received:'' };

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];

export function Materials() {
  const { useList, useCreate, useUpdate, useDelete } = useMaterials;
  const { data: raw = [], isLoading } = useList();
  const materials = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [mainTab, setMainTab] = useState<'register' | 'deliveries' | 'analytics'>('register');
  const [registerFilter, setRegisterFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} material(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} material(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  // Filtered materials for register tab
  const registerFiltered = materials.filter(m => {
    const matchSearch = [String(m.name??'').toLowerCase(),String(m.supplier??'').toLowerCase(),String(m.project_id??'').toLowerCase()]
      .some(v=>v.includes(search.toLowerCase()));
    const matchStatus = registerFilter === 'All' ? true : (
      registerFilter === 'On Site' ? ['Delivered','On Site'].includes(String(m.status??'')) :
      registerFilter === 'Ordered' ? ['On Order','In Transit'].includes(String(m.status??'')) :
      registerFilter === 'Pending' ? m.status === 'On Order' :
      registerFilter === 'Short' ? (Number(m.quantity_received??0) < Number(m.quantity??0) && String(m.status??'') === 'Delivered') :
      m.status === registerFilter
    );
    const matchCat = categoryFilter === 'All' || m.category === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  // Deliveries
  const pendingDeliveries = materials.filter(m=>!['Delivered','On Site','Used','Returned'].includes(String(m.status??'')))
    .sort((a,b)=>new Date(String(a.delivery_date??0)).getTime()-new Date(String(b.delivery_date??0)).getTime());
  const overdueDeliveries = pendingDeliveries.filter(m=>new Date(String(m.delivery_date??0))<new Date());

  // Stats
  const totalMaterials = materials.length;
  const onSiteCount = materials.filter(m=>['Delivered','On Site'].includes(String(m.status??''))).length;
  const orderedCount = materials.filter(m=>['On Order','In Transit'].includes(String(m.status??''))).length;
  const totalValue = materials.reduce((s,m)=>s+Number(m.quantity??0)*Number(m.unit_cost??0),0);
  const estimatedWastage = materials.reduce((s,m)=>{
    const qty = Number(m.quantity??0);
    const received = Number(m.quantity_received??0);
    const shortfall = Math.max(0,qty-received);
    return s + (shortfall * Number(m.unit_cost??0));
  },0);

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(m: AnyRow) {
    setEditing(m);
    setForm({
      name:String(m.name??''),category:String(m.category??''),quantity:String(m.quantity??''),unit:String(m.unit??'nr'),
      unit_cost:String(m.unit_cost??''),supplier:String(m.supplier??''),po_number:String(m.po_number??''),
      order_date:String(m.order_date??''),delivery_date:String(m.delivery_date??''),project_id:String(m.project_id??''),
      status:String(m.status??'On Order'),notes:String(m.notes??''),quantity_received:String(m.quantity_received??'')
    });
    setShowModal(true);
  }

  function openDetail(m: AnyRow) {
    setSelectedDetail(m);
    setShowDetailModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: form.quantity !== '' ? Number(form.quantity) : 0,
      unit_cost: form.unit_cost !== '' ? Number(form.unit_cost) : 0,
      quantity_received: form.quantity_received !== '' ? Number(form.quantity_received) : 0
    };
    if (editing) {
      await updateMutation.mutateAsync({ id:String(editing.id), data:payload });
      toast.success('Material updated');
    } else {
      await createMutation.mutateAsync(payload);
      toast.success('Material added');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this material?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Material deleted');
  }

  async function markDelivered(m: AnyRow) {
    await updateMutation.mutateAsync({ id:String(m.id), data:{ status:'Delivered' } });
    toast.success('Material marked as delivered');
  }

  async function updateDetailStatus(m: AnyRow, newStatus: string) {
    await updateMutation.mutateAsync({ id:String(m.id), data:{ status:newStatus } });
    if (selectedDetail) setSelectedDetail({ ...selectedDetail, status:newStatus });
    toast.success('Status updated');
  }

  async function updateDetailQuantityReceived(m: AnyRow, qty: number) {
    await updateMutation.mutateAsync({ id:String(m.id), data:{ quantity_received:qty } });
    if (selectedDetail) setSelectedDetail({ ...selectedDetail, quantity_received:qty });
    toast.success('Quantity updated');
  }

  const uniqueCategories = ['All',...Array.from(new Set(materials.map(m=>String(m.category??'')).filter(Boolean)))];

  // Analytics data
  const byCategoryData = Object.entries(
    materials.reduce((acc: Record<string,number>, m)=>{
      const cat = String(m.category??'Other');
      const qty = Number(m.quantity??0);
      const cost = Number(m.unit_cost??0);
      acc[cat] = (acc[cat]||0) + (qty * cost);
      return acc;
    },{})
  ).map(([name,value])=>({ name, value:Math.round(Number(value)) }));

  const byProjectData = Object.entries(
    materials.reduce((acc: Record<string,number>, m)=>{
      const proj = String(m.project_id??'Unassigned');
      const qty = Number(m.quantity??0);
      const cost = Number(m.unit_cost??0);
      acc[proj] = (acc[proj]||0) + (qty * cost);
      return acc;
    },{})
  ).map(([name,value])=>({ name, value:Math.round(Number(value)) }));

  const analyticsSummary = uniqueCategories.filter(c=>c!=='All').map(cat=>{
    const catMaterials = materials.filter(m=>String(m.category??'')===cat);
    const totalOrdered = catMaterials.reduce((s,m)=>s+Number(m.quantity??0)*Number(m.unit_cost??0),0);
    const totalDelivered = catMaterials.filter(m=>['Delivered','On Site'].includes(String(m.status??'')))
      .reduce((s,m)=>s+Number(m.quantity??0)*Number(m.unit_cost??0),0);
    const totalShortfall = catMaterials.reduce((s,m)=>{
      const qty = Number(m.quantity??0);
      const received = Number(m.quantity_received??0);
      return s + Math.max(0,qty-received)*Number(m.unit_cost??0);
    },0);
    const wastagePercent = totalDelivered > 0 ? Math.round((totalShortfall/totalDelivered)*100) : 0;
    return { category:cat, totalOrdered:Math.round(totalOrdered), totalDelivered:Math.round(totalDelivered), wastagePercent };
  });

  return (
    <>
      <ModuleBreadcrumbs currentModule="materials" />
      <div className="p-6 space-y-6 min-h-screen bg-gray-950">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-gray-100">Materials Management</h1>
          <p className="text-sm text-gray-400 mt-1">Procurement, deliveries & analytics</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
          <Plus size={16}/><span>Add Material</span>
        </button>
      </div>

      {overdueDeliveries.length > 0 && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-400"/>
          <p className="text-sm text-red-300"><span className="font-semibold">{overdueDeliveries.length} overdue deliver{overdueDeliveries.length>1?'ies':'y'}</span> — chase suppliers.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label:'Total Materials', value:totalMaterials, icon:Package, colour:'text-blue-400', bg:'bg-blue-900/30' },
          { label:'On Site', value:onSiteCount, icon:CheckCircle2, colour:'text-green-400', bg:'bg-green-900/30' },
          { label:'Ordered', value:orderedCount, icon:Clock, colour:'text-yellow-400', bg:'bg-yellow-900/30' },
          { label:'Total Value', value:`£${Math.round(totalValue).toLocaleString()}`, icon:DollarSign, colour:'text-cyan-400', bg:'bg-cyan-900/30' },
          { label:'Wastage Est.', value:`£${Math.round(estimatedWastage).toLocaleString()}`, icon:TrendingUp, colour:'text-red-400', bg:'bg-red-900/30' },
        ].map(kpi=>(
          <div key={kpi.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg}`}><kpi.icon size={20} className={kpi.colour}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{kpi.label}</p>
                <p className="text-lg font-display text-gray-100 truncate">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-700">
        {([
          { key:'register', label:'Materials Register', icon:Package },
          { key:'deliveries', label:'Deliveries', icon:Truck },
          { key:'analytics', label:'Analytics', icon:BarChart3 },
        ]).map(t=>{
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={()=>setMainTab(t.key as 'register'|'deliveries'|'analytics')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mainTab===t.key?'border-orange-600 text-orange-400':'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon size={16}/>
              {t.label}
            </button>
          );
        })}
      </div>

      {mainTab === 'register' && (
        <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search by name, supplier, project…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <Filter size={16} className="text-gray-400 self-center"/>
            <select
              value={registerFilter}
              onChange={e=>setRegisterFilter(e.target.value)}
              className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {['All','On Site','Ordered','Delivered','Pending','Short'].map(s=><option key={s}>{s}</option>)}
            </select>
            <select
              value={categoryFilter}
              onChange={e=>setCategoryFilter(e.target.value)}
              className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {uniqueCategories.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
      ) : (
        <>
          {mainTab === 'register' && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50 border-b border-gray-700">
                  <tr>
                    {(['Name','Category','Project','Supplier','Qty','Unit','Unit Cost','Total Cost','Status','Delivery Date','PO #',''] as const).map(h=>
                      <th key={h} className="px-4 py-3 text-left text-xs font-display tracking-widest text-gray-300 uppercase whitespace-nowrap">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {registerFiltered.map(m=>{
                    const id = String(m.id);
                    const isSelected = selectedIds.has(id);
                    const total = Number(m.quantity??0)*Number(m.unit_cost??0);
                    const isOverdue = m.delivery_date && !['Delivered','On Site','Used','Returned'].includes(String(m.status??'')) && new Date(String(m.delivery_date))<new Date();
                    return (
                      <tr
                        key={String(m.id)}
                        onClick={()=>openDetail(m)}
                        className="hover:bg-gray-700/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                            {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-100">{String(m.name??'—')}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{String(m.category??'—')}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{String(m.project_id??'—')}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{String(m.supplier??'—')}</td>
                        <td className="px-4 py-3 text-gray-200 font-medium">{Number(m.quantity??0)}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{String(m.unit??'')}</td>
                        <td className="px-4 py-3 text-gray-400">£{Number(m.unit_cost??0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-gray-100">£{Math.round(total).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColour[String(m.status??'')] ?? 'bg-gray-700/30 text-gray-300'}`}>
                            {String(m.status??'')}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isOverdue?'text-red-400 font-medium':''}`}>{String(m.delivery_date??'—')}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{String(m.po_number??'—')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                            <button type="button" onClick={()=>openEdit(m)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded"><Edit2 size={14}/></button>
                            <button type="button" onClick={()=>handleDelete(String(m.id))} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                  );
                })}
              </tbody>
            </table>
            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
              ]}
              onClearSelection={clearSelection}
            />
            {registerFiltered.length === 0 && (
              <EmptyState
                icon={Package}
                title="No materials found"
                description="Add materials to your register to track quantities and deliveries."
                variant="default"
              />
              )}
            </div>
          )}

          {mainTab === 'deliveries' && (
            <div className="space-y-4">
              {pendingDeliveries.length === 0 ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 text-center py-16 text-gray-400">
                  <Truck size={40} className="mx-auto mb-3 opacity-30"/>
                  <p>No pending deliveries</p>
                </div>
              ) : (
                pendingDeliveries.map((m,_i)=>{
                  const isOverdue = new Date(String(m.delivery_date??0)) < new Date();
                  return (
                    <div
                      key={String(m.id)}
                      className={`bg-gray-800 rounded-xl border p-4 flex items-center justify-between ${isOverdue?'border-red-800':'border-gray-700'}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {isOverdue && <AlertTriangle size={16} className="text-red-400"/>}
                          <h3 className="font-semibold text-gray-100">{String(m.name??'')}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColour[String(m.status??'')] ?? 'bg-gray-700/30 text-gray-300'}`}>
                            {String(m.status??'')}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm text-gray-400">
                    <div>
                      <p className="text-xs text-gray-500">Supplier</p>
                      <p className="font-medium text-gray-200">{String(m.supplier??'—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Project</p>
                      <p className="font-medium text-gray-200">{String(m.project_id??'—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Quantity</p>
                      <p className="font-medium text-gray-200">{Number(m.quantity??0)} {String(m.unit??'')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expected Date</p>
                      <p className={`font-medium ${isOverdue?'text-red-400':'text-gray-200'}`}>
                        {String(m.delivery_date??'—')}
                      </p>
                    </div>
                  </div>
                      </div>
                      <button
                        onClick={()=>markDelivered(m)}
                        className="px-4 py-2 bg-green-900/30 text-green-300 rounded-lg hover:bg-green-900/50 text-sm font-medium flex items-center gap-2"
                      >
                        <CheckCircle2 size={16}/>
                        Mark Delivered
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {mainTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Spend by Category</h3>
                  {byCategoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={byCategoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                        <XAxis dataKey="name" tick={{ fill:'#9ca3af', fontSize:12 }} angle={-45} textAnchor="end" height={80}/>
                        <YAxis tick={{ fill:'#9ca3af', fontSize:12 }}/>
                        <Tooltip contentStyle={{ backgroundColor:'#1f2937', border:'1px solid #374151', borderRadius:'8px' }} labelStyle={{ color:'#e5e7eb' }}/>
                        <Bar dataKey="value" fill="#3b82f6" radius={[8,8,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
                  )}
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Spend by Project</h3>
                  {byProjectData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={byProjectData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({name,value})=>`${name}: £${value.toLocaleString()}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {byProjectData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor:'#1f2937', border:'1px solid #374151', borderRadius:'8px' }} labelStyle={{ color:'#e5e7eb' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">No data</div>
                  )}
                </div>
              </div>

              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-100">Category Summary</h3>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-700/50 border-b border-gray-700">
                    <tr>
                      {(['Category','Total Ordered','Total Delivered','Wastage %'] as const).map(h=>
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {analyticsSummary.map(row=>(
                      <tr key={row.category} className="hover:bg-gray-700/30">
                        <td className="px-6 py-3 font-medium text-gray-100">{row.category}</td>
                        <td className="px-6 py-3 text-gray-200">£{row.totalOrdered.toLocaleString()}</td>
                        <td className="px-6 py-3 text-gray-200">£{row.totalDelivered.toLocaleString()}</td>
                        <td className="px-6 py-3">
                          <span className={`text-sm font-semibold ${row.wastagePercent > 10?'text-red-400':row.wastagePercent > 5?'text-yellow-400':'text-green-400'}`}>
                            {row.wastagePercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-gray-100">{editing?'Edit Material':'Add Material'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Material Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select…</option>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
                  <input
                    value={form.project_id}
                    onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Supplier</label>
                  <input
                    value={form.supplier}
                    onChange={e=>setForm(f=>({...f,supplier:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Quantity *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={form.quantity}
                    onChange={e=>setForm(f=>({...f,quantity:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e=>setForm(f=>({...f,unit:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Unit Cost (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unit_cost}
                    onChange={e=>setForm(f=>({...f,unit_cost:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">PO Number</label>
                  <input
                    value={form.po_number}
                    onChange={e=>setForm(f=>({...f,po_number:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Order Date</label>
                  <input
                    type="date"
                    value={form.order_date}
                    onChange={e=>setForm(f=>({...f,order_date:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={e=>setForm(f=>({...f,delivery_date:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {editing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Quantity Received</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.quantity_received}
                      onChange={e=>setForm(f=>({...f,quantity_received:e.target.value}))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={()=>setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending||updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {editing?'Update Material':'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">{String(selectedDetail.name??'')}</h2>
                <p className="text-sm text-gray-400 mt-1">Material Details</p>
              </div>
              <button type="button" onClick={()=>setShowDetailModal(false)} className="p-2 hover:bg-gray-700 rounded-lg"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Category</p>
                  <p className="text-gray-100 font-medium">{String(selectedDetail.category??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Project</p>
                  <p className="text-gray-100 font-medium">{String(selectedDetail.project_id??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Supplier</p>
                  <p className="text-gray-100 font-medium">{String(selectedDetail.supplier??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">PO #</p>
                  <p className="text-gray-100 font-medium font-mono">{String(selectedDetail.po_number??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Quantity Ordered</p>
                  <p className="text-gray-100 font-medium">{Number(selectedDetail.quantity??0)} {String(selectedDetail.unit??'')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Quantity Received</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={Number(selectedDetail.quantity_received??0)}
                      onChange={e=>updateDetailQuantityReceived(selectedDetail,Number(e.target.value))}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 w-24"
                    />
                    <span className="text-sm text-gray-400">{String(selectedDetail.unit??'')}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Unit Cost</p>
                  <p className="text-gray-100 font-medium">£{Number(selectedDetail.unit_cost??0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Cost</p>
                  <p className="text-gray-100 font-medium text-lg">£{Math.round(Number(selectedDetail.quantity??0)*Number(selectedDetail.unit_cost??0)).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
                  <select
                    value={String(selectedDetail.status??'On Order')}
                    onChange={e=>updateDetailStatus(selectedDetail,e.target.value)}
                    className={`bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 ${statusColour[String(selectedDetail.status??'')] ?? 'bg-gray-700/30 text-gray-300'}`}
                  >
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Delivery Date</p>
                  <p className="text-gray-100 font-medium">{String(selectedDetail.delivery_date??'—')}</p>
                </div>
                {String(selectedDetail.notes??'').trim() && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
                    <p className="text-gray-300 text-sm">{String(selectedDetail.notes??'')}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={()=>{ openEdit(selectedDetail); setShowDetailModal(false); }}
                  className="flex-1 px-4 py-2 bg-blue-900/30 text-blue-300 rounded-lg hover:bg-blue-900/50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Edit2 size={16}/>
                  Edit
                </button>
                <button
                  onClick={()=>{ handleDelete(String(selectedDetail.id)); setShowDetailModal(false); }}
                  className="flex-1 px-4 py-2 bg-red-900/30 text-red-300 rounded-lg hover:bg-red-900/50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Trash2 size={16}/>
                  Delete
                </button>
                <button
                  onClick={()=>setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default React.memo(Materials);
