// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import { Plus, Ruler, BarChart3, FileText, Trash2, X, Pencil, Layers, TrendingUp } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { uploadFile } from '../../services/api';
import { toast } from 'sonner';
import { useMeasuring } from '../../hooks/useData';

interface Measurement {
  id: string;
  reference?: string | null;
  project_id?: string | null;
  project?: string | null;
  survey_type?: string | null;
  location?: string | null;
  status?: string | null;
  surveyor?: string | null;
  survey_date?: string | null;
  completed_date?: string | null;
  areas?: string | null;
  total_area?: number | null;
  unit?: string | null;
  section?: string | null;
  rate?: number | null;
  quantity?: number | null;
  description?: string | null;
  notes?: string | null;
}

interface Section {
  name: string;
  items: Measurement[];
}

interface _Valuation {
  period: string;
  amount_certified: number;
  cumulative_total: number;
  retention_deducted: number;
  net_payment: number;
}

interface MeasurementFormData {
  reference: string;
  item_no: string;
  survey_type: string;
  location: string;
  surveyor: string;
  survey_date: string;
  total_area: string;
  unit: string;
  section: string;
  quantity: string;
  rate: string;
  description: string;
  notes: string;
}

export default function Measuring() {
  const [activeTab, setActiveTab] = useState<'takeoff' | 'bq' | 'valuations' | 'reports'>('takeoff');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_uploading, setUploading] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Measurement | null>(null);
  const [form, setForm] = useState<MeasurementFormData>({
    reference: '',
    item_no: '',
    survey_type: 'General',
    location: '',
    surveyor: '',
    survey_date: '',
    total_area: '',
    unit: 'm²',
    section: 'Fit-Out',
    quantity: '',
    rate: '',
    description: '',
    notes: '',
  });

  const listResult = useMeasuring.useList();
  const createMutation = useMeasuring.useCreate();
  const updateMutation = useMeasuring.useUpdate();
  const deleteMutation = useMeasuring.useDelete();

  // Memoize measurements to avoid dependency array changes
  const measurements = useMemo(() => listResult.data || [], [listResult.data]);

  // Filter data
  const filtered = useMemo(() =>
    measurements.filter((m: Measurement) =>
      (m.reference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.location || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [measurements, searchTerm]
  );


  // Organize by section from filtered data
  const sections: Section[] = useMemo(() => {
    const grouped: Record<string, Measurement[]> = {};
    filtered.forEach(m => {
      const section = m.section || 'Other';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(m);
    });
    return Object.entries(grouped).map(([name, items]) => ({ name, items }));
  }, [filtered]);

  // Calculate totals from filtered data
  const totals = useMemo(() => {
    const totalArea = filtered.reduce((sum, m) => sum + (m.total_area || 0), 0);
    const measuredItems = filtered.filter(m => m.total_area && m.total_area > 0).length;
    const measurementPercentage = filtered.length > 0 ? Math.round((measuredItems / filtered.length) * 100) : 0;
    const costPlanTotal = 0; // Not applicable for simple measuring

    return { grandTotal: totalArea, costPlanTotal, measuredItems, measurementPercentage, totalItems: filtered.length };
  }, [filtered]);

  const handleCreate = async () => {
    if (!form.reference && !form.location) {
      toast.error('Reference or Location is required');
      return;
    }
    try {
      const newMeasurement = {
        data: {
          reference: form.reference,
          survey_type: form.survey_type,
          location: form.location,
          surveyor: form.surveyor,
          survey_date: form.survey_date,
          total_area: parseFloat(form.total_area) || 0,
          unit: form.unit,
          notes: form.notes,
        },
      };
      await createMutation.mutateAsync(newMeasurement);
      toast.success('Measurement created successfully');
      setShowCreateModal(false);
      setForm({ reference: '', item_no: '', survey_type: 'General', location: '', surveyor: '', survey_date: '', total_area: '', unit: 'm²', section: 'Fit-Out', quantity: '', rate: '', description: '', notes: '' });
    } catch (err) {
      toast.error(`Failed to create: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) {
      toast.error('No item selected for update');
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          reference: editItem.reference,
          survey_type: editItem.survey_type,
          location: editItem.location,
          surveyor: editItem.surveyor,
          survey_date: editItem.survey_date,
          total_area: editItem.total_area,
          unit: editItem.unit,
          notes: editItem.notes,
        },
      });
      toast.success('Measurement updated successfully');
      setEditItem(null);
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this measurement?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Measurement deleted successfully');
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  async function _handleUploadDoc(id: string, file: File) {
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

  const exportToCSV = () => {
    const headers = ['Item No', 'Description', 'Unit', 'Quantity', 'Rate (£)', 'Total (£)', 'Section'];
    const rows = measurements.map(m => [
      m.item_no || '',
      m.description || '',
      m.unit || '',
      m.quantity || '',
      m.rate || '',
      (m.quantity || 0) * (m.rate || 0),
      m.section || '',
    ]);


    const csv = [
      headers.join(','),
      ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(',')),
      '',
      ['GRAND TOTAL', '', '', '', '', totals.grandTotal.toFixed(2), ''].map(cell => `"${cell}"`).join(','),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="measuring" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">Measurement & Quantities</h2>
            <p className="text-gray-400 text-sm mt-1">Manage take-offs, bills of quantities and valuations</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Items</p>
                <p className="text-2xl font-display text-white">{totals.totalItems}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Measurement %</p>
                <p className="text-2xl font-display text-green-400">{totals.measurementPercentage}%</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Ruler className="text-orange-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">BQ Total (£)</p>
                <p className="text-2xl font-display text-orange-400">£{(totals.costPlanTotal / 1000).toFixed(0)}k</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Take-Off Total (£)</p>
                <p className="text-2xl font-display text-purple-400">£{(totals.grandTotal / 1000).toFixed(0)}k</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="card border-b border-gray-700">
          <div className="flex gap-0">
            {[
              { id: 'takeoff' as const, label: 'Take-Off', icon: Ruler },
              { id: 'bq' as const, label: 'Bill of Quantities', icon: Layers },
              { id: 'valuations' as const, label: 'Valuations', icon: TrendingUp },
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

        {/* TAKE-OFF TAB */}
        {activeTab === 'takeoff' && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  placeholder="Search measurements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 input input-bordered text-white"
                />
                <button
                  onClick={exportToCSV}
                  className="ml-3 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium text-sm flex items-center gap-2"
                >
                  Export CSV
                </button>
              </div>

              {filtered.length === 0 ? (
                <EmptyState title="No measurements found" />
              ) : (
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Item No</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Description</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">Unit</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Quantity</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Rate (£)</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Total (£)</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m: Measurement) => (
                        <tr key={m.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                          <td className="py-3 px-4 text-white font-medium">{m.item_no}</td>
                          <td className="py-3 px-4 text-gray-300">{m.description}</td>
                          <td className="py-3 px-4 text-center text-gray-400">{m.unit}</td>
                          <td className="py-3 px-4 text-right text-white font-medium">{(m.quantity || 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-white">{(m.rate || 0).toFixed(2)}</td>
<td className="py-3 px-4 text-right font-mono text-white">
                            £{((m.quantity || 0) * (m.rate || 0)).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => setEditItem(m)} className="p-1 hover:bg-blue-900/30 rounded">
                                <Pencil size={14} className="text-blue-400" />
                              </button>
                              <button onClick={() => handleDelete(String(m.id))} className="p-1 hover:bg-red-900/30 rounded">
                                <Trash2 size={14} className="text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-600 bg-gray-800/50 font-display">
                        <td colSpan={5} className="py-3 px-4 text-right text-white">
                          TOTAL
                        </td>
                        <td className="py-3 px-4 text-right text-orange-400 text-lg">£{totals.grandTotal.toFixed(2)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BILL OF QUANTITIES TAB */}
        {activeTab === 'bq' && (
          <div className="space-y-4">
            <div className="card p-6">
              <h3 className="text-lg font-display text-white mb-4">Measurement Summary</h3>
              <div className="cb-table-scroll touch-pan-x mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Reference</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Location</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Unit</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Total Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m: Measurement) => (
                      <tr key={m.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                        <td className="py-3 px-4 text-gray-300 text-xs">{m.reference}</td>
                        <td className="py-3 px-4 text-gray-300">{m.location}</td>
                        <td className="py-3 px-4 text-center text-gray-400">{m.unit}</td>
                        <td className="py-3 px-4 text-right font-mono text-white">
                          {(m.total_area || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-600 bg-gray-800/30">
                      <td colSpan={3} className="py-3 px-4 text-right font-display text-gray-300">
                        Grand Total Area:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">{totals.grandTotal.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30">
              <div className="text-right">
                <p className="text-gray-400 mb-2">Total Measured Area</p>
                <p className="text-4xl font-display text-orange-400">{totals.grandTotal.toLocaleString()} {filtered[0]?.unit || 'units'}</p>
              </div>
            </div>
          </div>
        )}

        {/* VALUATIONS TAB */}
        {activeTab === 'valuations' && (
          <div className="space-y-4">
            <div className="card p-6">
              <EmptyState
                title="Monthly Valuations"
                description="Valuation data will appear here once payment certificates are recorded."
              />
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-blue-500/10 border border-blue-500/30">
                <p className="text-blue-400 text-sm font-medium mb-2">Total Items</p>
                <p className="text-3xl font-display text-blue-400">{totals.totalItems}</p>
              </div>
              <div className="card p-4 bg-green-500/10 border border-green-500/30">
                <p className="text-green-400 text-sm font-medium mb-2">Measurement Progress</p>
                <p className="text-3xl font-display text-green-400">{totals.measurementPercentage}%</p>
              </div>
              <div className="card p-4 bg-orange-500/10 border border-orange-500/30">
                <p className="text-orange-400 text-sm font-medium mb-2">Take-Off Total</p>
                <p className="text-2xl font-display text-orange-400">£{(totals.grandTotal / 1000).toFixed(0)}k</p>
              </div>
              <div className="card p-4 bg-purple-500/10 border border-purple-500/30">
                <p className="text-purple-400 text-sm font-medium mb-2">Variance</p>
                <p className="text-2xl font-display text-purple-400">
                  {totals.costPlanTotal !== totals.grandTotal
                    ? `£${Math.abs(totals.grandTotal - totals.costPlanTotal).toLocaleString()}`
                    : 'On Target'}
                </p>
              </div>
            </div>

            {/* Measurement by Section */}
            <div className="card p-6">
              <h3 className="text-lg font-display text-white mb-4">Area Distribution</h3>
              <div className="space-y-4">
                {sections.map(section => {
                  const sectionTotal = section.items.reduce((sum, m) => sum + (m.total_area || 0), 0);
                  const percentage = (sectionTotal / totals.grandTotal) * 100;
                  return (
                    <div key={section.name}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 font-medium">{section.name}</span>
                        <span className="text-white font-mono">{sectionTotal.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost Plan vs Take-Off Comparison */}
            <div className="card p-6">
              <h3 className="text-lg font-display text-white mb-4">Take-Off vs Target Comparison</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Target Area</span>
                    <span className="text-white font-mono">{totals.costPlanTotal.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Measured Area</span>
                    <span className="text-white font-mono">{totals.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${totals.costPlanTotal > 0 ? (totals.grandTotal / totals.costPlanTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                {totals.costPlanTotal !== totals.grandTotal && (
                  <div className={`p-3 rounded text-sm font-medium ${totals.grandTotal < totals.costPlanTotal ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {totals.grandTotal < totals.costPlanTotal ? '✓' : '⚠'} Variance:
                    {Math.abs(totals.grandTotal - totals.costPlanTotal).toLocaleString()}
                    {totals.grandTotal < totals.costPlanTotal ? ' under target' : ' over target'}
                  </div>
                )}
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
              <h3 className="text-xl font-bold text-white">{editItem ? 'Edit Measurement' : 'Add Measurement Item'}</h3>
              <button type="button" onClick={() => { setShowCreateModal(false); setEditItem(null); }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="itemNo" className="block text-gray-400 text-xs mb-1">
                  Item Number
                </label>
                <input
                  id="itemNo"
                  type="text"
                  value={editItem ? editItem.item_no || '' : form.item_no}
                  onChange={(e) => {
                    if (editItem) {
                      setEditItem({ ...editItem, item_no: e.target.value });
                    } else {
                      setForm({ ...form, item_no: e.target.value });
                    }
                  }}
                  placeholder="e.g. ITEM-001"
                  className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-gray-400 text-xs mb-1">
                  Description *
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
                  placeholder="Item description"
                  className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="unit" className="block text-gray-400 text-xs mb-1">
                    Unit
                  </label>
                  <select
                    id="unit"
                    value={editItem ? editItem.unit || 'm²' : form.unit}
                    onChange={(e) => {
                      if (editItem) {
                        setEditItem({ ...editItem, unit: e.target.value });
                      } else {
                        setForm({ ...form, unit: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 input input-bordered text-white"
                  >
                    <option value="m²">m²</option>
                    <option value="m³">m³</option>
                    <option value="m">m</option>
                    <option value="nr">nr</option>
                    <option value="tonne">tonne</option>
                    <option value="sum">sum</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="quantity" className="block text-gray-400 text-xs mb-1">
                    Quantity
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={editItem ? editItem.quantity || '' : form.quantity}
                    onChange={(e) => {
                      if (editItem) {
                        setEditItem({ ...editItem, quantity: parseFloat(e.target.value) || 0 });
                      } else {
                        setForm({ ...form, quantity: e.target.value });
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>

                <div>
                  <label htmlFor="rate" className="block text-gray-400 text-xs mb-1">
                    Rate (£)
                  </label>
                  <input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={editItem ? editItem.rate || '' : form.rate}
                    onChange={(e) => {
                      if (editItem) {
                        setEditItem({ ...editItem, rate: parseFloat(e.target.value) || 0 });
                      } else {
                        setForm({ ...form, rate: e.target.value });
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="section" className="block text-gray-400 text-xs mb-1">
                  Section
                </label>
                <select
                  id="section"
                  value={editItem ? editItem.section || 'Fit-Out' : form.section}
                  onChange={(e) => {
                    if (editItem) {
                      setEditItem({ ...editItem, section: e.target.value });
                    } else {
                      setForm({ ...form, section: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 input input-bordered text-white"
                >
                  <option value="Preliminaries">Preliminaries</option>
                  <option value="Substructure">Substructure</option>
                  <option value="Frame">Frame</option>
                  <option value="Envelope">Envelope</option>
                  <option value="M&E">M&E</option>
                  <option value="Fit-Out">Fit-Out</option>
                </select>
              </div>

              {(editItem || form.quantity) && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                  <p className="text-blue-400 text-sm font-medium">
                    Total: £
                    {(
                      editItem
                        ? (editItem?.quantity !== null && editItem?.quantity !== undefined ? Number(editItem?.quantity) : 0) * (editItem?.rate !== null && editItem?.rate !== undefined ? Number(editItem?.rate) : 0)
                        : (form.quantity !== null && form.quantity !== undefined ? parseFloat(form.quantity) : 0) * (form.rate !== null && form.rate !== undefined ? parseFloat(form.rate) : 0)
                    ).toFixed(2)}
                  </p>
                </div>
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
                disabled={editItem ? updateMutation.isPending : createMutation.isPending}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {editItem ? (updateMutation.isPending ? 'Saving...' : 'Save') : createMutation.isPending ? 'Creating...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
