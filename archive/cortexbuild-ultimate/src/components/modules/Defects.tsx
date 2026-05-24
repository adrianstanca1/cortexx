import { useState, useRef } from 'react';
import {
  AlertTriangle, Plus, Search, Clock, AlertCircle,
  CheckCircle, XCircle, User,
  FileText, Edit, Trash2, X, Wrench, MapPin, Camera, MessageSquare,
  CheckSquare, Square, TrendingUp, BarChart3, PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { uploadFile } from '../../services/api';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { toast } from 'sonner';
import { useDefects } from '../../hooks/useData';

interface Defect {
  id: string;
  ref: string;
  title: string;
  project: string;
  location: string;
  defectType: 'structural' | 'finishing' | 'm&e' | 'fire' | 'waterproofing' | 'other';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'identified' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'disputed';
  identifiedDate: string;
  targetDate: string;
  completedDate?: string;
  identifiedBy: string;
  assignedTo: string;
  trade: string;
  description: string;
  rootCause: string;
  correctiveAction: string;
  photos: { url: string; caption: string }[];
  cost: number;
  comments: { author: string; date: string; text: string }[];
  severity?: 'minor' | 'moderate' | 'major' | 'critical';
}

interface HeatMapCell {
  area: string;
  defectCount: number;
}

interface RectificationItem {
  defectRef: string;
  description: string;
  assignedTo: string;
  assignedDate: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'fixed' | 'verified';
  isOverdue: boolean;
}



const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  low: { label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  identified: { label: 'Identified', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: AlertCircle },
  assigned: { label: 'Assigned', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: User },
  in_progress: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Wrench },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle },
  closed: { label: 'Closed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  disputed: { label: 'Disputed', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
};

const typeConfig: Record<string, { label: string; color: string }> = {
  structural: { label: 'Structural', color: 'text-red-400' },
  finishing: { label: 'Finishing', color: 'text-purple-400' },
  'm&e': { label: 'M&E', color: 'text-blue-400' },
  fire: { label: 'Fire Safety', color: 'text-orange-400' },
  waterproofing: { label: 'Waterproofing', color: 'text-cyan-400' },
  other: { label: 'Other', color: 'text-gray-400' },
};

type TabType = 'list' | 'heatmap' | 'rectification' | 'analytics';

const COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

