import React, { useState } from 'react';
import { Package, Plus, Search, Star, ShieldCheck, AlertTriangle, TrendingUp, Edit2, Trash2, X, Phone, Mail, Globe, MapPin, FileText, CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useSuppliers } from '../../hooks/useData';
import { toast } from 'sonner';
import { apiFetch } from '@/services/api';

type AnyRow = Record<string, unknown>;

const STATUS_OPTIONS = ['active','inactive','blacklisted','pending_review'];
const COMPLIANCE_OPTIONS = ['compliant','pending','non_compliant','expired'];
const CATEGORIES = ['Concrete & Cement','Steel & Metalwork','Timber','Brickwork & Masonry','Roofing','Insulation','Electrical','Plumbing','Finishes','Plant Hire','PPE & Safety','General','Other'];

const statusColor: Record<string,string> = {
  active: 'bg-green-900/30 text-green-300',
  inactive: 'bg-gray-700/30 text-gray-300',
  blacklisted: 'bg-red-900/30 text-red-300',
  pending_review: 'bg-yellow-900/30 text-yellow-300',
};

const complianceColor: Record<string,string> = {
  compliant: 'bg-green-900/30 text-green-300',
  pending: 'bg-yellow-900/30 text-yellow-300',
  non_compliant: 'bg-red-900/30 text-red-300',
  expired: 'bg-red-900/30 text-red-300',
};

const emptyForm = {
  name:'', contact_name:'', email:'', phone:'', address:'', website:'', tax_id:'',
  status:'active', rating:3, category:'General', payment_terms:'', notes:'',
  insurance_expiry:'', compliance_status:'pending',
};

