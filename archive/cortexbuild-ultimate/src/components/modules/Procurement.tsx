// Module: Procurement — CortexBuild Ultimate
import React, { useState, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, X, Truck, CheckCircle2, AlertTriangle,
  Clock, Package, Search, BarChart3, Building2,
  Calendar, TrendingUp, Users, ChevronRight, CheckSquare, Square,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useProcurement, useProjects } from '../../hooks/useData';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

type AnyRow = Record<string, unknown>;

const STATUSES = ['pending_approval','ordered','pending_delivery','on_site','delivered'];
const CATEGORIES = ['Structural Steel','Concrete','Waterproofing','Cladding','Fixings','Insulation','Tools','Groundworks','Civils','Other'];

const STATUS_COLOUR: Record<string,string> = {
  pending_approval: 'bg-yellow-900/30 text-yellow-300',
  ordered:          'bg-blue-900/30 text-blue-300',
  pending_delivery: 'bg-purple-900/30 text-purple-300',
  on_site:          'bg-indigo-900/30 text-indigo-300',
  delivered:        'bg-emerald-900/30 text-emerald-300',
};

const STATUS_ICON: Record<string, typeof Truck> = {
  pending_approval: Clock,
  ordered:          Package,
  pending_delivery: Truck,
  on_site:          Truck,
  delivered:        CheckCircle2,
};

function fmt(n: number) { return `£${Number(n).toLocaleString()}`; }
function nextPO(pos: AnyRow[]) {
  const nums = pos.map(p => parseInt(String(p.po_number??'').replace(/\D/g,''))).filter(n => !isNaN(n));
  const next  = nums.length > 0 ? Math.max(...nums) + 1 : 89;
  return `PO-CW-${String(next).padStart(4,'0')}`;
}
function daysUntil(dateStr: string | unknown): number {
  const d = new Date(String(dateStr ?? ''));
  if (isNaN(d.getTime())) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}
function getUrgency(dateStr: string | unknown): 'overdue' | 'urgent' | 'warning' | 'normal' {
  const days = daysUntil(dateStr);
  if (days < 0) return 'overdue';
  if (days === 0) return 'urgent';
  if (days <= 3) return 'warning';
  return 'normal';
}