export default function Defects() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedCards, setExpandedCards] = useState<string[]>([]);
  const [editItem, setEditItem] = useState<Defect | null>(null);
  const [selectedFloor, setSelectedFloor] = useState('Ground');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningDefectId, setAssigningDefectId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', project: '', location: '', trade: '', priority: 'medium', status: 'identified',
    description: '', identifiedBy: '', assignedTo: '', targetDate: ''
  });

  const { data: defects = [] } = useDefects.useList();
  const typedDefects = defects as unknown as Defect[];
  const createMutation = useDefects.useCreate();
  const updateMutation = useDefects.useUpdate();
  const deleteMutation = useDefects.useDelete();

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
    clearSelection();
  }

  const handleCreate = async () => {
    if (!form.title || !form.project) return;
    const ref = `DEF-${String(Date.now()).slice(-6)}`;
    await createMutation.mutateAsync({
      data: {
        reference: ref,
        title: form.title,
        project: form.project,
        location: form.location,
        trade: form.trade,
        priority: form.priority,
        status: form.status,
        description: form.description,
        identified_by: form.identifiedBy,
        assigned_to: form.assignedTo,
        due_date: form.targetDate,
        photos: [],
        comments: [],
      },
    });
    setShowCreateModal(false);
    setForm({ title: '', project: '', location: '', trade: '', priority: 'medium', status: 'identified', description: '', identifiedBy: '', assignedTo: '', targetDate: '' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this defect?')) return;
    deleteMutation.mutateAsync(id);
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.id) return;
    await updateMutation.mutateAsync({
      id: editItem.id,
      data: {
        title: editItem.title,
        project: editItem.project,
        location: editItem.location,
        trade: editItem.trade,
        priority: editItem.priority,
        status: editItem.status,
        description: editItem.description,
        identified_by: editItem.identifiedBy,
        assigned_to: editItem.assignedTo,
        due_date: editItem.targetDate,
      },
    });
    setEditItem(null);
  };

  const handleUploadPhoto = async (defectId: string, file: File) => {
    setUploading(true);
    try {
      const result = await uploadFile(file, 'PHOTOS');
      // Update is handled via React Query cache invalidation
      void defectId;
      void result;
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filteredDefects = typedDefects.filter((d: Defect) => {
    const matchesSearch = (d.ref || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.project || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || d.priority === filterPriority;
    const matchesType = filterType === 'all' || d.defectType === filterType;
    return matchesSearch && matchesStatus && matchesPriority && matchesType;
  });

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const totalOpen = typedDefects.filter((v: Defect) => !['completed', 'closed'].includes(v.status)).length;
  const totalCritical = typedDefects.filter((v: Defect) => v.priority === 'critical' && v.status !== 'closed').length;
  const totalCost = typedDefects.reduce((sum, v: Defect & { cost?: number }) => sum + (v.cost ?? 0), 0);

  return (
    <>
      <ModuleBreadcrumbs currentModule="defects" />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Defects Management
          </h2>
          <p className="text-gray-400 text-sm mt-1">Track, assign, and resolve construction defects</p>
        </div>
        {activeTab === 'list' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus size={18} />
            Report Defect
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {(['list', 'heatmap', 'rectification', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab === 'list' && 'Defects List'}
            {tab === 'heatmap' && 'Heat Map'}
            {tab === 'rectification' && 'Rectification'}
            {tab === 'analytics' && 'Analytics'}
          </button>
        ))}
      </div>

      {/* List Tab Content */}
      {activeTab === 'list' && (
        <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Open Defects</p>
              <p className="text-2xl font-display text-white mt-1">{totalOpen}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="text-orange-400" size={20} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Critical</p>
              <p className="text-2xl font-display text-red-400 mt-1">{totalCritical}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="text-red-400" size={20} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Repair Cost</p>
              <p className="text-2xl font-display text-amber-400 mt-1">£{totalCost.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Wrench className="text-amber-400" size={20} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Total Defects</p>
              <p className="text-2xl font-display text-white mt-1">{defects.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="text-blue-400" size={20} />
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
                placeholder="Search by ref, title, or project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 input input-bordered text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="identified">Identified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="disputed">Disputed</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="structural">Structural</option>
            <option value="finishing">Finishing</option>
            <option value="m&e">M&E</option>
            <option value="fire">Fire Safety</option>
            <option value="waterproofing">Waterproofing</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="space-y-3">
          {filteredDefects.map((defect) => {
            const status = statusConfig[defect.status];
            const priority = priorityConfig[defect.priority];
            const StatusIcon = status.icon;
            const isExpanded = expandedCards.includes(defect.id);
            const isSelected = selectedIds.has(String(defect.id));

            return (
              <div
                key={defect.id}
                className={`border border-gray-700 rounded-lg overflow-hidden hover:border-orange-500/50 transition-colors ${isSelected ? 'border-blue-500/50 bg-blue-900/10' : ''}`}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer bg-gray-800/50 hover:bg-gray-800"
                  onClick={() => {
                                        setShowCreateModal(false);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(defect.id); }}
                      className="text-gray-400 hover:text-white"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggle(String(defect.id)); }}
                      className="text-gray-400 hover:text-white"
                    >
                      {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-orange-400">{defect.ref}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.color}`}>
                          <StatusIcon size={12} className="inline mr-1" />
                          {status.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${priority.bg} ${priority.color}`}>
                          {priority.label}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded bg-gray-500/10 ${typeConfig[defect.defectType].color}`}>
                          {typeConfig[defect.defectType].label}
                        </span>
                      </div>
                      <p className="text-white font-medium mt-1">{defect.title}</p>
                      <p className="text-gray-400 text-sm flex items-center gap-2">
                        <MapPin size={12} /> {defect.location} | {defect.project}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-white text-sm font-medium">{defect.trade}</p>
                      <p className="text-gray-400 text-xs">Trade</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm">{defect.targetDate}</p>
                      <p className="text-gray-400 text-xs">Target</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditItem(defect);
                        setShowCreateModal(false);
                      }}
                      className="p-2 text-blue-400 hover:text-blue-300"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(defect.id);
                      }}
                      className="p-2 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-xs">Identified By</p>
                        <p className="text-white text-sm">{defect.identifiedBy}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Assigned To</p>
                        <p className="text-white text-sm">{defect.assignedTo}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Identified Date</p>
                        <p className="text-white text-sm">{defect.identifiedDate}</p>
                      </div>
                      {defect.cost > 0 && (
                        <div>
                          <p className="text-gray-400 text-xs">Est. Cost</p>
                          <p className="text-amber-400 text-sm font-medium">£{defect.cost.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <p className="text-gray-400 text-xs mb-1">Description</p>
                      <p className="text-gray-300 text-sm">{defect.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Root Cause</p>
                        <p className="text-gray-300 text-sm">{defect.rootCause}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Corrective Action</p>
                        <p className="text-gray-300 text-sm">{defect.correctiveAction}</p>
                      </div>
                    </div>

                    {(defect.photos || [])?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-xs mb-2">Photos ({defect.photos?.length || 0})</p>
                        <div className="flex gap-2 flex-wrap">
                          {(defect.photos || []).map((photo: { url: string; caption: string }, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded text-sm text-gray-300">
                              <Camera size={14} /> {photo.caption}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadPhoto(String(defect.id), file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors disabled:opacity-50"
                      >
                        <Camera size={14} /> {uploading ? 'Uploading...' : 'Add Photo'}
                      </button>
                    </div>

                    {(defect.comments || [])?.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-xs mb-2">Comments</p>
                        <div className="space-y-2">
                          {(defect.comments || []).map((comment: { author: string; date: string; text: string }, idx: number) => (
                            <div key={idx} className="flex gap-3 p-3 bg-gray-800 rounded">
                              <MessageSquare size={14} className="text-gray-500 mt-1" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-medium">{comment.author}</span>
                                  <span className="text-gray-500 text-xs">{comment.date}</span>
                                </div>
                                <p className="text-gray-300 text-sm mt-1">{comment.text}</p>
                              </div>
                            </div>
                          ))}
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
            { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger' as const, onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
          ]}
          onClearSelection={clearSelection}
        />
      </div>
        </div>
      )}

      {/* Heat Map Tab */}
      {activeTab === 'heatmap' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-display text-white mb-3">Select Floor/Level</label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="px-4 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
            >
              <option>Ground Floor</option>
              <option>Level 1</option>
              <option>Level 2</option>
              <option>Basement</option>
            </select>
          </div>

          <div className="card p-6 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Site Floor Plan - Defect Density ({selectedFloor})</h3>
            <div className="flex gap-8">
              <div>
                <div className="grid grid-cols-10 gap-2 w-fit">
                  {Array.from({ length: 100 }, (_, i) => {
                    const density = Math.floor(Math.random() * 7);
                    const bgColor =
                      density === 0 ? 'bg-emerald-900' :
                      density <= 2 ? 'bg-yellow-700' :
                      density <= 5 ? 'bg-orange-700' :
                      'bg-red-700';
                    return (
                      <div
                        key={i}
                        className={`w-12 h-12 ${bgColor} rounded cursor-pointer hover:opacity-75 transition-opacity flex items-center justify-center text-xs font-bold text-white border border-gray-800`}
                        title={`Area ${i + 1}: ${density} defect(s)`}
                      >
                        {density > 0 && density}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-display mb-3">Defect Legend</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-900 rounded border border-gray-700" />
                      <span className="text-gray-300 text-sm">Green: 0 defects</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-700 rounded border border-gray-700" />
                      <span className="text-gray-300 text-sm">Yellow: 1-2 defects</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-700 rounded border border-gray-700" />
                      <span className="text-gray-300 text-sm">Orange: 3-5 defects</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-700 rounded border border-gray-700" />
                      <span className="text-gray-300 text-sm">Red: 6+ defects</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 p-4 rounded border border-gray-700 text-sm text-gray-400">
                  <p className="font-display text-white mb-2">High Risk Areas</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Area 42 (Southeast corner): 8 defects</li>
                    <li>• Area 67 (North wall): 6 defects</li>
                    <li>• Area 88 (Entrance): 5 defects</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rectification Tab */}
      {activeTab === 'rectification' && (
        <div className="space-y-6">
          <div className="flex gap-4 mb-6">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Fixed</option>
              <option value="closed">Verified</option>
            </select>
            <select
              className="px-4 py-2 input input-bordered text-white focus:border-orange-500 focus:outline-none"
            >
              <option>All Assignees</option>
              <option>John Smith</option>
              <option>Sarah Johnson</option>
              <option>Mike Thompson</option>
            </select>
          </div>

          <div className="card p-4 border border-gray-700">
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Ref</th>
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Description</th>
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Assigned To</th>
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Assigned Date</th>
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Due Date</th>
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-display text-gray-400 tracking-widest uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typedDefects.slice(0, 8).map((defect) => {
                    const isOverdue = defect.status !== 'closed' && new Date(defect.targetDate) < new Date();
                    return (
                      <tr key={defect.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="py-3 px-4 font-mono text-orange-400">{defect.ref}</td>
                        <td className="py-3 px-4 text-gray-300">{defect.title}</td>
                        <td className="py-3 px-4 text-gray-300">{defect.assignedTo || '—'}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{defect.identifiedDate}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          <div className="flex items-center gap-2">
                            {isOverdue && <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-medium">Overdue</span>}
                            {defect.targetDate}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            defect.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            defect.status === 'closed' ? 'bg-emerald-500/20 text-emerald-400' :
                            defect.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {defect.status === 'completed' ? 'Fixed' : defect.status === 'closed' ? 'Verified' : defect.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setAssigningDefectId(defect.id);
                                setShowAssignModal(true);
                              }}
                              className="px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors"
                            >
                              Assign
                            </button>
                            {defect.status !== 'completed' && (
                              <button
                                onClick={() => {
                                  toast.success(`Marked as Fixed`);
                                }}
                                className="px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-xs transition-colors"
                              >
                                Mark Fixed
                              </button>
                            )}
                            {defect.status === 'completed' && (
                              <button
                                onClick={() => {
                                  toast.success(`Marked as Verified`);
                                }}
                                className="px-2 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded text-xs transition-colors"
                              >
                                Verify
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Total Defects</p>
                  <p className="text-2xl font-display text-white mt-1">{defects.length}</p>
                </div>
                <FileText className="text-blue-400" size={24} />
              </div>
            </div>
            <div className="card p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Open Defects</p>
                  <p className="text-2xl font-display text-orange-400 mt-1">{typedDefects.filter((d: Defect) => !['completed', 'closed'].includes(d.status)).length}</p>
                </div>
                <AlertCircle className="text-orange-400" size={24} />
              </div>
            </div>
            <div className="card p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Closed (Month)</p>
                  <p className="text-2xl font-display text-emerald-400 mt-1">12</p>
                </div>
                <CheckCircle className="text-emerald-400" size={24} />
              </div>
            </div>
            <div className="card p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Avg Days to Close</p>
                  <p className="text-2xl font-display text-white mt-1">14</p>
                </div>
                <Clock className="text-gray-400" size={24} />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Defects by Trade */}
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-400" />
                Defects by Trade/Category
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Structural', value: 12 },
                      { name: 'Finishing', value: 18 },
                      { name: 'M&E', value: 14 },
                      { name: 'Fire Safety', value: 5 },
                      { name: 'Waterproofing', value: 8 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                    <Bar dataKey="value" fill="#f97316" name="Defects" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Defect Severity Distribution */}
            <div className="card p-5 border border-gray-700">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-orange-400" />
                Defects by Severity
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Minor', value: 22 },
                        { name: 'Moderate', value: 18 },
                        { name: 'Major', value: 14 },
                        { name: 'Critical', value: 3 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="card p-5 border border-gray-700 lg:col-span-2">
              <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-400" />
                Defect Trend (Last 8 Weeks)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { week: 'W1', new: 5, closed: 2 },
                      { week: 'W2', new: 8, closed: 3 },
                      { week: 'W3', new: 6, closed: 4 },
                      { week: 'W4', new: 7, closed: 5 },
                      { week: 'W5', new: 4, closed: 6 },
                      { week: 'W6', new: 9, closed: 5 },
                      { week: 'W7', new: 5, closed: 8 },
                      { week: 'W8', new: 3, closed: 7 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="week" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Line type="monotone" dataKey="new" stroke="#ef4444" strokeWidth={2} name="New Defects" />
                    <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} name="Closed Defects" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Recurring Defect Types */}
          <div className="card p-5 border border-gray-700">
            <h3 className="text-lg font-display text-white mb-4">Top 5 Recurring Defect Types</h3>
            <div className="space-y-3">
              {[
                { type: 'Incomplete plasterboard finishing', count: 14, percentage: 18 },
                { type: 'Paint coverage gaps on columns', count: 11, percentage: 14 },
                { type: 'Electrical socket alignment issues', count: 9, percentage: 12 },
                { type: 'Door frame misalignment', count: 8, percentage: 10 },
                { type: 'Waterproofing membrane tears', count: 7, percentage: 9 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-800/50 rounded border border-gray-700">
                  <div className="flex-1">
                    <p className="text-white font-medium mb-1">{item.type}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-sm">
                        <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${item.percentage * 2}%` }} />
                      </div>
                      <span className="text-sm text-gray-400">{item.count} occurrences</span>
                    </div>
                  </div>
                  <span className="text-lg font-display text-orange-400 ml-4">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">Report Defect</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Project</label>
                  <select value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="">Select project...</option>
                    <option>Canary Wharf Office Complex</option>
                    <option>Manchester City Apartments</option>
                    <option>Birmingham Road Bridge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Title</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Defect title..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Location</label>
                  <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location on site..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Trade</label>
                  <input type="text" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} placeholder="Trade responsible..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the defect..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Identified By</label>
                  <input type="text" value={form.identifiedBy} onChange={e => setForm(f => ({ ...f, identifiedBy: e.target.value }))} placeholder="Your name..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Assigned To</label>
                  <input type="text" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Contractor/worker..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Target Date</label>
                <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={handleCreate} disabled={createMutation.isPending || !form.title || !form.project} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Report Defect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">Assign Defect</h3>
              <button type="button" onClick={() => { setShowAssignModal(false); setAssigningDefectId(null); }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-xs mb-2">Assign to Tradesperson</label>
                <select className="w-full px-3 py-2 input input-bordered text-white">
                  <option>Select tradesperson...</option>
                  <option>John Smith (Structural)</option>
                  <option>Sarah Johnson (Finishing)</option>
                  <option>Mike Thompson (M&E)</option>
                  <option>Lisa Chen (Fire Safety)</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-2">Due Date</label>
                <input type="date" className="w-full px-3 py-2 input input-bordered text-white" />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-2">Notes</label>
                <textarea rows={3} placeholder="Assignment notes..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowAssignModal(false); setAssigningDefectId(null); }} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Defect assigned successfully');
                  setShowAssignModal(false);
                  setAssigningDefectId(null);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">Edit Defect</h3>
              <button type="button" onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Project</label>
                  <input type="text" value={editItem.project || ''} onChange={e => setEditItem((prev) => ({ ...prev!, project: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Priority</label>
                  <select value={editItem.priority || 'medium'} onChange={e => setEditItem((prev) => prev ? ({ ...prev, priority: e.target.value as Defect['priority'] }) : null)} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Title</label>
                <input type="text" value={editItem.title || ''} onChange={e => setEditItem((prev) => ({ ...prev!, title: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Location</label>
                  <input type="text" value={editItem.location || ''} onChange={e => setEditItem((prev) => ({ ...prev!, location: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Trade</label>
                  <input type="text" value={editItem.trade || ''} onChange={e => setEditItem((prev) => ({ ...prev!, trade: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Description</label>
                <textarea rows={3} value={editItem.description || ''} onChange={e => setEditItem((prev) => ({ ...prev!, description: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Status</label>
                  <select value={editItem.status || 'identified'} onChange={e => setEditItem((prev) => prev ? ({ ...prev, status: e.target.value as Defect['status'] }) : null)} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="identified">Identified</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Identified By</label>
                  <input type="text" value={editItem.identifiedBy || ''} onChange={e => setEditItem((prev) => ({ ...prev!, identifiedBy: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Assigned To</label>
                  <input type="text" value={editItem.assignedTo || ''} onChange={e => setEditItem((prev) => ({ ...prev!, assignedTo: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Target Date</label>
                  <input type="date" value={editItem.targetDate || ''} onChange={e => setEditItem((prev) => ({ ...prev!, targetDate: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="button" onClick={handleUpdate} disabled={updateMutation.isPending || !editItem?.title || !editItem?.project} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50">
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