export default function Suppliers() {
  const { useList, useCreate, useUpdate, useDelete } = useSuppliers;
  const { data: raw = [], isLoading } = useList();
  const suppliers = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [tab, setTab] = useState<'directory'|'analytics'>('directory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing, setEditing] = useState<AnyRow|null>(null);
  const [selected, setSelected] = useState<AnyRow|null>(null);
  const [form, setForm] = useState({...emptyForm});
  const [analytics, setAnalytics] = useState<AnyRow|null>(null);
  const [history, setHistory] = useState<AnyRow[]>([]);

  React.useEffect(() => {
    if (tab === 'analytics') {
      apiFetch('/suppliers/analytics/summary').then((res: unknown) => setAnalytics(res as AnyRow)).catch(()=>{});
    }
  }, [tab]);

  async function loadHistory(id: string) {
    try {
      const res = await apiFetch<{data: AnyRow[]}>(`/suppliers/${id}/history`);
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  }

  const filtered = suppliers.filter((s: AnyRow) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (s.name as string)?.toLowerCase().includes(q) || (s.contact_name as string)?.toLowerCase().includes(q) || (s.email as string)?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  function openCreate() {
    setEditing(null);
    setForm({...emptyForm});
    setShowModal(true);
  }

  function openEdit(item: AnyRow) {
    setEditing(item);
    setForm({
      name: String(item.name||''),
      contact_name: String(item.contact_name||''),
      email: String(item.email||''),
      phone: String(item.phone||''),
      address: String(item.address||''),
      website: String(item.website||''),
      tax_id: String(item.tax_id||''),
      status: String(item.status||'active'),
      rating: Number(item.rating||0),
      category: String(item.category||'General'),
      payment_terms: String(item.payment_terms||''),
      notes: String(item.notes||''),
      insurance_expiry: String(item.insurance_expiry||''),
      compliance_status: String(item.compliance_status||'pending'),
    });
    setShowModal(true);
  }

  function openDetail(item: AnyRow) {
    setSelected(item);
    loadHistory(String(item.id));
    setShowDetail(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload: AnyRow = {
      ...form,
      rating: Number(form.rating),
    };
    if (editing) {
      await updateMutation.mutateAsync({ id: String(editing.id), data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowModal(false);
  }

  async function handleDelete(item: AnyRow) {
    if (!confirm(`Delete supplier "${item.name}"?`)) return;
    await deleteMutation.mutateAsync(String(item.id));
    if (selected?.id === item.id) setShowDetail(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="text-slate-500">Suppliers & Vendors</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-7 h-7 text-amber-500" />
            Suppliers & Vendors
          </h1>
          <p className="text-slate-400 mt-1">Manage supplier directory, ratings, compliance & purchase history</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setTab('directory')} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab==='directory'?'bg-amber-500/20 text-amber-400':'text-slate-400 hover:text-white'}`}>Directory</button>
          <button onClick={()=>setTab('analytics')} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab==='analytics'?'bg-amber-500/20 text-amber-400':'text-slate-400 hover:text-white'}`}>Analytics</button>
          <button onClick={openCreate} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      {tab==='directory' && (
        <>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
            </div>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
              <option value="All">All Status</option>
              {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading suppliers...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Building2} title="No suppliers found" description={search ? "Try adjusting your filters." : "Add your first supplier to get started."} action={{ label: 'Add Supplier', onClick: openCreate }} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800">
                  <tr className="text-left text-slate-400">
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Compliance</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filtered.map((s: AnyRow) => (
                    <tr key={String(s.id)} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <button onClick={()=>openDetail(s)} className="font-medium text-white hover:text-amber-400 text-left">{s.name as string}</button>
                            <div className="text-xs text-slate-500">{s.tax_id ? `Tax ID: ${s.tax_id}` : 'No tax ID'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300 text-sm">{s.contact_name as string || '-'}</div>
                        <div className="text-xs text-slate-500">{s.email as string || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.category as string || '-'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[String(s.status)]||'bg-gray-700/30 text-gray-300'}`}>{String(s.status).replace(/_/g,' ')}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${complianceColor[String(s.compliance_status)]||'bg-gray-700/30 text-gray-300'}`}>{String(s.compliance_status).replace(/_/g,' ')}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star=> (
                            <Star key={star} className={`w-3.5 h-3.5 ${Number(s.rating||0) >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={()=>openEdit(s)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={()=>handleDelete(s)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab==='analytics' && analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label:'Total Suppliers', value: analytics.total, icon: Building2, color:'text-blue-400' },
            { label:'Active', value: analytics.active, icon: CheckCircle2, color:'text-green-400' },
            { label:'Compliant', value: analytics.compliant, icon: ShieldCheck, color:'text-emerald-400' },
            { label:'Expired', value: analytics.expired, icon: AlertTriangle, color:'text-red-400' },
            { label:'Avg Rating', value: Number(analytics.avg_rating).toFixed(1), icon: Star, color:'text-amber-400' },
            { label:'Insurance Due', value: analytics.insurance_due, icon: Clock, color:'text-yellow-400' },
          ].map(card=><div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              {React.createElement(card.icon as React.FC<any>, { className: `w-5 h-5 ${card.color}` })}
              <span className="text-2xl font-bold text-white">{String(card.value)}</span>
            </div>
            <div className="text-sm text-slate-400">{card.label}</div>
          </div>)}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button onClick={()=>setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs text-slate-400">Name *</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Contact Name</label><input value={form.contact_name} onChange={e=>setForm({...form,contact_name:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Phone</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1 md:col-span-2"><label className="text-xs text-slate-400">Address</label><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Website</label><input value={form.website} onChange={e=>setForm({...form,website:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Tax ID</label><input value={form.tax_id} onChange={e=>setForm({...form,tax_id:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Category</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none">{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none">{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Rating (0-5)</label><input type="number" min={0} max={5} step={0.5} value={form.rating} onChange={e=>setForm({...form,rating:Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Payment Terms</label><input value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Insurance Expiry</label><input type="date" value={form.insurance_expiry} onChange={e=>setForm({...form,insurance_expiry:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-400">Compliance Status</label><select value={form.compliance_status} onChange={e=>setForm({...form,compliance_status:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none">{COMPLIANCE_OPTIONS.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}</select></div>
              </div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">{editing ? 'Save Changes' : 'Create Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {showDetail && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-700 h-full overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{selected.name as string}</h2>
              <button onClick={()=>setShowDetail(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</div>
                  <div className="text-sm text-white">{selected.email as string || '-'}</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</div>
                  <div className="text-sm text-white">{selected.phone as string || '-'}</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</div>
                  <div className="text-sm text-white">{selected.address as string || '-'}</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Website</div>
                  <div className="text-sm text-white">{selected.website as string ? <a href={String(selected.website)} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">{String(selected.website)}</a> : '-'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[String(selected.status)]}`}>{String(selected.status).replace(/_/g,' ')}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${complianceColor[String(selected.compliance_status)]}`}>{String(selected.compliance_status).replace(/_/g,' ')}</span>
                <div className="flex items-center gap-1 ml-auto">
                  {[1,2,3,4,5].map(star=> (
                    <Star key={star} className={`w-4 h-4 ${Number(selected.rating||0) >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Purchase History</h3>
                {history.length === 0 ? (
                  <div className="text-sm text-slate-500">No purchase orders found.</div>
                ) : (
                  <div className="space-y-2">
                    {history.map((h: AnyRow) => (
                      <div key={String(h.id)} className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white font-medium">PO #{h.number as string}</div>
                          <div className="text-xs text-slate-500">{h.order_date as string || '-'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white">£{Number(h.amount||0).toLocaleString()}</div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{h.status as string}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button onClick={()=>{setShowDetail(false); openEdit(selected);}} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium">Edit</button>
                <button onClick={()=>handleDelete(selected)} className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
