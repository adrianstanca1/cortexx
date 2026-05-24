// @ts-nocheck
 
import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, X, Upload, CheckSquare, Square, CheckCircle, AlertCircle, Clock, BarChart3, Calendar } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { uploadFile } from '../../services/api';
import { useSignage } from '../../hooks/useData';
import { toast } from 'sonner';

const SIGN_TYPES = [
  { value: 'safety', label: 'Safety Warning' },
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'prohibition', label: 'Prohibition' },
  { value: 'information', label: 'Information' },
  { value: 'directional', label: 'Directional' },
  { value: 'fire', label: 'Fire' },
];

const SIGN_STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-green-500/10 text-green-400' },
  { value: 'damaged', label: 'Damaged', color: 'bg-red-500/10 text-red-400' },
  { value: 'expired', label: 'Expired', color: 'bg-orange-500/10 text-orange-400' },
  { value: 'pending', label: 'Pending', color: 'bg-blue-500/10 text-blue-400' },
];

interface Sign {
  id: string;
  reference?: string | null;
  project_id?: string | null;
  project?: string | null;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  size?: string | null;
  material?: string | null;
  quantity?: number | null;
  status?: string | null;
  required_date?: string | null;
  installed_date?: string | null;
  installed_by?: string | null;
  notes?: string | null;
}

