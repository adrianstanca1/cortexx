import { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Eye,
  Edit,
  Trash2,
  X,
  CheckSquare,
  Square,
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Send,
  CheckCheck,
  AlertTriangle,
  GitBranch,
  Link2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from 'recharts';
import { useVariations } from '../../hooks/useData';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type MainTab = 'overview' | 'analytics' | 'approval' | 'budget' | 'contract';

interface Variation {
  id: string;
  ref: string;
  title: string;
  project: string;
  subcontractor: string;
  status: 'draft' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'executed';
  type: 'addition' | 'deletion' | 'omission' | 'remeasurement' | 'provisional';
  value: number;
  originalValue: number;
  impact: 'increase' | 'decrease' | 'neutral';
  submittedDate: string;
  respondedDate?: string;
  description: string;
  reason: string;
  affectedItems: string[];
  approvalChain: { name: string; role: string; status: 'pending' | 'approved' | 'rejected'; date?: string }[];
  documents: { name: string; type: string; url: string }[];
}

interface ApprovalRecord {
  id: string;
  variationRef: string;
  approver: string;
  status: 'approved' | 'rejected' | 'pending';
  date: string;
  comment?: string;
}

interface VCIRecord {
  id: string;
  vciNumber: string;
  variationRef: string;
  drawingRef?: string;
  specRevision?: string;
  status: 'draft' | 'issued' | 'implemented';
  date: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: FileText },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: AlertCircle },
  approved: { label: 'Approved', color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  executed: { label: 'Executed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: FileCheck },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  addition: { label: 'Addition', color: 'text-green-400' },
  deletion: { label: 'Deletion', color: 'text-red-400' },
  omission: { label: 'Omission', color: 'text-gray-400' },
  remeasurement: { label: 'Remeasurement', color: 'text-blue-400' },
  provisional: { label: 'Provisional Sum', color: 'text-amber-400' },
};

export default function Variations() {
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [_selectedVar, setSelectedVar] = useState<Variation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedCards, setExpandedCards] = useState<string[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedVariationForApproval, setSelectedVariationForApproval] = useState<Variation | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');

  interface EditFormState extends Omit<Variation, 'value' | 'originalValue'> {
    value: string;
    originalValue: string;
  }
  const [editItem, setEditItem] = useState<EditFormState | null>(null);
  const [form, setForm] = useState({
    title: '',
    project: '',
    subcontractor: '',
    type: 'addition',
    value: '',
    reason: '',
    description: '',
  });

  const { useList, useCreate, useUpdate, useDelete } = useVariations;
  const { data: rawVariations = [], isLoading } = useList();
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const variations = rawVariations as unknown as Variation[];

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(String(id))));
      toast.success(`Deleted ${ids.length} variation(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const handleCreate = async () => {
    if (!form.title || !form.project) return;
    try {
      await createMutation.mutateAsync({
        ref: `VAR-${String(Date.now()).slice(-6)}`,
        title: form.title,
        project: form.project,
        subcontractor: form.subcontractor,
        type: form.type,
        value: parseFloat(form.value) || 0,
        original_value: parseFloat(form.value) || 0,
        status: 'draft',
        impact: parseFloat(form.value) > 0 ? 'increase' : parseFloat(form.value) < 0 ? 'decrease' : 'neutral',
        description: form.description,
        reason: form.reason,
      });
      toast.success('Variation created');
      setShowCreateModal(false);
      setForm({
        title: '',
        project: '',
        subcontractor: '',
        type: 'addition',
        value: '',
        reason: '',
        description: '',
      });
    } catch {
      toast.error('Failed to create variation');
    }
  };

  const filteredVariations = variations.filter((v: Variation) => {
    const matchesSearch =
      (v.ref || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.project || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchesType = filterType === 'all' || v.type === filterType;
    const matchesImpact = filterImpact === 'all' || v.impact === filterImpact;
    return matchesSearch && matchesStatus && matchesType && matchesImpact;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this variation?')) return;
    try {
      await deleteMutation.mutateAsync(String(id));
      toast.success('Variation deleted');
    } catch {
      toast.error('Failed to delete variation');
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.id) return;
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          ref: editItem.ref,
          title: editItem.title,
          project: editItem.project,
          subcontractor: editItem.subcontractor,
          type: editItem.type,
          status: editItem.status,
          value:
            typeof editItem.value === 'string'
              ? parseFloat(editItem.value) || 0
              : editItem.value || 0,
          original_value:
            typeof editItem.originalValue === 'string'
              ? parseFloat(editItem.originalValue) || 0
              : editItem.originalValue || 0,
          impact: editItem.impact,
          description: editItem.description,
          reason: editItem.reason,
          submitted_date: editItem.submittedDate,
        },
      });
      toast.success('Variation updated');
      setEditItem(null);
    } catch {
      toast.error('Failed to update variation');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalPending = variations
    .filter((v: Variation) => v.status === 'pending' || v.status === 'submitted')
    .reduce((sum: number, v: Variation) => sum + Number(v.value), 0);
  const totalApproved = variations
    .filter((v: Variation) => v.status === 'approved' || v.status === 'executed')
    .reduce((sum: number, v: Variation) => sum + Number(v.value), 0);
  const totalRejected = variations
    .filter((v: Variation) => v.status === 'rejected')
    .reduce((sum: number, v: Variation) => sum + Math.abs(Number(v.value)), 0);

  // Analytics data
  const costTrendData = [
    { month: 'Jan', value: 45000, forecast: 48000 },
    { month: 'Feb', value: 52000, forecast: 54000 },
    { month: 'Mar', value: 48000, forecast: 51000 },
    { month: 'Apr', value: 61000, forecast: 63000 },
  ];

  const typeDistributionData = [
    { name: 'Client Change', value: 340000, color: '#3B82F6' },
    { name: 'Design Error', value: 125000, color: '#EF4444' },
    { name: 'Unforeseen', value: 89000, color: '#F59E0B' },
    { name: 'Scope', value: 76000, color: '#10B981' },
  ];

  const budgetData = [
    { category: 'Original', value: 2500000 },
    { category: 'Current', value: 2630000 },
    { category: 'Forecast', value: 2680000 },
  ];

  const cashFlowData = [
    { week: 'W1', variation: 12000, cumulative: 12000 },
    { week: 'W2', variation: -8000, cumulative: 4000 },
    { week: 'W3', variation: 15000, cumulative: 19000 },
    { week: 'W4', variation: 22000, cumulative: 41000 },
  ];

  const variationsAwaitingApproval = variations.filter(
    (v: Variation) => v.status === 'pending' || v.status === 'submitted'
  );

  const approvalHistoryData: ApprovalRecord[] = [
    {
      id: '1',
      variationRef: 'VAR-001',
      approver: 'Sarah Johnson',
      status: 'approved',
      date: '2026-04-25',
      comment: 'Approved - site conditions verified',
    },
    {
      id: '2',
      variationRef: 'VAR-003',
      approver: 'Mike Chen',
      status: 'rejected',
      date: '2026-04-24',
      comment: 'Requires further documentation',
    },
  ];

  const vciRegisterData: VCIRecord[] = [
    {
      id: '1',
      vciNumber: 'VCI-2026-001',
      variationRef: 'VAR-001',
      drawingRef: 'DRG-A101',
      specRevision: 'Rev B',
      status: 'issued',
      date: '2026-04-23',
    },
    {
      id: '2',
      vciNumber: 'VCI-2026-002',
      variationRef: 'VAR-005',
      drawingRef: 'DRG-A205',
      status: 'draft',
      date: '2026-04-27',
    },
  ];

  return (
    <>
      <ModuleBreadcrumbs currentModule="variations" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">Variations Management</h2>
            <p className="text-gray-400 text-sm mt-1">
              Track and manage change orders, variations, and scope changes
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus size={18} />
            New Variation
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider">Pending Value</p>
                <p className="text-2xl font-display text-amber-400 mt-1">
                  £{totalPending.toLocaleString('en-GB')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="text-amber-400" size={20} />
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider">Approved Value</p>
                <p className="text-2xl font-display text-green-400 mt-1">
                  £{totalApproved.toLocaleString('en-GB')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="text-green-400" size={20} />
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider">Rejected Value</p>
                <p className="text-2xl font-display text-red-400 mt-1">
                  -£{totalRejected.toLocaleString('en-GB')}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="text-red-400" size={20} />
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider">Total Variations</p>
                <p className="text-2xl font-display text-white mt-1">
                  {isLoading ? '...' : variations.length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <FileText className="text-orange-400" size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="border-b border-gray-800 flex gap-1 bg-gray-900/50 rounded-t-lg overflow-x-auto">
          {[
            { key: 'overview' as MainTab, label: 'Overview', icon: FileText },
            { key: 'analytics' as MainTab, label: 'Analytics', icon: TrendingUp },
            { key: 'approval' as MainTab, label: 'Approvals', icon: CheckCircle },
            { key: 'budget' as MainTab, label: 'Budget', icon: DollarSign },
            { key: 'contract' as MainTab, label: 'Contract', icon: GitBranch },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap ${
                mainTab === tab.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {mainTab === 'overview' && (
          <div className="card p-4">
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search by ref, title, or project..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 input input-bordered text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="executed">Executed</option>
              </select>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="addition">Addition</option>
                <option value="deletion">Deletion</option>
                <option value="omission">Omission</option>
                <option value="remeasurement">Remeasurement</option>
                <option value="provisional">Provisional Sum</option>
              </select>
              <select
                value={filterImpact}
                onChange={e => setFilterImpact(e.target.value)}
                className="px-3 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="all">All Impacts</option>
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredVariations.map(variation => {
                const status = statusConfig[variation.status];
                const StatusIcon = status.icon;
                const isExpanded = expandedCards.includes(variation.id);
                const isPositive = variation.value > 0;
                const isSelected = selectedIds.has(String(variation.id));

                return (
                  <div
                    key={variation.id}
                    className={`border border-gray-700 rounded-lg overflow-hidden hover:border-orange-500/50 transition-colors ${
                      isSelected ? 'border-blue-500/50 bg-blue-900/10' : ''
                    }`}
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer bg-gray-800/50 hover:bg-gray-800"
                      onClick={() => {
                        setSelectedVar(variation);
                        setShowCreateModal(false);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleExpand(variation.id);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggle(String(variation.id));
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-blue-400" />
                          ) : (
                            <Square size={16} className="text-gray-500" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-orange-400">{variation.ref}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.color}`}>
                              <StatusIcon size={12} className="inline mr-1" />
                              {status.label}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                isPositive
                                  ? 'bg-green-500/10 text-green-400'
                                  : variation.value < 0
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-gray-500/10 text-gray-400'
                              }`}
                            >
                              {typeConfig[variation.type].label}
                            </span>
                          </div>
                          <p className="text-lg font-display text-white mt-1">{variation.title}</p>
                          <p className="text-gray-400 text-sm">{variation.project}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p
                            className={`text-lg font-display ${
                              isPositive
                                ? 'text-green-400'
                                : variation.value < 0
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}£{variation.value.toLocaleString('en-GB')}
                          </p>
                          <p className="text-gray-400 text-xs">Variation Value</p>
                        </div>
                        {isExpanded && (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button type="button" className="p-2 hover:bg-gray-700 rounded">
                              <Eye size={16} className="text-gray-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditItem({
                                  ...variation,
                                  ref: variation.ref || '',
                                  title: variation.title || '',
                                  project: variation.project || '',
                                  subcontractor: variation.subcontractor || '',
                                  status: variation.status,
                                  type: variation.type || '',
                                  value: String(variation.value || 0),
                                  originalValue: String(variation.originalValue ?? 0),
                                  impact: variation.impact || 'neutral',
                                  submittedDate: variation.submittedDate || '',
                                  description: variation.description || '',
                                  reason: variation.reason || '',
                                })
                              }
                              className="p-2 hover:bg-gray-700 rounded"
                            >
                              <Edit size={16} className="text-gray-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(String(variation.id))}
                              className="p-2 hover:bg-red-900/30 rounded"
                            >
                              <Trash2 size={16} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-gray-400 text-xs">Subcontractor</p>
                            <p className="text-white text-sm">{variation.subcontractor}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Submitted</p>
                            <p className="text-white text-sm">{variation.submittedDate}</p>
                          </div>
                          {variation.respondedDate && (
                            <div>
                              <p className="text-gray-400 text-xs">Responded</p>
                              <p className="text-white text-sm">{variation.respondedDate}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-gray-400 text-xs">Reason</p>
                            <p className="text-white text-sm">{variation.reason}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-gray-400 text-xs mb-1">Description</p>
                          <p className="text-gray-300 text-sm">{variation.description}</p>
                        </div>

                        <div className="mb-4">
                          <p className="text-gray-400 text-xs mb-2">Affected Items</p>
                          <div className="flex flex-wrap gap-2">
                            {(variation.affectedItems || []).map((item: string) => (
                              <span
                                key={item}
                                className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        {variation.approvalChain.length > 0 && (
                          <div>
                            <p className="text-gray-400 text-xs mb-2">Approval Chain</p>
                            <div className="space-y-2">
                              {(variation.approvalChain || []).map(
                                (approver: Variation['approvalChain'][0], idx: number) => (
                                  <div key={idx} className="flex items-center gap-3 text-sm">
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                        approver.status === 'approved'
                                          ? 'bg-green-500/20 text-green-400'
                                          : approver.status === 'rejected'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-gray-500/20 text-gray-400'
                                      }`}
                                    >
                                      {approver.status === 'approved' ? (
                                        <CheckCircle size={14} />
                                      ) : approver.status === 'rejected' ? (
                                        <XCircle size={14} />
                                      ) : (
                                        <Clock size={14} />
                                      )}
                                    </div>
                                    <span className="text-white">{approver.name}</span>
                                    <span className="text-gray-400">- {approver.role}</span>
                                    {approver.date && (
                                      <span className="text-gray-500 ml-auto">{approver.date}</span>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                {
                  id: 'delete',
                  label: 'Delete Selected',
                  icon: Trash2,
                  variant: 'danger' as const,
                  onClick: handleBulkDelete,
                  confirm: 'This action cannot be undone.',
                },
              ]}
              onClearSelection={clearSelection}
            />
          </div>
        )}

        {/* Analytics Tab */}
        {mainTab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Variations</p>
                <p className="text-2xl font-display text-white">
                  {variations.length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  £{(totalApproved + totalPending + totalRejected).toLocaleString('en-GB')}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Approved Total</p>
                <p className="text-2xl font-display text-green-400">
                  £{totalApproved.toLocaleString('en-GB')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {variations.filter((v: Variation) => v.status === 'approved' || v.status === 'executed').length} items
                </p>
              </div>
              <div className="card p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Pending £</p>
                <p className="text-2xl font-display text-amber-400">
                  £{totalPending.toLocaleString('en-GB')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {variationsAwaitingApproval.length} awaiting decision
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                  <TrendingUp className="h-4 w-4" />
                  Variation Cost Trend (Monthly)
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#F3F4F6' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#10B981"
                      name="Actual"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#F59E0B"
                      name="Forecast"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                  <PieChartIcon className="h-4 w-4" />
                  Variations by Type
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={typeDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: £${(value / 1000).toFixed(0)}k`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#F3F4F6' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <BarChart3 className="h-4 w-4" />
                Variation Count by Status
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  const count = variations.filter((v: Variation) => v.status === key).length;
                  return (
                    <div key={key} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={config.color} />
                        <span className="text-xs text-gray-400">{config.label}</span>
                      </div>
                      <p className="text-lg font-display text-white">{count}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Approval Workflow Tab */}
        {mainTab === 'approval' && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <AlertCircle className="h-4 w-4" />
                  Variations Awaiting Approval ({variationsAwaitingApproval.length})
                </div>
              </div>

              {variationsAwaitingApproval.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-400">All variations approved or rejected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variationsAwaitingApproval.map(variation => (
                    <div
                      key={variation.id}
                      className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-amber-600/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white">{variation.title}</p>
                          <p className="text-xs text-gray-400">{variation.ref} • {variation.project}</p>
                        </div>
                        <p
                          className={`text-sm font-display ${
                            variation.value > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          £{variation.value.toLocaleString('en-GB')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedVariationForApproval(variation);
                            setApprovalAction('approve');
                            setShowApprovalModal(true);
                          }}
                          className="flex-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <CheckCircle size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVariationForApproval(variation);
                            setApprovalAction('reject');
                            setShowApprovalModal(true);
                          }}
                          className="flex-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <CheckCheck className="h-4 w-4" />
                Approval History
              </div>
              <div className="space-y-3">
                {approvalHistoryData.map(record => (
                  <div key={record.id} className="p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{record.variationRef}</p>
                        <p className="text-xs text-gray-400">{record.approver}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          record.status === 'approved'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {record.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                    {record.comment && (
                      <p className="text-xs text-gray-300 mb-1">"{record.comment}"</p>
                    )}
                    <p className="text-xs text-gray-500">{record.date}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <AlertTriangle className="h-4 w-4" />
                Delegation Settings
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Project Manager</p>
                  <p className="text-sm text-white">Can approve up to £50,000</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Site Supervisor</p>
                  <p className="text-sm text-white">Can approve up to £10,000</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Finance Manager</p>
                  <p className="text-sm text-white">Can approve all amounts</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Impact Tab */}
        {mainTab === 'budget' && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <DollarSign className="h-4 w-4" />
                Original vs Current vs Forecast Budget
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="category" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <TrendingUp className="h-4 w-4" />
                Variation Impact on Cash Flow
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Legend />
                  <Bar dataKey="variation" fill="#F59E0B" name="Weekly Variation" />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#10B981"
                    name="Cumulative Impact"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Contingency Used</p>
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-2xl font-display text-amber-400">35%</span>
                    <span className="text-xs text-gray-500">£175,000 / £500,000</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full"
                      style={{ width: '35%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Remaining Budget</p>
                <p className="text-2xl font-display text-emerald-400">
                  £325,000
                </p>
                <p className="text-xs text-gray-500 mt-1">65% of contingency remaining</p>
              </div>

              <div className="card p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Forecast Variance</p>
                <p className="text-2xl font-display text-blue-400">+£80,000</p>
                <p className="text-xs text-gray-500 mt-1">3.2% over original budget</p>
              </div>
            </div>
          </div>
        )}

        {/* Contract Change Tab */}
        {mainTab === 'contract' && (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <GitBranch className="h-4 w-4" />
                Variation to Contract Instruction (VCI) Register
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">VCI No.</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Variation</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Drawing</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Spec Revision</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
                      <th className="text-left px-4 py-2 text-gray-400 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vciRegisterData.map(vci => (
                      <tr key={vci.id} className="border-b border-gray-700 hover:bg-gray-800/30">
                        <td className="px-4 py-2 text-white font-mono">{vci.vciNumber}</td>
                        <td className="px-4 py-2 text-blue-400">{vci.variationRef}</td>
                        <td className="px-4 py-2 text-gray-300">{vci.drawingRef || '-'}</td>
                        <td className="px-4 py-2 text-gray-300">{vci.specRevision || '-'}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              vci.status === 'issued'
                                ? 'bg-green-500/10 text-green-400'
                                : vci.status === 'implemented'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-gray-500/10 text-gray-400'
                            }`}
                          >
                            {vci.status === 'issued'
                              ? 'Issued'
                              : vci.status === 'implemented'
                                ? 'Implemented'
                                : 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-400">{vci.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <Link2 className="h-4 w-4" />
                Link Variation to Document
              </div>
              <div className="space-y-3">
                {variations.slice(0, 3).map(variation => (
                  <div
                    key={variation.id}
                    className="p-3 bg-gray-800/50 rounded-lg flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{variation.ref}</p>
                      <p className="text-xs text-gray-400">{variation.title}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Link2 size={12} />
                      Link Document
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                <FileText className="h-4 w-4" />
                VCI Status Tracker
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Draft VCIs</p>
                  <p className="text-2xl font-display text-gray-300">2</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Issued VCIs</p>
                  <p className="text-2xl font-display text-blue-400">5</p>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Implemented VCIs</p>
                  <p className="text-2xl font-display text-emerald-400">3</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-display text-white">Create Variation</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Project</label>
                    <select
                      value={form.project}
                      onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="">Select project...</option>
                      <option>Canary Wharf Office Complex</option>
                      <option>Manchester City Apartments</option>
                      <option>Birmingham Road Bridge</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Type</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="addition">Addition</option>
                      <option value="omission">Omission</option>
                      <option value="deletion">Deletion</option>
                      <option value="remeasurement">Remeasurement</option>
                      <option value="provisional">Provisional Sum</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Variation title..."
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the variation..."
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Value (£)</label>
                    <input
                      type="number"
                      value={form.value}
                      onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Reason</label>
                    <select
                      value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="">Select reason...</option>
                      <option>Site condition</option>
                      <option>Design coordination</option>
                      <option>Regulatory requirement</option>
                      <option>Client instruction</option>
                      <option>Ground condition</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Subcontractor</label>
                  <input
                    type="text"
                    value={form.subcontractor}
                    onChange={e => setForm(f => ({ ...f, subcontractor: e.target.value }))}
                    placeholder="Subcontractor name..."
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.title || !form.project}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Variation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {showApprovalModal && selectedVariationForApproval && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-display text-white">
                  {approvalAction === 'approve' ? 'Approve' : 'Reject'} Variation
                </h3>
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Variation</p>
                  <p className="text-sm text-white">{selectedVariationForApproval.ref}</p>
                  <p className="text-xs text-gray-400 mt-1">{selectedVariationForApproval.title}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {approvalAction === 'approve' ? 'Approval' : 'Rejection'} Comment
                  </label>
                  <textarea
                    rows={4}
                    value={approvalComment}
                    onChange={e => setApprovalComment(e.target.value)}
                    placeholder="Add your comment here..."
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.success(
                      `Variation ${approvalAction === 'approve' ? 'approved' : 'rejected'}`
                    );
                    setShowApprovalModal(false);
                    setApprovalComment('');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                    approvalAction === 'approve'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {approvalAction === 'approve' ? (
                    <>
                      <CheckCircle size={16} />
                      Approve
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editItem && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-display text-white">Edit Variation</h3>
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Ref</label>
                    <input
                      type="text"
                      value={editItem.ref}
                      onChange={e =>
                        setEditItem(f => (f ? { ...f, ref: e.target.value } : null))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Status</label>
                    <select
                      value={editItem.status}
                      onChange={e =>
                        setEditItem(f =>
                          f
                            ? {
                                ...f,
                                status: e.target.value as EditFormState['status'],
                              }
                            : null
                        )
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="executed">Executed</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Type</label>
                    <select
                      value={editItem.type}
                      onChange={e =>
                        setEditItem(f =>
                          f
                            ? {
                                ...f,
                                type: e.target.value as EditFormState['type'],
                              }
                            : null
                        )
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="addition">Addition</option>
                      <option value="omission">Omission</option>
                      <option value="deletion">Deletion</option>
                      <option value="remeasurement">Remeasurement</option>
                      <option value="provisional">Provisional Sum</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Impact</label>
                    <select
                      value={editItem.impact}
                      onChange={e =>
                        setEditItem(f =>
                          f
                            ? {
                                ...f,
                                impact: e.target.value as EditFormState['impact'],
                              }
                            : null
                        )
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Title</label>
                  <input
                    type="text"
                    value={editItem.title}
                    onChange={e =>
                      setEditItem(f => (f ? { ...f, title: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editItem.description}
                    onChange={e =>
                      setEditItem(f =>
                        f ? { ...f, description: e.target.value } : null
                      )
                    }
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Value (£)</label>
                    <input
                      type="number"
                      value={editItem.value}
                      onChange={e =>
                        setEditItem(f =>
                          f ? { ...f, value: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">
                      Original Value (£)
                    </label>
                    <input
                      type="number"
                      value={editItem.originalValue}
                      onChange={e =>
                        setEditItem(f =>
                          f ? { ...f, originalValue: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Reason</label>
                    <select
                      value={editItem.reason}
                      onChange={e =>
                        setEditItem(f => (f ? { ...f, reason: e.target.value } : null))
                      }
                      className="w-full px-3 py-2 input input-bordered text-white"
                    >
                      <option value="">Select reason...</option>
                      <option>Site condition</option>
                      <option>Design coordination</option>
                      <option>Regulatory requirement</option>
                      <option>Client instruction</option>
                      <option>Ground condition</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Subcontractor</label>
                    <input
                      type="text"
                      value={editItem.subcontractor}
                      onChange={e =>
                        setEditItem(f =>
                          f ? { ...f, subcontractor: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Submitted Date</label>
                  <input
                    type="date"
                    value={editItem.submittedDate}
                    onChange={e =>
                      setEditItem(f =>
                        f ? { ...f, submittedDate: e.target.value } : null
                      )
                    }
                    className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
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
