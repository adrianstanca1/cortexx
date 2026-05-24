import { useState } from 'react';
import {
  Plus, Leaf, Recycle, Trash2, X, Edit, BarChart3, CheckCircle,
  AlertCircle, FileText, Download, Send, Award, TrendingUp, PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import type { Row } from '../../services/api';
import { uploadFile } from '../../services/api';
import { toast } from 'sonner';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { useWasteManagement } from '../../hooks/useData';

interface WasteLog {
  id: string | number;
  waste_type: string;
  quantity: number;
  unit: string;
  carrier: string;
  collection_date: string | null;
  recycling_rate: number;
  status: string;
  cost: number;
  disposal_method: string;
  project?: string;
  project_id?: string;
  notes?: string;
}

// Mock data
const recyclingTargetsData = [
  { material: 'Concrete', target: 95, actual: 92 },
  { material: 'Timber', target: 90, actual: 88 },
  { material: 'Metal', target: 98, actual: 96 },
  { material: 'Plasterboard', target: 85, actual: 80 },
  { material: 'Soil/Rock', target: 92, actual: 90 },
];

const _wasteLogsData = [
  { id: 1, date: '2026-04-05', type: 'Concrete', volume: 12.5, method: 'Recycling', carrier: 'UK Waste Solutions', cost: 450 },
  { id: 2, date: '2026-04-04', type: 'Timber', volume: 8.2, method: 'Recycling', carrier: 'Green Disposal Ltd', cost: 280 },
  { id: 3, date: '2026-04-03', type: 'Metal', volume: 3.5, method: 'Recycling', carrier: 'Metal Recovery UK', cost: 320 },
  { id: 4, date: '2026-04-02', type: 'Soil', volume: 45.0, method: 'Reuse', carrier: 'Site Services Inc', cost: 150 },
  { id: 5, date: '2026-04-01', type: 'Plasterboard', volume: 6.8, method: 'Recycling', carrier: 'Gypsum Recyclers', cost: 210 },
  { id: 6, date: '2026-03-31', type: 'Mixed Construction', volume: 9.3, method: 'Landfill', carrier: 'Eco Disposal', cost: 380 },
  { id: 7, date: '2026-03-30', type: 'Plastic', volume: 2.1, method: 'Recycling', carrier: 'Plastic Recovery', cost: 95 },
  { id: 8, date: '2026-03-29', type: 'Concrete', volume: 11.0, method: 'Recycling', carrier: 'UK Waste Solutions', cost: 420 },
  { id: 9, date: '2026-03-28', type: 'Hazardous', volume: 0.5, method: 'Special Handling', carrier: 'Hazmat Specialists', cost: 890 },
  { id: 10, date: '2026-03-27', type: 'Timber', volume: 7.5, method: 'Recycling', carrier: 'Green Disposal Ltd', cost: 260 },
];

const manifestsData = [
  { id: 'WM-2026-0845', date: '2026-04-05', type: 'Concrete', qty: 12.5, carrier: 'UK Waste Solutions (Lic: WEE001234)', consignee: 'London Recycling Centre', status: 'completed' },
  { id: 'WM-2026-0844', date: '2026-04-03', type: 'Timber', qty: 8.2, carrier: 'Green Disposal Ltd (Lic: WEE005678)', consignee: 'Birmingham Timber Plant', status: 'completed' },
  { id: 'WM-2026-0843', date: '2026-04-01', type: 'Metal', qty: 3.5, carrier: 'Metal Recovery UK (Lic: WEE009012)', consignee: 'Sheffield Foundry', status: 'pending' },
  { id: 'WM-2026-0842', date: '2026-03-29', type: 'Plasterboard', qty: 6.8, carrier: 'Gypsum Recyclers (Lic: WEE003456)', consignee: 'Manchester Gypsum Facility', status: 'rejected' },
  { id: 'WM-2026-0841', date: '2026-03-27', type: 'Mixed Construction', qty: 9.3, carrier: 'Eco Disposal (Lic: WEE007890)', consignee: 'Leeds Transfer Station', status: 'completed' },
];

const complianceData = [
  { item: 'Duty of Care Checklist', status: 'complete', daysLeft: null },
  { item: 'Waste Carrier License Validation', status: 'complete', daysLeft: null },
  { item: 'Site Waste Management Plan (SWMP)', status: 'complete', daysLeft: null },
  { item: 'Environmental Permit', status: 'complete', daysLeft: 45 },
  { item: 'Next Waste Audit', status: 'pending', daysLeft: 30 },
  { item: 'Quarterly Compliance Report', status: 'pending', daysLeft: 15 },
];

const wasteSuppliersData = [
  { id: 1, name: 'UK Waste Solutions', licenseNo: 'WEE001234', expiryDate: '2026-07-15', wasteTypes: 'Concrete, Mixed Construction', status: 'Active', daysExpiring: -100 },
  { id: 2, name: 'Green Disposal Ltd', licenseNo: 'WEE005678', expiryDate: '2026-05-20', wasteTypes: 'Timber, General Waste', status: 'Active', daysExpiring: 23 },
  { id: 3, name: 'Metal Recovery UK', licenseNo: 'WEE009012', expiryDate: '2026-04-30', wasteTypes: 'Metal, Non-ferrous', status: 'Active', daysExpiring: 3 },
  { id: 4, name: 'Gypsum Recyclers', licenseNo: 'WEE003456', expiryDate: '2026-03-10', wasteTypes: 'Plasterboard, Gypsum', status: 'Expired', daysExpiring: null },
  { id: 5, name: 'Eco Disposal', licenseNo: 'WEE007890', expiryDate: '2026-09-05', wasteTypes: 'Mixed Waste, Landfill', status: 'Active', daysExpiring: -100 },
  { id: 6, name: 'Plastic Recovery', licenseNo: 'WEE002468', expiryDate: '2026-05-01', wasteTypes: 'Plastic, PVC', status: 'Pending Renewal', daysExpiring: 4 },
];

const reportingData = [
  { id: 'RPT-2026-Q1', period: 'Q1 2026', submittedDate: '2026-04-10', status: 'Submitted', refNo: 'EA-Q1-2026-001', totalWaste: 156.2, recyclingRate: 92 },
  { id: 'RPT-2025-Q4', period: 'Q4 2025', submittedDate: '2026-01-05', status: 'Submitted', refNo: 'EA-Q4-2025-038', totalWaste: 142.8, recyclingRate: 89 },
  { id: 'RPT-2025-Q3', period: 'Q3 2025', submittedDate: '2025-10-08', status: 'Submitted', refNo: 'EA-Q3-2025-045', totalWaste: 168.5, recyclingRate: 88 },
  { id: 'RPT-2025-Q2', period: 'Q2 2025', submittedDate: '2025-07-12', status: 'Submitted', refNo: 'EA-Q2-2025-052', totalWaste: 134.9, recyclingRate: 91 },
  { id: 'RPT-2025-Q1', period: 'Q1 2025', submittedDate: '2025-04-09', status: 'Submitted', refNo: 'EA-Q1-2025-061', totalWaste: 145.3, recyclingRate: 87 },
  { id: 'RPT-2024-Q4', period: 'Q4 2024', submittedDate: '2025-01-08', status: 'Submitted', refNo: 'EA-Q4-2024-078', totalWaste: 159.1, recyclingRate: 90 },
];

const wasteByTypeData = [
  { material: 'Concrete', '2026': 45, '2025': 38, '2024': 35 },
  { material: 'Timber', '2026': 28, '2025': 32, '2024': 29 },
  { material: 'Metal', '2026': 12, '2025': 14, '2024': 11 },
  { material: 'Plasterboard', '2026': 18, '2025': 16, '2024': 19 },
  { material: 'Soil/Rock', '2026': 35, '2025': 40, '2024': 42 },
];

const recyclingTrendData = [
  { month: 'Apr 2025', rate: 85 },
  { month: 'May 2025', rate: 87 },
  { month: 'Jun 2025', rate: 89 },
  { month: 'Jul 2025', rate: 88 },
  { month: 'Aug 2025', rate: 90 },
  { month: 'Sep 2025', rate: 89 },
  { month: 'Oct 2025', rate: 91 },
  { month: 'Nov 2025', rate: 92 },
  { month: 'Dec 2025', rate: 90 },
  { month: 'Jan 2026', rate: 93 },
  { month: 'Feb 2026', rate: 92 },
  { month: 'Mar 2026', rate: 92 },
];

const wasteDestinationData = [
  { name: 'Recycled', value: 92, fill: '#10b981' },
  { name: 'Landfill', value: 5, fill: '#ef4444' },
  { name: 'Energy Recovery', value: 2, fill: '#f59e0b' },
  { name: 'Reuse', value: 1, fill: '#3b82f6' },
];

export default function WasteManagement() {
  const { data: waste = [], isLoading } = useWasteManagement.useList() as { data: WasteLog[], isLoading: boolean };
  const createMutation = useWasteManagement.useCreate();
  const updateMutation = useWasteManagement.useUpdate();
  const deleteMutation = useWasteManagement.useDelete();

  const [activeTab, setActiveTab] = useState('logs');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [_uploading, setUploading] = useState<string | null>(null);
  const [form, setForm] = useState({ wasteType: '', quantity: '', unit: 'tonnes', carrier: '', collectionDate: '', recyclingRate: '75', status: 'pending', disposalMethod: 'Recycling', cost: '' });
  const [manifestForm, setManifestForm] = useState({ wasteType: '', quantity: '', carrier: '', carrierLicense: '', consignee: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', licenseNo: '', expiryDate: '', wasteTypes: '' });
  const [reportingPeriod, setReportingPeriod] = useState('quarterly');
  const [editItem, setEditItem] = useState<Row | null>(null);

  const filtered = waste.filter((w) =>
    (w.waste_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.project || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRecycling = waste.reduce((acc: number, w) => {
    const qty = w.quantity !== null && w.quantity !== undefined ? Number(w.quantity) : 0;
    const actualRecycled = w.recycling_rate !== null && w.recycling_rate !== undefined ? Number(w.recycling_rate) : (w.status === 'collected' ? 75 : 0);
    return acc + (actualRecycled * qty / 100);
  }, 0);
  const totalWaste = waste.reduce((acc: number, w) => acc + Number(w.quantity || 0), 0);
  const recyclingRate = totalWaste > 0 ? Math.round(totalRecycling / totalWaste * 100) : 0;
  const totalCost = waste.reduce((acc: number, w) => acc + (w.cost !== null && w.cost !== undefined ? Number(w.cost) : 0), 0);

  const handleCreate = async () => {
    if (!form.wasteType) return;
    try {
      await createMutation.mutateAsync({
        waste_type: form.wasteType,
        project: '',
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        carrier: form.carrier || '',
        collection_date: form.collectionDate || null,
        recycling_rate: parseInt(form.recyclingRate) || 0,
        status: form.status,
        cost: parseFloat(form.cost) || 0,
        disposal_method: form.disposalMethod,
      });
      setShowCreateModal(false);
      setForm({ wasteType: '', quantity: '', unit: 'tonnes', carrier: '', collectionDate: '', recyclingRate: '75', status: 'pending', disposalMethod: 'Recycling', cost: '' });
      toast.success('Waste log created');
    } catch {
      toast.error('Failed to create waste record');
    }
  };

  const _handleUpdate = async () => {
    if (!editItem || !editItem.id) return;
    try {
      await updateMutation.mutateAsync({
        id: String(editItem.id),
        data: editItem as unknown as Record<string, unknown>,
      });
      setEditItem(null);
      toast.success('Waste record updated');
    } catch {
      toast.error('Failed to update waste record');
    }
  };

  const _handleDelete = async (id: string) => {
    if (!confirm('Delete this waste record?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Waste record deleted');
    } catch {
      toast.error('Failed to delete waste record');
    }
  };

  async function _handleUploadDoc(id: string, file: File) {
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

  const handleCreateManifest = async () => {
    if (!manifestForm.wasteType) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      toast.success('Waste transfer manifest created');
      setShowManifestModal(false);
      setManifestForm({ wasteType: '', quantity: '', carrier: '', carrierLicense: '', consignee: '' });
    } catch {
      toast.error('Failed to create manifest');
    }
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="waste-management" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">Waste Management</h2>
            <p className="text-gray-400 text-sm mt-1">Track site waste, recycling and environmental compliance</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'logs' && (
              <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                <Plus size={18} /> Log Waste
              </button>
            )}
            {activeTab === 'manifests' && (
              <button type="button" onClick={() => setShowManifestModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                <Plus size={18} /> Create Manifest
              </button>
            )}
            {activeTab === 'suppliers' && (
              <button type="button" onClick={() => setShowSupplierModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                <Plus size={18} /> Add Supplier
              </button>
            )}
            {activeTab === 'reporting' && (
              <div className="flex gap-2">
                <button type="button" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
                  <Download size={18} /> Export PDF
                </button>
                <button type="button" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">
                  <Send size={18} /> Submit to EA
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Recycle className="text-emerald-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Recycled</p>
                <p className="text-2xl font-display text-emerald-400">{isLoading ? '...' : `${totalRecycling.toFixed(1)}t`}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Trash2 className="text-amber-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Waste</p>
                <p className="text-2xl font-display text-amber-400">{isLoading ? '...' : `${totalWaste.toFixed(1)}t`}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Leaf className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Recycling Rate</p>
                <p className="text-2xl font-display text-green-400">{isLoading ? '...' : `${recyclingRate}%`}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <BarChart3 className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-gray-400 text-xs">Total Cost (6w)</p>
                <p className="text-2xl font-display text-blue-400">{totalCost > 0 ? `£${totalCost.toLocaleString()}` : '£0'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex border-b border-gray-700 mb-6 gap-2">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'logs' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Waste Logs
            </button>
            <button
              onClick={() => setActiveTab('manifests')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'manifests' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Manifests
            </button>
            <button
              onClick={() => setActiveTab('recycling')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'recycling' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Recycling
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'compliance' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Compliance
            </button>
            <button
              onClick={() => setActiveTab('reporting')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'reporting' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Reporting
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'suppliers' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Suppliers
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-3 font-medium transition-colors ${activeTab === 'analytics' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-300'}`}
            >
              Analytics
            </button>
          </div>

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Search waste logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 input input-bordered text-white mb-4"
              />
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading waste data...</div>
              ) : (
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Date</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Waste Type</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-display tracking-widest">Volume (tonnes)</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Disposal Method</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Carrier</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-display tracking-widest">Cost</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-display tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((log) => (
                        <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                          <td className="py-3 px-4 font-mono text-gray-300">{String(log.collection_date)}</td>
                          <td className="py-3 px-4 text-white">{log.waste_type}</td>
                          <td className="py-3 px-4 text-right font-mono text-gray-300">{log.quantity}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.disposal_method === 'Recycling' ? 'bg-emerald-500/20 text-emerald-400' :
                              log.disposal_method === 'Reuse' ? 'bg-blue-500/20 text-blue-400' :
                              log.disposal_method === 'Special Handling' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {String(log.disposal_method)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{log.carrier}</td>
                          <td className="py-3 px-4 text-right font-mono text-amber-400">{log.cost !== null && log.cost !== undefined ? Number(log.cost) : 0}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button className="p-1 hover:bg-blue-900/30 rounded" title="Edit" onClick={() => setEditItem(log as unknown as Row)}><Edit size={14} className="text-blue-400" /></button>
                              <button className="p-1 hover:bg-red-900/30 rounded" title="Delete" onClick={() => _handleDelete(String(log.id))}><Trash2 size={14} className="text-red-400" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {filtered.length === 0 && !isLoading && (
                <EmptyState icon={Leaf} title="No waste logs found" description="Start tracking waste by creating a waste log." variant="default" />
              )}
            </div>
          )}

          {activeTab === 'manifests' && (
            <div className="space-y-4">
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Manifest No</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Waste Type</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-display tracking-widest">Quantity</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Carrier (License)</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Consignee</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Status</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-display tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifestsData.map((manifest) => (
                      <tr key={manifest.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                        <td className="py-3 px-4 font-mono text-orange-400 font-medium">{manifest.id}</td>
                        <td className="py-3 px-4 text-gray-300">{manifest.date}</td>
                        <td className="py-3 px-4 text-white">{manifest.type}</td>
                        <td className="py-3 px-4 text-right font-mono text-gray-300">{manifest.qty}t</td>
                        <td className="py-3 px-4 text-gray-300 text-xs">{manifest.carrier}</td>
                        <td className="py-3 px-4 text-gray-300">{manifest.consignee}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            manifest.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            manifest.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {manifest.status.charAt(0).toUpperCase() + manifest.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button className="p-1 hover:bg-blue-900/30 rounded inline-block" title="View"><FileText size={14} className="text-blue-400" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'recycling' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-display mb-4">Recycling Targets vs Actuals</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recyclingTargetsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="material" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="target" fill="#f97316" name="Target %" />
                    <Bar dataKey="actual" fill="#10b981" name="Actual %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-white font-display mb-4">Recycling Rate by Material Type</h3>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Material</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-display tracking-widest">Target</th>
                        <th className="text-right py-3 px-4 text-gray-400 font-display tracking-widest">Actual</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-display tracking-widest">Achievement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recyclingTargetsData.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                          <td className="py-3 px-4 text-white font-medium">{item.material}</td>
                          <td className="py-3 px-4 font-mono text-amber-400">{item.target}%</td>
                          <td className="py-3 px-4 font-mono text-emerald-400">{item.actual}%</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.actual >= item.target ? 'bg-emerald-500/20 text-emerald-400' :
                              item.actual >= item.target - 5 ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {item.actual >= item.target ? 'On Track' : 'Below Target'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-white font-display mb-4">Recycling Station Locations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { name: 'Main Site Depot', address: 'Zone A, North Compound', materials: 'All types' },
                    { name: 'Secondary Station', address: 'Zone B, South Entrance', materials: 'Concrete, Timber' },
                    { name: 'Hazmat Area', address: 'Secured Unit, Zone C', materials: 'Hazardous materials only' },
                    { name: 'Metal Skip Yard', address: 'Eastern Perimeter', materials: 'Ferrous, Non-ferrous metals' },
                  ].map((station, idx) => (
                    <div key={idx} className="border border-gray-700 rounded-lg p-3 bg-gray-800/30">
                      <p className="text-white font-medium">{station.name}</p>
                      <p className="text-gray-400 text-xs mt-1">{station.address}</p>
                      <p className="text-gray-500 text-xs mt-1">Materials: {station.materials}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reporting' && (
            <div className="space-y-6">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <h3 className="text-white font-display mb-4">Generate Report</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-2">Reporting Period</label>
                    <select value={reportingPeriod} onChange={(e) => setReportingPeriod(e.target.value)} className="w-full px-3 py-2 input input-bordered text-white">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button type="button" className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                      Preview Report
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button type="button" className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                      <Download size={16} /> Export PDF
                    </button>
                  </div>
                  <div className="flex items-end">
                    <button type="button" className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                      <Send size={16} /> Submit to EA
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Recycle className="text-emerald-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Total Waste (Q1)</p>
                      <p className="text-2xl font-display text-emerald-400">156.2t</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Leaf className="text-green-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Recycling Rate (Q1)</p>
                      <p className="text-2xl font-display text-green-400">92%</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Trash2 className="text-amber-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Landfill Diversion</p>
                      <p className="text-2xl font-display text-amber-400">95%</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Award className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">CO₂ Saved</p>
                      <p className="text-2xl font-display text-blue-400">45.3t</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-white font-display mb-4">Statutory Reports</h3>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Report</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Period</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Submitted</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Reference</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-display tracking-widest">Status</th>
                        <th className="text-center py-3 px-4 text-gray-400 font-display tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportingData.map((report) => (
                        <tr key={report.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                          <td className="py-3 px-4 font-mono text-orange-400 font-medium">{report.id}</td>
                          <td className="py-3 px-4 text-gray-300">{report.period}</td>
                          <td className="py-3 px-4 text-gray-300">{report.submittedDate}</td>
                          <td className="py-3 px-4 text-gray-300">{report.refNo}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              {report.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button className="p-1 hover:bg-blue-900/30 rounded inline-block" title="Download">
                              <Download size={14} className="text-blue-400" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-yellow-300 text-sm font-medium">2 suppliers have licenses expiring within 30 days</p>
              </div>
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Carrier Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">License No</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Expiry Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-display tracking-widest">Waste Types</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-display tracking-widest">Status</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-display tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wasteSuppliersData.map((supplier) => (
                      <tr key={supplier.id} className={`border-b border-gray-700/50 hover:bg-gray-800/30 ${supplier.status === 'Expired' ? 'bg-red-900/10' : ''}`}>
                        <td className="py-3 px-4 text-white font-medium">{supplier.name}</td>
                        <td className="py-3 px-4 text-gray-300 font-mono">{supplier.licenseNo}</td>
                        <td className="py-3 px-4 text-gray-300">
                          {supplier.status === 'Expired' ? (
                            <span className="text-red-400 font-medium">Expired</span>
                          ) : supplier.daysExpiring && supplier.daysExpiring <= 30 ? (
                            <div>
                              <p className="text-gray-300">{supplier.expiryDate}</p>
                              <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 mt-1 inline-block">
                                {supplier.daysExpiring} days
                              </span>
                            </div>
                          ) : (
                            <p className="text-gray-300">{supplier.expiryDate}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{supplier.wasteTypes}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            supplier.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' :
                            supplier.status === 'Expired' ? 'bg-red-500/20 text-red-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {supplier.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium">
                            Verify License
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Leaf className="text-green-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Recycling Rate</p>
                      <p className="text-2xl font-display text-green-400">92%</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Trash2 className="text-amber-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Total Waste (12m)</p>
                      <p className="text-2xl font-display text-amber-400">1,842t</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Award className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Cost Avoided vs Landfill</p>
                      <p className="text-2xl font-display text-blue-400">£28,450</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <TrendingUp className="text-cyan-400" size={20} />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Carbon Saved</p>
                      <p className="text-2xl font-display text-cyan-400">542kg CO₂e</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-white font-display mb-4">Waste by Type (Last 12 Months)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={wasteByTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="material" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="2024" fill="#6b7280" name="2024 (tonnes)" />
                    <Bar dataKey="2025" fill="#f97316" name="2025 (tonnes)" />
                    <Bar dataKey="2026" fill="#10b981" name="2026 (tonnes)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h3 className="text-white font-display mb-4">Recycling Rate Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={recyclingTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} name="Rate (%)" dot={{ fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="text-white font-display mb-4">Waste Destination Mix</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                      <Pie dataKey="value" data={wasteDestinationData} cx="50%" cy="50%" label={({ name }: { name?: string }) => String(name ?? "")}>
                        {wasteDestinationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card p-6">
                  <h3 className="text-white font-display mb-4">Benchmark vs Industry Average</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <p className="text-gray-300 text-sm">Your Recycling Rate</p>
                        <p className="text-green-400 font-medium">92%</p>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: '92%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <p className="text-gray-300 text-sm">Industry Average</p>
                        <p className="text-amber-400 font-medium">78%</p>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: '78%' }} />
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded">
                      <p className="text-emerald-300 text-sm font-medium">Above Average</p>
                      <p className="text-gray-400 text-xs mt-1">Your facility performs 14% better than industry benchmark</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-display mb-4">Duty of Care & Compliance Checklist</h3>
                <div className="space-y-2">
                  {complianceData.map((item, idx) => (
                    <div key={idx} className="border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.status === 'complete' ? (
                          <CheckCircle className="text-emerald-400" size={20} />
                        ) : (
                          <AlertCircle className="text-amber-400" size={20} />
                        )}
                        <div>
                          <p className="text-white font-medium">{item.item}</p>
                          {item.daysLeft && (
                            <p className="text-gray-400 text-xs mt-1">Renewal in {item.daysLeft} days</p>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded text-xs font-medium ${
                        item.status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {item.status === 'complete' ? 'Compliant' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
                  <h4 className="text-emerald-300 font-display mb-3">Carrier License Validation</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300 flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-400" /> All carriers verified (5/5)
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Last audit: 2026-03-15</p>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                  <h4 className="text-blue-300 font-display mb-3">Site Waste Management Plan</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300 flex items-center gap-2">
                      <CheckCircle size={16} className="text-blue-400" /> SWMP Current & Approved
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Valid until: 2026-12-31</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white font-display mb-4">Compliance Score</h3>
                <div className="bg-gray-800/50 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Overall Compliance</p>
                      <p className="text-5xl font-display text-emerald-400">94%</p>
                    </div>
                    <div className="w-32 h-32 rounded-full border-4 border-emerald-400 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-2xl font-display text-emerald-400">47/50</p>
                        <p className="text-xs text-gray-400 mt-1">Items</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
                <h4 className="text-amber-300 font-display mb-2">Upcoming Deadlines</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Environmental Permit Renewal - 30 days remaining</li>
                  <li>• Quarterly Waste Audit - Due 2026-04-15</li>
                  <li>• Carrier License Updates - 3 carriers due for renewal in Q3</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <h3 className="text-xl font-display text-white">Log Waste</h3>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="wmType" className="block text-gray-400 text-xs mb-1">Waste Type *</label>
                  <select id="wmType" value={form.wasteType} onChange={e => setForm(f => ({ ...f, wasteType: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="">Select type...</option>
                    <option value="Soil">Soil</option>
                    <option value="Concrete">Concrete</option>
                    <option value="Timber">Timber</option>
                    <option value="Metal">Metal</option>
                    <option value="Plastic">Plastic</option>
                    <option value="Plasterboard">Plasterboard</option>
                    <option value="Mixed Construction">Mixed Construction</option>
                    <option value="Hazardous">Hazardous</option>
                    <option value="General Waste">General Waste</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="wmQty" className="block text-gray-400 text-xs mb-1">Volume (tonnes)</label>
                    <input id="wmQty" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                  <div>
                    <label htmlFor="wmUnit" className="block text-gray-400 text-xs mb-1">Unit</label>
                    <select id="wmUnit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                      <option value="tonnes">Tonnes</option>
                      <option value="kg">Kilograms</option>
                      <option value="m3">Cubic Metres</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="wmMethod" className="block text-gray-400 text-xs mb-1">Disposal Method</label>
                  <select id="wmMethod" value={form.disposalMethod} onChange={e => setForm(f => ({ ...f, disposalMethod: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="Recycling">Recycling</option>
                    <option value="Reuse">Reuse</option>
                    <option value="Landfill">Landfill</option>
                    <option value="Special Handling">Special Handling</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="wmCarrier" className="block text-gray-400 text-xs mb-1">Waste Carrier</label>
                  <input id="wmCarrier" type="text" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} placeholder="Carrier company name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="wmDate" className="block text-gray-400 text-xs mb-1">Collection Date</label>
                    <input id="wmDate" type="date" value={form.collectionDate} onChange={e => setForm(f => ({ ...f, collectionDate: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                  </div>
                  <div>
                    <label htmlFor="wmCost" className="block text-gray-400 text-xs mb-1">Cost (£)</label>
                    <input id="wmCost" type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                </div>
                <div>
                  <label htmlFor="wmStatus" className="block text-gray-400 text-xs mb-1">Status</label>
                  <select id="wmStatus" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="pending">Pending Collection</option>
                    <option value="collected">Collected</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="button" onClick={handleCreate} disabled={createMutation.isPending || !form.wasteType} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                  {createMutation.isPending ? 'Creating...' : 'Log Waste'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showManifestModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-display text-white">Create Waste Transfer Manifest</h3>
                <button type="button" onClick={() => setShowManifestModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="manifType" className="block text-gray-400 text-xs mb-1">Waste Type *</label>
                  <select id="manifType" value={manifestForm.wasteType} onChange={e => setManifestForm(f => ({ ...f, wasteType: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="">Select type...</option>
                    <option value="Soil">Soil</option>
                    <option value="Concrete">Concrete</option>
                    <option value="Timber">Timber</option>
                    <option value="Metal">Metal</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="manifQty" className="block text-gray-400 text-xs mb-1">Quantity (tonnes)</label>
                  <input id="manifQty" type="number" value={manifestForm.quantity} onChange={e => setManifestForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="manifCarrier" className="block text-gray-400 text-xs mb-1">Carrier Company *</label>
                  <input id="manifCarrier" type="text" value={manifestForm.carrier} onChange={e => setManifestForm(f => ({ ...f, carrier: e.target.value }))} placeholder="Carrier name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="manifLicense" className="block text-gray-400 text-xs mb-1">Carrier License No *</label>
                  <input id="manifLicense" type="text" value={manifestForm.carrierLicense} onChange={e => setManifestForm(f => ({ ...f, carrierLicense: e.target.value }))} placeholder="e.g. WEE001234" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="manifConsignee" className="block text-gray-400 text-xs mb-1">Disposal Site/Consignee *</label>
                  <input id="manifConsignee" type="text" value={manifestForm.consignee} onChange={e => setManifestForm(f => ({ ...f, consignee: e.target.value }))} placeholder="Facility name & location" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button type="button" onClick={() => setShowManifestModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="button" onClick={handleCreateManifest} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                  Create Manifest
                </button>
              </div>
            </div>
          </div>
        )}

        {showSupplierModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-display text-white">Add Waste Carrier/Supplier</h3>
                <button type="button" onClick={() => setShowSupplierModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="suppName" className="block text-gray-400 text-xs mb-1">Carrier Name *</label>
                  <input id="suppName" type="text" value={supplierForm.name} onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="suppLicense" className="block text-gray-400 text-xs mb-1">License Number *</label>
                  <input id="suppLicense" type="text" value={supplierForm.licenseNo} onChange={e => setSupplierForm(f => ({ ...f, licenseNo: e.target.value }))} placeholder="e.g. WEE001234" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label htmlFor="suppExpiry" className="block text-gray-400 text-xs mb-1">License Expiry Date *</label>
                  <input id="suppExpiry" type="date" value={supplierForm.expiryDate} onChange={e => setSupplierForm(f => ({ ...f, expiryDate: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
                <div>
                  <label htmlFor="suppTypes" className="block text-gray-400 text-xs mb-1">Waste Types Handled</label>
                  <input id="suppTypes" type="text" value={supplierForm.wasteTypes} onChange={e => setSupplierForm(f => ({ ...f, wasteTypes: e.target.value }))} placeholder="e.g. Concrete, Metal" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="button" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                  Add Supplier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