export default function Signage() {
  const [activeTab, setActiveTab] = useState<'active' | 'schedule' | 'compliance' | 'reports'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    type: 'safety',
    location: '',
    description: '',
    size: '',
    material: '',
    quantity: '1',
    required_date: '',
    installed_date: '',
    installed_by: '',
    notes: '',
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Sign | null>(null);

  const { useList, useCreate, useUpdate, useDelete } = useSignage;
  const listResult = useList();
  const { data: signage = [], isLoading } = { data: listResult.data || [], isLoading: listResult.isLoading };
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const displaySignage = signage;

  const filtered = useMemo(() =>
    displaySignage.filter((s: Sign) =>
      (s.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.sign_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [displaySignage, searchTerm]
  );

  // Calculate compliance stats from filtered data
  const complianceStats = useMemo(() => {
    const total = filtered.length;
    const compliant = filtered.filter((s: Sign) => s.status === 'active').length;
    const overdue = filtered.filter((s: Sign) => {
      if (!s.next_inspection) return false;
      return new Date(s.next_inspection) < new Date();
    }).length;
    return { total, compliant, overdue, percentage: total > 0 ? Math.round((compliant / total) * 100) : 0 };
  }, [filtered]);

  // Get upcoming inspections (next 30 days) from filtered data
  const upcomingInspections = useMemo(() => {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return filtered
      .filter((s: Sign) => {
        if (!s.next_inspection) return false;
        const nextInspDate = new Date(s.next_inspection);
        return nextInspDate >= now && nextInspDate <= thirtyDaysLater;
      })
      .sort((a: Sign, b: Sign) => {
        const dateA = a.next_inspection ? new Date(a.next_inspection).getTime() : 0;
        const dateB = b.next_inspection ? new Date(b.next_inspection).getTime() : 0;
        return dateA - dateB;
      });
  }, [filtered]);

  // Sign type breakdown from filtered data
  const typeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filtered.forEach((s: Sign) => {
      const type = SIGN_TYPES.find(t => t.value === s.sign_type)?.label || 'Other';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });
    return breakdown;
  }, [filtered]);

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} signage item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const handleCreate = async () => {
    if (!form.location) {
      toast.error('Location is required');
      return;
    }
    try {
      await createMutation.mutateAsync({
        type: form.type,
        location: form.location,
        description: form.description || '',
        size: form.size || '',
        material: form.material || '',
        quantity: form.quantity !== null && form.quantity !== undefined ? parseInt(form.quantity) : 1,
        required_date: form.required_date || null,
        installed_date: form.installed_date || null,
        installed_by: form.installed_by || '',
        notes: form.notes || '',
        status: 'pending',
      });
      toast.success('Signage created successfully');
      setShowCreateModal(false);
      setForm({ type: 'safety', location: '', description: '', size: '', material: '', quantity: '1', required_date: '', installed_date: '', installed_by: '', notes: '' });
    } catch (err) {
      toast.error(`Failed to create: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this signage record?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Signage deleted successfully');
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.location) {
      toast.error('Location is required');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          type: editItem.type,
          location: editItem.location,
          description: editItem.description,
          size: editItem.size,
          material: editItem.material,
          quantity: editItem.quantity,
          required_date: editItem.required_date,
          installed_date: editItem.installed_date,
          installed_by: editItem.installed_by,
          notes: editItem.notes,
          status: editItem.status,
        },
      });
      toast.success('Signage updated successfully');
      setEditItem(null);
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  async function handleUploadDoc(id: string, file: File) {
    setUploading(id);
    try {
      await uploadFile(file, 'REPORTS');
      toast.success(`Uploaded: ${file.name}`);
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(null);
    }
  }

  const getStatusColor = (status?: string | null) => {
    const match = SIGN_STATUSES.find(s => s.value === status);
    return match?.color || 'bg-gray-500/10 text-gray-400';
  };

  const getStatusLabel = (status?: string | null) => {
    const match = SIGN_STATUSES.find(s => s.value === status);
    return match?.label || 'Unknown';
  };

  const getInspectionUrgency = (nextInspection?: string | null) => {
    if (!nextInspection) return { color: 'bg-gray-500/10 text-gray-400', icon: Clock, label: 'Scheduled' };
    const now = new Date();
    const next = new Date(nextInspection as string);
    const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { color: 'bg-red-500/10 text-red-400', icon: AlertCircle, label: 'Overdue' };
    if (daysUntil <= 7) return { color: 'bg-orange-500/10 text-orange-400', icon: AlertCircle, label: 'Due Soon' };
    return { color: 'bg-green-500/10 text-green-400', icon: CheckCircle, label: 'On Schedule' };
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="signage" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Site Signage Management</h2>
            <p className="text-gray-400 text-sm mt-1">Manage safety, warning and information signage across the site</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            <Plus size={18} /> Add Sign
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="card border-b border-gray-700">
          <div className="flex gap-0">
            {[
              { id: 'active' as const, label: 'Active Signage', icon: CheckCircle },
              { id: 'schedule' as const, label: 'Inspection Schedule', icon: Calendar },
              { id: 'compliance' as const, label: 'Compliance', icon: CheckSquare },
              { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-400'
                    : 'border-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                <tab.icon size={18} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ACTIVE SIGNAGE TAB */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            <div className="card p-4">
              <input
                type="text"
                placeholder="Search by description, location, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 input input-bordered text-white mb-4"
              />

              {isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading signage...</div>
              ) : filtered.length === 0 ? (
                <EmptyState title="No signage items found" />
              ) : (
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">
                          <button
                            onClick={() => {
                              if (selectedIds.size === filtered.length) clearSelection();
                              else filtered.forEach((s: Sign) => toggle(String(s.id)));
                            }}
                          >
                            {selectedIds.size === filtered.length && filtered.length > 0 ? (
                              <CheckSquare size={16} className="text-blue-400" />
                            ) : (
                              <Square size={16} className="text-gray-500" />
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Location</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Last Inspected</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Next Inspection</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Notes</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s: Sign) => {
                        const isSelected = selectedIds.has(String(s.id));
                        return (
                          <tr key={s.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                            <td className="py-3 px-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle(String(s.id));
                                }}
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-blue-400" />
                                ) : (
                                  <Square size={16} className="text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-gray-300">
                                {SIGN_TYPES.find(t => t.value === s.sign_type)?.label || s.sign_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-300">{s.location || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(s.status)}`}>
                                {getStatusLabel(s.status)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-xs">
                              {s.last_inspected ? new Date(s.last_inspected).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className={`px-2 py-1 rounded ${getInspectionUrgency(s.next_inspection).color}`}>
                                {s.next_inspection ? new Date(s.next_inspection).toLocaleDateString() : 'TBD'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-xs max-w-xs truncate">{s.notes || '-'}</td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex gap-1 justify-center">
                                <button
                                  onClick={() => setEditItem(s)}
                                  className="p-1 hover:bg-gray-700 rounded"
                                  title="Edit"
                                >
                                  <Edit size={14} className="text-blue-400" />
                                </button>
                                <button
                                  onClick={() => handleDelete(String(s.id))}
                                  className="p-1 hover:bg-red-900/30 rounded"
                                  title="Delete"
                                >
                                  <Trash2 size={14} className="text-red-400" />
                                </button>
                                <input
                                  type="file"
                                  id={`upload-sign-${s.id}`}
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadDoc(String(s.id), file);
                                    e.target.value = '';
                                  }}
                                />
                                <button
                                  onClick={() => document.getElementById(`upload-sign-${s.id}`)?.click()}
                                  disabled={uploading === String(s.id)}
                                  className="p-1 hover:bg-blue-900/30 rounded disabled:opacity-50"
                                  title="Upload"
                                >
                                  <Upload size={14} className="text-blue-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                {
                  id: 'delete',
                  label: 'Delete Selected',
                  icon: Trash2,
                  variant: 'danger',
                  onClick: handleBulkDelete,
                  confirm: 'This action cannot be undone.',
                },
              ]}
              onClearSelection={clearSelection}
            />
          </div>
        )}

        {/* INSPECTION SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            {upcomingInspections.length === 0 ? (
              <div className="card p-8 text-center">
                <Calendar className="mx-auto mb-4 text-gray-500" size={32} />
                <p className="text-gray-400">No inspections scheduled for the next 30 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingInspections.map((s: Sign) => {
                  const urgency = getInspectionUrgency(s.next_inspection);
                  const UrgencyIcon = urgency.icon;
                  return (
                    <div key={s.id} className={`card p-4 border-l-4 ${urgency.color}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <UrgencyIcon size={16} className={urgency.color.split(' ')[1]} />
                            <h4 className="font-medium text-white">{s.description}</h4>
                            <span className={`text-xs px-2 py-1 rounded ${urgency.color}`}>{urgency.label}</span>
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            Location: <span className="text-gray-300">{s.location}</span>
                          </p>
                          <p className="text-gray-400 text-sm">
                            Due: <span className="text-white font-medium">{s.next_inspection ? new Date(s.next_inspection).toLocaleDateString() : 'TBD'}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setEditItem(s)}
                          className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-sm font-medium"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* COMPLIANCE TAB */}
        {activeTab === 'compliance' && (
          <div className="space-y-6">
            {/* Compliance Meter */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Compliance Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <p className="text-gray-400 text-sm mb-2">Total Signage</p>
                  <p className="text-3xl font-bold text-white">{complianceStats.total}</p>
                </div>
                <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/30">
                  <p className="text-green-400 text-sm mb-2">Compliant</p>
                  <p className="text-3xl font-bold text-green-400">{complianceStats.compliant}</p>
                </div>
                <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                  <p className="text-red-400 text-sm mb-2">Overdue Inspection</p>
                  <p className="text-3xl font-bold text-red-400">{complianceStats.overdue}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 font-medium">Compliance Rate</span>
                  <span className="text-2xl font-bold text-white">{complianceStats.percentage}%</span>
                </div>
                <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all"
                    style={{ width: `${complianceStats.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Non-compliant Signage */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Non-Compliant Items</h3>
              {displaySignage.filter((s: Sign) => s.status !== 'active').length === 0 ? (
                <p className="text-gray-400 text-center py-4">All signage is compliant!</p>
              ) : (
                <div className="space-y-2">
                  {displaySignage
                    .filter((s: Sign) => s.status !== 'active')
                    .map((s: Sign) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded">
                        <div>
                          <p className="text-white font-medium">{s.description}</p>
                          <p className="text-gray-400 text-sm">{s.location}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(s.status)}`}>
                          {getStatusLabel(s.status)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Regulatory Info */}
            <div className="card p-6 bg-blue-500/5 border border-blue-500/30">
              <h3 className="text-lg font-bold text-blue-400 mb-4">UK HSE Signage Regulations</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex gap-2">
                  <span className="text-blue-400">•</span>
                  <span>Health and Safety (Safety Signs and Signals) Regulations 1996</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">•</span>
                  <span>ISO 3864: Safety Colors and Safety Signs</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">•</span>
                  <span>Signs must be regularly inspected and maintained in good condition</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">•</span>
                  <span>Damaged or faded signs must be replaced immediately</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-400">•</span>
                  <span>Inspection frequency: Recommended monthly for high-traffic areas</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-blue-500/10 border border-blue-500/30">
                <p className="text-blue-400 text-sm font-medium mb-2">Total Signs</p>
                <p className="text-3xl font-bold text-white">{displaySignage.length}</p>
              </div>
              <div className="card p-4 bg-green-500/10 border border-green-500/30">
                <p className="text-green-400 text-sm font-medium mb-2">Compliant %</p>
                <p className="text-3xl font-bold text-green-400">{complianceStats.percentage}%</p>
              </div>
              <div className="card p-4 bg-orange-500/10 border border-orange-500/30">
                <p className="text-orange-400 text-sm font-medium mb-2">Due Soon (7 days)</p>
                <p className="text-3xl font-bold text-orange-400">
                  {upcomingInspections.filter((s: Sign) => {
                    if (!s.next_inspection) return false;
                    const days = Math.ceil((new Date(s.next_inspection).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return days > 0 && days <= 7;
                  }).length}
                </p>
              </div>
              <div className="card p-4 bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 text-sm font-medium mb-2">Damaged/Expired</p>
                <p className="text-3xl font-bold text-red-400">
                  {displaySignage.filter((s: Sign) => s.status === 'damaged' || s.status === 'expired').length}
                </p>
              </div>
            </div>

            {/* Sign Type Breakdown */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Signage by Type</h3>
              <div className="space-y-4">
                {Object.entries(typeBreakdown).map(([type, count]) => {
                  const percentage = (count / displaySignage.length) * 100;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 font-medium">{type}</span>
                        <span className="text-white font-bold">{count}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="card p-6">
              <h3 className="text-lg font-bold text-white mb-4">Status Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SIGN_STATUSES.map(status => {
                  const count = displaySignage.filter((s: Sign) => s.status === status.value).length;
                  return (
                    <div key={status.value} className={`p-3 rounded border ${status.color}`}>
                      <p className="text-xs font-medium mb-1">{status.label}</p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {(showCreateModal || editItem) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
              <h3 className="text-xl font-bold text-white">{editItem ? 'Edit Signage' : 'Add New Signage'}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditItem(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="signType" className="block text-gray-400 text-xs mb-1">
                  Sign Type *
                </label>
                <select
                  id="signType"
                  value={editItem ? editItem.sign_type || 'safety' : form.sign_type}
                  onChange={(e) => {
                    if (editItem) {
                      setEditItem({ ...editItem, sign_type: e.target.value });
                    } else {
                      setForm({ ...form, sign_type: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 input input-bordered text-white"
                >
                  {SIGN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="location" className="block text-gray-400 text-xs mb-1">
                  Location *
                </label>
                <input
                  id="location"
                  type="text"
                  value={editItem ? editItem.location || '' : form.location}
                  onChange={(e) => {
                    if (editItem) {
                      setEditItem({ ...editItem, location: e.target.value });
                    } else {
                      setForm({ ...form, location: e.target.value });
                    }
                  }}
                  placeholder="e.g. Site Entrance"
                  className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-gray-400 text-xs mb-1">
                  Description
                </label>
                <input
                  id="description"
                  type="text"
                  value={editItem ? editItem.description || '' : form.description}
                  onChange={(e) => {
                    if (editItem) {
                      setEditItem({ ...editItem, description: e.target.value });
                    } else {
                      setForm({ ...form, description: e.target.value });
                    }
                  }}
                  placeholder="e.g. Hard Hat Area"
                  className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="installDate" className="block text-gray-400 text-xs mb-1">
                    Installation Date
                  </label>
                  <input
                    id="installDate"
                    type="date"
                    value={editItem ? editItem.installation_date || '' : form.installation_date}
                    onChange={(e) => {
                      if (editItem) {
                        setEditItem({ ...editItem, installation_date: e.target.value });
                      } else {
                        setForm({ ...form, installation_date: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 input input-bordered text-white"
                  />
                </div>

                <div>
                  <label htmlFor="interval" className="block text-gray-400 text-xs mb-1">
                    Inspection Interval (days)
                  </label>
                  <input
                    id="interval"
                    type="number"
                    min="7"
                    max="365"
                    value={editItem ? editItem.inspection_interval || '30' : form.inspection_interval}
                    onChange={(e) => {
                      if (editItem) {
                        setEditItem({ ...editItem, inspection_interval: (() => { const val = parseInt(e.target.value); return isNaN(val) ? 30 : val; })() });
                      } else {
                        setForm({ ...form, inspection_interval: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 input input-bordered text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-gray-400 text-xs mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={editItem ? editItem.notes || '' : form.notes}
                  onChange={(e) => {
                    if (editItem) {
                      setEditItem({ ...editItem, notes: e.target.value });
                    } else {
                      setForm({ ...form, notes: e.target.value });
                    }
                  }}
                  placeholder="e.g. Location details, condition, etc."
                  className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500 resize-none h-20"
                />
              </div>

              {editItem && (
                <>
                  <div>
                    <label htmlFor="status" className="block text-gray-400 text-xs mb-1">
                      Status
                    </label>
                    <select
                      id="status"
                      value={editItem.status || 'active'}
                      onChange={(e) => setEditItem({ ...editItem, status: e.target.value })}
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      {SIGN_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="lastInspected" className="block text-gray-400 text-xs mb-1">
                        Last Inspected
                      </label>
                      <input
                        id="lastInspected"
                        type="date"
                        value={editItem.last_inspected || ''}
                        onChange={(e) => setEditItem({ ...editItem, last_inspected: e.target.value })}
                        className="w-full px-3 py-2 input input-bordered text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="nextInspection" className="block text-gray-400 text-xs mb-1">
                        Next Inspection
                      </label>
                      <input
                        id="nextInspection"
                        type="date"
                        value={editItem.next_inspection || ''}
                        onChange={(e) => setEditItem({ ...editItem, next_inspection: e.target.value })}
                        className="w-full px-3 py-2 input input-bordered text-white"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditItem(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={editItem ? handleUpdate : handleCreate}
                disabled={
                  editItem
                    ? updateMutation.isPending || !editItem.location
                    : createMutation.isPending || !form.location
                }
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {editItem
                  ? updateMutation.isPending
                    ? 'Saving...'
                    : 'Save Changes'
                  : createMutation.isPending
                    ? 'Creating...'
                    : 'Add Signage'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