export function Procurement() {
  const [mainTab, setMainTab] = useState<'orders'|'suppliers'|'analytics'|'schedule'>('orders');
  const [subTab, setSubTab] = useState<'all'|'pending'|'ordered'|'delivery'|'delivered'>('all');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [search, setSearch]               = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editId, setEditId]               = useState<string|null>(null);
  const [selectedPO, setSelectedPO]       = useState<AnyRow|null>(null);

  // Form state
  const [fPO, setFPO]           = useState('');
  const [fSupplier, setFSupplier] = useState('');
  const [fDesc, setFDesc]       = useState('');
  const [fValue, setFValue]     = useState('');
  const [fProject, setFProject] = useState('');
  const [fCategory, setFCategory] = useState('Other');
  const [fStatus, setFStatus]   = useState('pending_approval');
  const [fOrder, setFOrder]     = useState('');
  const [fDelivery, setFDelivery] = useState('');
  const [fNotes, setFNotes]     = useState('');

  const { useList, useCreate, useUpdate, useDelete } = useProcurement;
  const { useList: useProjList } = useProjects;
  const { data: rawPOs=[], isLoading } = useList();
  const { data: rawProj=[] }           = useProjList();
  const pos      = rawPOs  as AnyRow[];
  const projects = rawProj as AnyRow[];

  const createMut = useCreate();
  const updateMut = useUpdate();
  const deleteMut = useDelete();

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMut.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const SUBTAB_STATUSES: Record<string, string[]> = {
    pending:  ['pending_approval'],
    ordered:  ['ordered'],
    delivery: ['pending_delivery','on_site'],
    delivered:['delivered'],
  };
  const filtered = pos.filter(p => {
    if (subTab !== 'all') {
      const allowed = SUBTAB_STATUSES[subTab] ?? [];
      if (!allowed.includes(String(p.status??''))) return false;
    }
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (filterProject !== 'all' && p.project !== filterProject) return false;
    if (search) {
      const q = search.toLowerCase();
      return String(p.supplier??'').toLowerCase().includes(q) ||
             String(p.description??'').toLowerCase().includes(q) ||
             String(p.po_number??'').toLowerCase().includes(q);
    }
    return true;
  });

  const totalValue       = pos.reduce((s,p) => s+Number(p.value??0), 0);
  const onOrderValue     = pos.filter(p => p.status==='ordered').reduce((s,p) => s+Number(p.value??0), 0);
  const pendingDelivery  = pos.filter(p => p.status==='pending_delivery'||p.status==='on_site').length;
  const awaitingApproval = pos.filter(p => p.status==='pending_approval').length;
  const delivered        = pos.filter(p => p.status==='delivered').length;
  const thisMonth = new Date().getMonth();
  const deliveredThisMonth = pos.filter(p => {
    if (p.status !== 'delivered') return false;
    const d = new Date(String(p.deliveryDate ?? ''));
    return !isNaN(d.getTime()) && d.getMonth() === thisMonth;
  }).length;

  // Projects list
  const projectList = useMemo(() => {
    const unique = Array.from(new Set(pos.map(p => String(p.project??'').trim()).filter(p => !!p)));
    return unique.sort();
  }, [pos]);

  // Suppliers derived from POs
  const suppliers = useMemo(() => {
    const sMap: Record<string, { name: string; category: string; spend: number; count: number; lastOrder: string }> = {};
    pos.forEach(p => {
      const sup = String(p.supplier ?? '');
      if (!sup) return;
      if (!sMap[sup]) {
        sMap[sup] = { name: sup, category: String(p.category??'Other'), spend: 0, count: 0, lastOrder: '' };
      }
      sMap[sup].spend += Number(p.value ?? 0);
      sMap[sup].count += 1;
      const orderDate = String(p.orderDate ?? '');
      if (orderDate > sMap[sup].lastOrder) sMap[sup].lastOrder = orderDate;
    });
    return Object.values(sMap).sort((a, b) => b.spend - a.spend);
  }, [pos]);

  // Spend by category
  const spendByCategory = useMemo(() => {
    const cMap: Record<string, { category: string; value: number; count: number }> = {};
    pos.forEach(p => {
      const cat = String(p.category ?? 'Other');
      if (!cMap[cat]) cMap[cat] = { category: cat, value: 0, count: 0 };
      cMap[cat].value += Number(p.value ?? 0);
      cMap[cat].count += 1;
    });
    return Object.values(cMap).sort((a, b) => b.value - a.value);
  }, [pos]);

  // Spend by project
  const spendByProject = useMemo(() => {
    const pMap: Record<string, { project: string; value: number }> = {};
    pos.forEach(p => {
      const proj = String(p.project ?? 'Unallocated');
      if (!pMap[proj]) pMap[proj] = { project: proj, value: 0 };
      pMap[proj].value += Number(p.value ?? 0);
    });
    return Object.values(pMap).sort((a, b) => b.value - a.value);
  }, [pos]);

  // Monthly trend (6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }
    const trend = months.map(m => {
      const month = m.getMonth();
      const year = m.getFullYear();
      const mName = m.toLocaleDateString('en-GB', { month: 'short' });
      const spent = pos.filter(p => {
        const od = new Date(String(p.orderDate ?? ''));
        return !isNaN(od.getTime()) && od.getMonth() === month && od.getFullYear() === year;
      }).reduce((s, p) => s + Number(p.value ?? 0), 0);
      return { month: mName, spent: spent / 1000 };
    });
    return trend;
  }, [pos]);

  // Delivery schedule (pending & ordered only)
  const deliverySchedule = useMemo(() => {
    return pos
      .filter(p => ['pending_delivery', 'on_site', 'ordered'].includes(String(p.status ?? '')))
      .sort((a, b) => {
        const aDate = new Date(String(a.deliveryDate ?? ''));
        const bDate = new Date(String(b.deliveryDate ?? ''));
        return aDate.getTime() - bDate.getTime();
      });
  }, [pos]);

  const overdueCount = deliverySchedule.filter(p => daysUntil(String(p.deliveryDate ?? '')) < 0).length;
  const dueSoonCount = deliverySchedule.filter(p => {
    const d = daysUntil(String(p.deliveryDate ?? ''));
    return d >= 0 && d <= 7;
  }).length;

  function openCreate() {
    setEditId(null);
    setFPO(nextPO(pos)); setFSupplier(''); setFDesc(''); setFValue('');
    setFProject(''); setFCategory('Other'); setFStatus('pending_approval');
    setFOrder(''); setFDelivery(''); setFNotes('');
    setShowModal(true);
  }
  function openEdit(po: AnyRow) {
    setEditId(String(po.id));
    setFPO(String(po.po_number??''));
    setFSupplier(String(po.supplier??''));
    setFDesc(String(po.description??''));
    setFValue(String(po.value??''));
    setFProject(String(po.project??''));
    setFCategory(String(po.category??'Other'));
    setFStatus(String(po.status??'pending_approval'));
    setFOrder(String(po.orderDate ?? ''));
    setFDelivery(String(po.deliveryDate ?? ''));
    setFNotes(String(po.notes??''));
    setShowModal(true);
  }
  function handleSave() {
    if (!fSupplier||!fDesc) { toast.error('Supplier and description required'); return; }
    const payload = {
      po_number:fPO, supplier:fSupplier, description:fDesc, value:parseFloat(fValue)||0,
      project:fProject, category:fCategory, status:fStatus, order_date:fOrder,
      delivery_date:fDelivery, notes:fNotes,
    };
    if (editId) {
      updateMut.mutate({id:editId,data:payload});
    } else {
      createMut.mutate(payload);
    }
    setShowModal(false);
  }
  function advanceStatus(po: AnyRow) {
    const order: string[] = ['pending_approval','ordered','pending_delivery','on_site','delivered'];
    const cur = order.indexOf(String(po.status??'ordered'));
    if (cur < order.length - 1) {
      updateMut.mutate({id:String(po.id), data:{status:order[cur+1]}});
      toast.success(`Advanced to "${order[cur+1]}"`);
    }
  }
  function openDetail(po: AnyRow) {
    setSelectedPO(po);
    setShowDetailModal(true);
  }
  function approveApprovalPO() {
    if (!selectedPO) return;
    updateMut.mutate({id:String(selectedPO.id), data:{status:'ordered'}});
    setShowDetailModal(false);
    toast.success('PO approved');
  }
  function rejectApprovalPO() {
    if (!selectedPO) return;
    if (confirm('Are you sure? This action cannot be undone.')) {
      deleteMut.mutate(String(selectedPO.id));
      setShowDetailModal(false);
      toast.success('PO rejected and deleted');
    }
  }
  function markDelivered(po: AnyRow) {
    updateMut.mutate({id:String(po.id), data:{status:'delivered'}});
    toast.success('Marked as delivered');
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="procurement" />
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display text-white">Procurement & Purchase Orders</h1>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 btn btn-primary rounded-lg text-white font-medium transition-colors">
          <Plus className="w-4 h-4"/>Raise PO
        </button>
      </div>

      {awaitingApproval > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0"/>
          <p className="text-yellow-300 text-sm font-medium">{awaitingApproval} purchase order{awaitingApproval>1?'s':''} awaiting approval.</p>
        </div>
      )}

      {/* KPIs - 5 Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {label:'Total POs',           value:String(pos.length),                  icon:Package,     col:'text-blue-400'  },
          {label:'Pending Approval',    value:String(awaitingApproval),            icon:Clock,       col:'text-yellow-400'},
          {label:'On Order (£)',        value:fmt(onOrderValue),                   icon:Package,col:'text-indigo-400'},
          {label:'Delivered This Month',value:String(deliveredThisMonth),         icon:CheckCircle2,col:'text-emerald-400'},
          {label:'Outstanding',        value:String(pendingDelivery),              icon:Truck,       col:'text-purple-400'},
        ].map(({label,value,icon:Icon,col})=>(
          <div key={label} className="card bg-base-100 border border-base-300 p-4 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-gray-400">{label}</p>
              <Icon className="w-4 h-4 text-gray-500"/>
            </div>
            <p className={`text-2xl font-display ${col}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-700">
        {([
          {key:'orders'      as const, label:'Purchase Orders', icon:Package},
          {key:'suppliers'   as const, label:'Suppliers',       icon:Building2},
          {key:'analytics'   as const, label:'Spend Analysis',  icon:BarChart3},
          {key:'schedule'    as const, label:'Delivery Schedule',icon:Calendar},
        ]).map(t=>(
          <button type="button"  key={t.key} onClick={()=>setMainTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab===t.key?'border-blue-500 text-blue-400':'border-transparent text-gray-400 hover:text-gray-200'}`}>
            <t.icon className="w-4 h-4"/>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Purchase Orders */}
      {mainTab === 'orders' && (
        <div className="space-y-6">
          {/* Sub-tabs for Orders */}
          <div className="flex gap-1 border-b border-gray-700">
            {([
              { key:'all'       as const, label:'All Orders',           count:pos.length },
              { key:'pending'   as const, label:'Pending Approval',    count:awaitingApproval },
              { key:'ordered'   as const, label:'On Order',            count:pos.filter(p=>p.status==='ordered').length },
              { key:'delivery'  as const, label:'In Transit / On Site',count:pos.filter(p=>['pending_delivery','on_site'].includes(String(p.status??''))).length },
              { key:'delivered' as const, label:'Delivered',           count:delivered },
            ]).map(t=>(
              <button type="button"  key={t.key} onClick={()=>setSubTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab===t.key?'border-blue-500 text-blue-400':'border-transparent text-gray-400 hover:text-gray-200'}`}>
                {t.label}
                {t.count > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">{t.count}</span>}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search supplier, description, PO #…"
                className="w-full pl-9 pr-3 py-2 input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                className="input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="all">All Statuses</option>
                {STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}
                className="input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}
                className="input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="all">All Projects</option>
                {projectList.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* POs Table */}
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">Loading purchase orders…</div>
            ) : (
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/60 border-b border-gray-700">
                    <tr>{['PO #','Supplier','Description','Category','Project','Value','Order Date','Delivery','Status',''].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filtered.map(po=>{
                      const id = String(po.id);
                      const isSelected = selectedIds.has(id);
                      const StatusIcon = STATUS_ICON[String(po.status??'')] ?? Package;
                      const delDate = String(po.deliveryDate ?? '');
                      const urgency = getUrgency(delDate);
                      return (
                        <tr key={id} className="hover:bg-gray-800/40 transition-colors cursor-pointer" onClick={()=>openDetail(po)}>
                          <td className="px-4 py-3">
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                              {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                            </button>
                          </td>
<td className="px-4 py-3 font-mono text-xs text-blue-400">{String(po.po_number??'—')}</td>
                          <td className="px-4 py-3 text-white font-medium">{String(po.supplier??'—')}</td>
                          <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate text-sm">{String(po.description??'—')}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{String(po.category??'—')}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate">{String(po.project??'—')}</td>
                          <td className="px-4 py-3 font-mono text-white">{fmt(Number(po.value??0))}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{String(po.orderDate ?? '—').substring(0,10)}</td>
                          <td className={`px-4 py-3 text-sm font-medium ${urgency==='overdue'?'text-red-400':urgency==='urgent'?'text-red-400':urgency==='warning'?'text-yellow-400':'text-gray-400'}`}>
                            {delDate ? delDate.substring(0,10) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium w-fit ${STATUS_COLOUR[String(po.status??'')]??'bg-gray-700/50 text-gray-400'}`}>
                              <StatusIcon className="w-3 h-3"/>
                              {String(po.status??'').replace(/_/g,' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                              {String(po.status??'') === 'pending_approval' && (
                                <button type="button" onClick={()=>{setSelectedPO(po);setShowDetailModal(true);}}
                                  className="text-xs px-2 py-1 bg-green-900/40 hover:bg-green-800 text-green-400 rounded font-medium transition-colors">
                                  Approve
                                </button>
                              )}
                              <button type="button" onClick={()=>openEdit(po)} className="p-1 text-gray-400 hover:text-white rounded"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button type="button" onClick={()=>{if(confirm('Delete PO?'))deleteMut.mutate(String(po.id));}} className="p-1 text-gray-400 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={10}><EmptyState title="No purchase orders match the current filters." /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
              ]}
              onClearSelection={clearSelection}
            />
          </div>
        </div>
      )}

      {/* TAB: Suppliers */}
      {mainTab === 'suppliers' && (
        <div className="space-y-6">
          <button type="button" onClick={()=>setShowSupplierModal(true)} className="flex items-center gap-2 px-4 py-2 btn btn-primary rounded-lg text-white font-medium transition-colors">
            <Plus className="w-4 h-4"/>Add Supplier
          </button>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search supplier…"
              className="w-full pl-9 pr-3 py-2 input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())).map(sup=>(
              <div key={sup.name} className="card bg-base-100 border border-base-300 p-5 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-semibold">{sup.name}</h3>
                  <Building2 className="w-4 h-4 text-gray-500"/>
                </div>
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-gray-400">Category:</span> <span className="text-gray-200">{sup.category}</span></p>
                  <p className="text-sm"><span className="text-gray-400">Total Spend:</span> <span className="text-emerald-400 font-mono">{fmt(sup.spend)}</span></p>
                  <p className="text-sm"><span className="text-gray-400">PO Count:</span> <span className="text-blue-400 font-mono">{sup.count}</span></p>
                  <p className="text-sm"><span className="text-gray-400">Last Order:</span> <span className="text-gray-300">{sup.lastOrder.substring(0,10) || '—'}</span></p>
                </div>
                <button className="mt-4 w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm font-medium transition-colors">
                  View POs <ChevronRight className="w-4 h-4"/>
                </button>
              </div>
            ))}
            {suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="col-span-full"><EmptyState title="No suppliers found." /></div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Spend Analysis */}
      {mainTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spend by Category */}
            <div className="card bg-base-100 border border-base-300 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4"/>Spend by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="category" tick={{fill:'#9ca3af', fontSize:12}}/>
                  <YAxis tick={{fill:'#9ca3af', fontSize:12}}/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',color:'#fff'}}/>
                  <Bar dataKey="value" fill="#3b82f6" radius={[8,8,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Spend by Project */}
            <div className="card bg-base-100 border border-base-300 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4"/>Spend by Project</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendByProject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="project" tick={{fill:'#9ca3af', fontSize:11}} width={80}/>
                  <YAxis tick={{fill:'#9ca3af', fontSize:12}}/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',color:'#fff'}}/>
                  <Bar dataKey="value" fill="#10b981" radius={[8,8,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Trend */}
            <div className="lg:col-span-2 card bg-base-100 border border-base-300 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4"/>6-Month Spend Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                  <XAxis dataKey="month" tick={{fill:'#9ca3af', fontSize:12}}/>
                  <YAxis tick={{fill:'#9ca3af', fontSize:12}}/>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',color:'#fff'}} formatter={(v)=>`£${(Number(v)*1000).toLocaleString()}`}/>
                  <Line type="monotone" dataKey="spent" stroke="#6366f1" strokeWidth={2} dot={{fill:'#6366f1',r:4}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Summary Table */}
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Category Summary</h3>
            </div>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 border-b border-gray-700">
                  <tr>{['Category','PO Count','Total Spend','% of Total','Avg PO Size'].map(h=>(
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {spendByCategory.map(cat=>{
                    const pctOfTotal = totalValue > 0 ? ((cat.value / totalValue) * 100).toFixed(1) : '0';
                    const avgPO = cat.count > 0 ? cat.value / cat.count : 0;
                    return (
                      <tr key={cat.category} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-3 font-medium text-white">{cat.category}</td>
                        <td className="px-6 py-3 text-gray-300">{cat.count}</td>
                        <td className="px-6 py-3 font-mono text-emerald-400">{fmt(cat.value)}</td>
                        <td className="px-6 py-3 text-gray-300">{pctOfTotal}%</td>
                        <td className="px-6 py-3 text-blue-400">{fmt(avgPO)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Suppliers by Spend */}
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">Top 5 Suppliers by Spend</h3>
            </div>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 border-b border-gray-700">
                  <tr>{['Supplier','Category','Total Spend','PO Count','Rank'].map(h=>(
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {suppliers.slice(0,5).map((sup,i)=>(
                    <tr key={sup.name} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-3 font-medium text-white">{sup.name}</td>
                      <td className="px-6 py-3 text-gray-300">{sup.category}</td>
                      <td className="px-6 py-3 font-mono text-emerald-400">{fmt(sup.spend)}</td>
                      <td className="px-6 py-3 text-blue-400">{sup.count}</td>
                      <td className="px-6 py-3"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-900/30 text-blue-400 text-xs font-mono">#{i+1}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Delivery Schedule */}
      {mainTab === 'schedule' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Overdue Deliveries</p>
              <p className="text-2xl font-display text-red-400">{overdueCount}</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Due This Week</p>
              <p className="text-2xl font-display text-yellow-400">{dueSoonCount}</p>
            </div>
            <div className="bg-blue-900/20 border border-blue-900/50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total Outstanding</p>
              <p className="text-2xl font-display text-blue-400">{deliverySchedule.length}</p>
            </div>
            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">On Time Delivery</p>
              <p className="text-2xl font-display text-emerald-400">{deliverySchedule.length > 0 ? `${Math.round(((deliverySchedule.length - overdueCount) / deliverySchedule.length) * 100)}%` : '—'}</p>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 border-b border-gray-700">
                  <tr>{['PO #','Supplier','Description','Project','Expected Delivery','Days Until','Status',''].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {deliverySchedule.map(po=>{
                    const delDate = String(po.deliveryDate ?? '');
                    const days = daysUntil(delDate);
                    let trafficLight = 'bg-emerald-900/30 text-emerald-300';
                    if (days < 0) trafficLight = 'bg-red-900/30 text-red-300';
                    else if (days === 0) trafficLight = 'bg-orange-900/30 text-orange-300';
                    else if (days <= 7) trafficLight = 'bg-yellow-900/30 text-yellow-300';
                    return (
                      <tr key={String(po.id)} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-blue-400">{String(po.po_number??'—')}</td>
                        <td className="px-4 py-3 text-white font-medium">{String(po.supplier??'—')}</td>
                        <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate text-sm">{String(po.description??'—')}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate">{String(po.project??'—')}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{delDate ? delDate.substring(0,10) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-display ${trafficLight}`}>
                            {days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `${days}d`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium w-fit ${STATUS_COLOUR[String(po.status??'')]??'bg-gray-700/50 text-gray-400'}`}>
                            {String(po.status??'').replace(/_/g,' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                          {String(po.status??'') !== 'delivered' && (
                            <button type="button" onClick={()=>markDelivered(po)}
                              className="text-xs px-2 py-1 bg-green-900/40 hover:bg-green-800 text-green-400 rounded font-medium transition-colors">
                              Mark Delivered
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {deliverySchedule.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No outstanding deliveries.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Raise/Edit PO */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-display text-white">{editId?'Edit Purchase Order':'Raise Purchase Order'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">PO Number</label>
                  <input value={fPO} onChange={e=>setFPO(e.target.value)} className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                  <select value={fStatus} onChange={e=>setFStatus(e.target.value)} className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                    {STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Supplier *</label>
                <input value={fSupplier} onChange={e=>setFSupplier(e.target.value)} placeholder="Supplier name" className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description *</label>
                <textarea value={fDesc} onChange={e=>setFDesc(e.target.value)} rows={2} placeholder="Materials / works description…" className="w-full input input-bordered text-white text-sm resize-none focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Value (£)</label>
                  <input type="number" value={fValue} onChange={e=>setFValue(e.target.value)} placeholder="0.00" className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                  <select value={fCategory} onChange={e=>setFCategory(e.target.value)} className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Project</label>
                <select value={fProject} onChange={e=>setFProject(e.target.value)} className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— Select project —</option>
                  {projects.map(p=><option key={String(p.id)} value={String(p.name)}>{String(p.name)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Order Date</label>
                  <input type="date" value={fOrder} onChange={e=>setFOrder(e.target.value)} className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Expected Delivery</label>
                  <input type="date" value={fDelivery} onChange={e=>setFDelivery(e.target.value)} className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Notes</label>
                <textarea value={fNotes} onChange={e=>setFNotes(e.target.value)} rows={2} placeholder="Additional notes…" className="w-full input input-bordered text-white text-sm resize-none focus:outline-none focus:border-blue-500"/>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button type="button" onClick={handleSave} className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                {editId?'Save Changes':'Raise PO'}
              </button>
              <button type="button" onClick={()=>setShowModal(false)} className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: PO Detail */}
      {showDetailModal && selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-display text-white">PO Details: {String(selectedPO.po_number??'')}</h2>
              <button type="button" onClick={()=>setShowDetailModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Supplier</p>
                  <p className="text-white text-lg font-semibold">{String(selectedPO.supplier??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLOUR[String(selectedPO.status??'')]??'bg-gray-700/50 text-gray-400'}`}>
                    {String(selectedPO.status??'').replace(/_/g,' ')}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Description</p>
                <p className="text-gray-200">{String(selectedPO.description??'—')}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Category</p>
                  <p className="text-white">{String(selectedPO.category??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Project</p>
                  <p className="text-white">{String(selectedPO.project??'—')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Value</p>
                  <p className="text-emerald-400 font-display text-lg">{fmt(Number(selectedPO.value??0))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Order Date</p>
                  <p className="text-white">{String(selectedPO.orderDate ?? '—').substring(0,10)}</p>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-6">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Delivery Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Expected Delivery</p>
                    <p className="text-white font-medium">{String(selectedPO.deliveryDate ?? '—').substring(0,10)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Days Until Delivery</p>
                    <p className="text-white font-medium">{daysUntil(String(selectedPO.deliveryDate ?? '')) === Infinity ? '—' : daysUntil(String(selectedPO.deliveryDate ?? '')) < 0 ? `${-daysUntil(String(selectedPO.deliveryDate ?? ''))}d overdue` : `${daysUntil(String(selectedPO.deliveryDate ?? ''))}d`}</p>
                  </div>
                </div>
              </div>

              {String(selectedPO.notes ?? '').trim() && (
                <div className="border-t border-gray-800 pt-6">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Notes</p>
                  <p className="text-gray-300">{String(selectedPO.notes??'')}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              {String(selectedPO.status??'') === 'pending_approval' ? (
                <>
                  <button type="button" onClick={approveApprovalPO} className="flex-1 btn btn-success rounded-lg py-2 text-sm font-semibold transition-colors">
                    <CheckCircle2 className="inline w-4 h-4 mr-2"/>Approve
                  </button>
                  <button type="button" onClick={rejectApprovalPO} className="flex-1 btn btn-error rounded-lg py-2 text-sm font-semibold transition-colors">
                    Reject & Delete
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={()=>{openEdit(selectedPO);setShowDetailModal(false);}} className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                    <Edit2 className="inline w-4 h-4 mr-2"/>Edit
                  </button>
                  <button type="button" onClick={()=>advanceStatus(selectedPO)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold transition-colors">
                    Advance Status
                  </button>
                </>
              )}
              <button type="button" onClick={()=>setShowDetailModal(false)} className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier (Static) */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-display text-white">Add New Supplier</h2>
              <button type="button" onClick={()=>setShowSupplierModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Supplier Name *</label>
                <input placeholder="Supplier name" className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                <select className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">— Select category —</option>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Contact Email</label>
                <input type="email" placeholder="supplier@company.com" className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
                <input placeholder="+44 (0)..." className="w-full input input-bordered text-white text-sm focus:outline-none focus:border-blue-500"/>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800">
              <button type="button" onClick={()=>{setShowSupplierModal(false);toast.info('Add suppliers by creating purchase orders using "Raise PO".');}} className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                Got it
              </button>
              <button type="button" onClick={()=>setShowSupplierModal(false)} className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default React.memo(Procurement);
