// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import {
  Plus, Search, AlertTriangle, Construction,
  Shield, Eye, Edit, X, Trash2, Upload
} from 'lucide-react';
import { useTempWorks } from '../../hooks/useData';
import { toast } from 'sonner';
import { uploadFile } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

interface TempWork {
  id: string;
  reference?: string | null;
  title?: string | null;
  project_id?: string | null;
  project?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  location?: string | null;
  design_by?: string | null;
  approved_by?: string | null;
  design_date?: string | null;
  approval_date?: string | null;
  erected_by?: string | null;
  erected_date?: string | null;
  inspected_by?: string | null;
  inspected_date?: string | null;
  load_capacity?: string | null;
  notes?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  design: { label: 'In Design', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  approval: { label: 'Pending Approval', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  installed: { label: 'Installed', color: 'text-green-400', bg: 'bg-green-500/10' },
  in_use: { label: 'In Use', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  removed: { label: 'Removed', color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

export default function TempWorks() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [uploading, setUploading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState({
    title: '',
    project: '',
    type: 'Structural Support',
    description: '',
    location: '',
    design_by: '',
    design_date: '',
    approved_by: '',
    approval_date: '',
    erected_by: '',
    erected_date: '',
    inspected_by: '',
    inspected_date: '',
    load_capacity: '',
    notes: '',
    status: 'design',
  });

  const { useList, useCreate, useUpdate, useDelete } = useTempWorks;
  const { data: rawTempWorks = [] } = useList();
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const filtered = (rawTempWorks as unknown as TempWork[]).filter((t: TempWork) => {
    const matchesSearch = (t.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!form.title) return;
    try {
      await createMutation.mutateAsync({
        reference: `TW-${String(Date.now()).slice(-6)}`,
        title: form.title,
        project: form.project || '',
        type: form.type,
        description: form.description || '',
        location: form.location || '',
        design_by: form.design_by || '',
        design_date: form.design_date || null,
        approved_by: form.approved_by || '',
        approval_date: form.approval_date || null,
        erected_by: form.erected_by || '',
        erected_date: form.erected_date || null,
        inspected_by: form.inspected_by || '',
        inspected_date: form.inspected_date || null,
        load_capacity: form.load_capacity || '',
        notes: form.notes || '',
        status: form.status,
      });
      toast.success('Temporary work created');
      setShowCreateModal(false);
      setForm({ title: '', project: '', type: 'Structural Support', description: '', location: '', design_by: '', design_date: '', approved_by: '', approval_date: '', erected_by: '', erected_date: '', inspected_by: '', inspected_date: '', load_capacity: '', notes: '', status: 'design' });
    } catch {
      toast.error('Failed to create temporary work');
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.id) return;
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          title: form.title,
          project: form.project || '',
          type: form.type,
          description: form.description || '',
          location: form.location || '',
          design_by: form.design_by || '',
          design_date: form.design_date || null,
          approved_by: form.approved_by || '',
          approval_date: form.approval_date || null,
          erected_by: form.erected_by || '',
          erected_date: form.erected_date || null,
          inspected_by: form.inspected_by || '',
          inspected_date: form.inspected_date || null,
          load_capacity: form.load_capacity || '',
          notes: form.notes || '',
          status: form.status,
        },
      });
      toast.success('Temporary work updated');
      setEditItem(null);
      setForm({ title: '', project: '', type: 'Structural Support', description: '', location: '', design_by: '', design_date: '', approved_by: '', approval_date: '', erected_by: '', erected_date: '', inspected_by: '', inspected_date: '', load_capacity: '', notes: '', status: 'design' });
    } catch {
      toast.error('Failed to update temporary work');
    }
  };

  const openEditModal = (item: TempWork) => {
    setEditItem(item);
    setForm({
      title: item.title || '',
      project: item.project || '',
      type: item.type || 'Structural Support',
      description: item.description || '',
      location: item.location || '',
      design_by: item.design_by || '',
      design_date: item.design_date || '',
      approved_by: item.approved_by || '',
      approval_date: item.approval_date || '',
      erected_by: item.erected_by || '',
      erected_date: item.erected_date || '',
      inspected_by: item.inspected_by || '',
      inspected_date: item.inspected_date || '',
      load_capacity: item.load_capacity || '',
      notes: item.notes || '',
      status: item.status || 'design',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this temporary work?')) return;
    try {
      await deleteMutation.mutateAsync(String(id));
      toast.success('Temporary work deleted');
    } catch {
      toast.error('Failed to delete temporary work');
    }
  };

  async function handleUploadDoc(id: string, file: File) {
    setUploading(id);
    try {
      await uploadFile(file, 'REPORTS');
      toast.success(`Uploaded: ${file.name}`);
    } catch {
      console.error('Upload failed');
      toast.error('Upload failed');
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="temp-works" />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-white">
            Temporary Works
          </h2>
          <p className="text-gray-400 text-sm mt-1">Manage temporary works design, approval and installation</p>
        </div>
        <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
          <Plus size={18} /> New Temporary Work
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Construction className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-gray-400 text-xs">In Design</p>
              <p className="text-2xl font-display text-white">{rawTempWorks.filter((t: TempWork) => t.status === 'design').length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="text-amber-400" size={20} />
            </div>
            <div>
              <p className="text-gray-400 text-xs">Pending Approval</p>
              <p className="text-2xl font-display text-amber-400">{rawTempWorks.filter((t: TempWork) => t.status === 'approval').length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Shield className="text-emerald-400" size={20} />
            </div>
            <div>
              <p className="text-gray-400 text-xs">In Use</p>
              <p className="text-2xl font-display text-emerald-400">{rawTempWorks.filter((t: TempWork) => t.status === 'in_use').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search temporary works..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 input input-bordered text-white placeholder-gray-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 input input-bordered text-white"
          >
            <option value="all">All Status</option>
            <option value="design">In Design</option>
            <option value="approval">Pending Approval</option>
            <option value="installed">Installed</option>
            <option value="in_use">In Use</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        <div className="space-y-3">
          {filtered.map((tw) => {
            const status = statusConfig[tw.status] || { label: 'Unknown', color: 'text-gray-400', bg: 'bg-gray-500/10' };
            return (
              <div key={tw.id} className="border border-gray-700 rounded-lg p-4 hover:border-orange-500/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-orange-400">{tw.ref}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${status.bg} ${status.color}`}>{status.label}</span>
                    </div>
                    <h3 className="text-white font-medium">{tw.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{tw.project}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"><Eye size={16} /></button>
                    <button
                      type="button"
                      onClick={() => openEditModal(tw)}
                      className="p-2 hover:bg-blue-900/30 rounded"
                      title="Edit"
                    >
                      <Edit size={16} className="text-blue-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(String(tw.id))}
                      className="p-2 hover:bg-red-900/30 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                    <input
                      type="file"
                      id={`upload-temp-${tw.id}`}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDoc(String(tw.id), file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById(`upload-temp-${tw.id}`)?.click()}
                      disabled={uploading === String(tw.id)}
                      className="p-2 hover:bg-blue-900/30 rounded disabled:opacity-50"
                      title="Upload Document"
                    >
                      <Upload size={16} className="text-blue-400" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Type</p>
                    <p className="text-white">{tw.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Designer</p>
                    <p className="text-white">{tw.designer}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Installer</p>
                    <p className="text-white">{tw.installer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">New Temporary Work</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="twTitle" className="block text-gray-400 text-xs mb-1">Title *</label>
                <input id="twTitle" type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Tower Crane Bases" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div>
                <label htmlFor="twProject" className="block text-gray-400 text-xs mb-1">Project</label>
                <input id="twProject" type="text" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="Project name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twType" className="block text-gray-400 text-xs mb-1">Type</label>
                  <select id="twType" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="Structural Support">Structural Support</option>
                    <option value="Propping">Propping</option>
                    <option value="Scaffolding">Scaffolding</option>
                    <option value="Excavation">Excavation</option>
                    <option value="Formwork">Formwork</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="twStatus" className="block text-gray-400 text-xs mb-1">Status</label>
                  <select id="twStatus" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="design">In Design</option>
                    <option value="approval">Pending Approval</option>
                    <option value="installed">Installed</option>
                    <option value="in_use">In Use</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twDesigner" className="block text-gray-400 text-xs mb-1">Designer</label>
                  <input id="twDesigner" type="text" value={form.designer} onChange={e => setForm(f => ({ ...f, designer: e.target.value }))} placeholder="Designer name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twInstaller" className="block text-gray-400 text-xs mb-1">Installer</label>
                  <input id="twInstaller" type="text" value={form.installer} onChange={e => setForm(f => ({ ...f, installer: e.target.value }))} placeholder="Installer name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div>
                <label htmlFor="twDesc" className="block text-gray-400 text-xs mb-1">Description</label>
                <textarea id="twDesc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description..." rows={3} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={createMutation.isPending || !form.title} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">Edit Temporary Work</h3>
              <button type="button" onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twTitle" className="block text-gray-400 text-xs mb-1">Title *</label>
                  <input id="twTitle" type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Tower Crane Bases" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twProject" className="block text-gray-400 text-xs mb-1">Project</label>
                  <input id="twProject" type="text" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="Project name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twType" className="block text-gray-400 text-xs mb-1">Type</label>
                  <select id="twType" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="Structural Support">Structural Support</option>
                    <option value="Propping">Propping</option>
                    <option value="Scaffolding">Scaffolding</option>
                    <option value="Excavation">Excavation</option>
                    <option value="Formwork">Formwork</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="twStatus" className="block text-gray-400 text-xs mb-1">Status</label>
                  <select id="twStatus" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="design">In Design</option>
                    <option value="approval">Pending Approval</option>
                    <option value="installed">Installed</option>
                    <option value="in_use">In Use</option>
                    <option value="removed">Removed</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="twLoc" className="block text-gray-400 text-xs mb-1">Location</label>
                <input id="twLoc" type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Sector A, Level 2" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div>
                <label htmlFor="twDesc" className="block text-gray-400 text-xs mb-1">Description</label>
                <textarea id="twDesc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description..." rows={2} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twDesignBy" className="block text-gray-400 text-xs mb-1">Designed By</label>
                  <input id="twDesignBy" type="text" value={form.design_by} onChange={e => setForm(f => ({ ...f, design_by: e.target.value }))} placeholder="Engineer name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twDesignDate" className="block text-gray-400 text-xs mb-1">Design Date</label>
                  <input id="twDesignDate" type="date" value={form.design_date} onChange={e => setForm(f => ({ ...f, design_date: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twAppBy" className="block text-gray-400 text-xs mb-1">Approved By</label>
                  <input id="twAppBy" type="text" value={form.approved_by} onChange={e => setForm(f => ({ ...f, approved_by: e.target.value }))} placeholder="Approver name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twAppDate" className="block text-gray-400 text-xs mb-1">Approval Date</label>
                  <input id="twAppDate" type="date" value={form.approval_date} onChange={e => setForm(f => ({ ...f, approval_date: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twErectBy" className="block text-gray-400 text-xs mb-1">Erected By</label>
                  <input id="twErectBy" type="text" value={form.erected_by} onChange={e => setForm(f => ({ ...f, erected_by: e.target.value }))} placeholder="Installer name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twErectDate" className="block text-gray-400 text-xs mb-1">Erected Date</label>
                  <input id="twErectDate" type="date" value={form.erected_date} onChange={e => setForm(f => ({ ...f, erected_date: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twInspBy" className="block text-gray-400 text-xs mb-1">Inspected By</label>
                  <input id="twInspBy" type="text" value={form.inspected_by} onChange={e => setForm(f => ({ ...f, inspected_by: e.target.value }))} placeholder="Inspector name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twInspDate" className="block text-gray-400 text-xs mb-1">Inspected Date</label>
                  <input id="twInspDate" type="date" value={form.inspected_date} onChange={e => setForm(f => ({ ...f, inspected_date: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="twLoad" className="block text-gray-400 text-xs mb-1">Load Capacity</label>
                  <input id="twLoad" type="text" value={form.load_capacity} onChange={e => setForm(f => ({ ...f, load_capacity: e.target.value }))} placeholder="e.g. 5kN/m2" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="twNotes" className="block text-gray-400 text-xs mb-1">Notes</label>
                  <input id="twNotes" type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional info..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="button" onClick={handleUpdate} disabled={updateMutation.isPending || !form.title} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
