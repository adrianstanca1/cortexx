import React, { useState } from 'react';
import { ClipboardList, Plus, Search, Camera, CheckCircle2, AlertCircle, Clock, X, ChevronRight, Edit2, Trash2, Image, Tag, MapPin, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { usePunchList } from '../../hooks/useData';
import { toast } from 'sonner';

type AnyRow = Record<string, unknown>;

const TRADES = ['Joinery','Plastering','Painting','Plumbing','Electrical','Tiling','Glazing','Roofing','General'];
const STATUS_OPTIONS = ['Open','In Progress','Resolved','Signed Off','Closed'];
const PRIORITY_OPTIONS = ['Low','Medium','High','Critical'];
const _LOCATION_OPTIONS = ['Floor 1','Floor 2','External','Roof','Basement','Atrium','Common Area','Other'];

const statusColour: Record<string,string> = {
  'Open':'bg-red-900/30 text-red-300',
  'In Progress':'bg-yellow-900/30 text-yellow-300',
  'Resolved':'bg-blue-900/30 text-blue-300',
  'Signed Off':'bg-green-900/30 text-green-300',
  'Closed':'bg-gray-700/50 text-gray-400',
};

const priorityColour: Record<string,string> = {
  'Low':'bg-gray-700/50 text-gray-400',
  'Medium':'bg-yellow-900/30 text-yellow-300',
  'High':'bg-orange-900/30 text-orange-300',
  'Critical':'bg-red-900/30 text-red-300',
};

const _priorityStripColour: Record<string,string> = {
  'Critical':'bg-red-600','High':'bg-orange-500','Medium':'bg-yellow-500','Low':'bg-gray-400',
};

const emptyForm = {
  description:'', location:'', trade:'General', assigned_to:'',
  priority:'Medium', status:'Open', due_date:'', project:'', notes:''
};

export function PunchList() {
  const { useList, useCreate, useUpdate, useDelete } = usePunchList;
  const { data: raw = [], isLoading } = useList();
  const items = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [mainTab, setMainTab] = useState<'list' | 'trade' | 'photos'>('list');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'In Progress' | 'Resolved' | 'Signed Off' | 'Overdue'>('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  // Stats
  const openCount = items.filter(i => i.status === 'Open').length;
  const inProgressCount = items.filter(i => i.status === 'In Progress').length;
  const resolvedCount = items.filter(i => i.status === 'Resolved').length;
  const _signedOffCount = items.filter(i => i.status === 'Signed Off').length;
  const _closedCount = items.filter(i => i.status === 'Closed').length;
  const overdueCount = items.filter(i => {
    if (['Closed','Signed Off'].includes(String(i.status??''))) return false;
    if (!i.due_date) return false;
    return new Date(String(i.due_date)) < new Date();
  }).length;

  const totalItems = items.length;

  // Filter items
  const filtered = items.filter(i => {
    const desc = String(i.description ?? '').toLowerCase();
    const loc = String(i.location ?? '').toLowerCase();
    const tr = String(i.trade ?? '').toLowerCase();
    const matchSearch = !search || desc.includes(search.toLowerCase()) || loc.includes(search.toLowerCase()) || tr.includes(search.toLowerCase());

    let matchStatus = true;
    if (statusFilter === 'Overdue') {
      matchStatus = !['Closed','Signed Off'].includes(String(i.status??'')) && !!i.due_date && new Date(String(i.due_date)) < new Date();
    } else if (statusFilter !== 'All') {
      matchStatus = i.status === statusFilter;
    }

    const matchProject = projectFilter === 'All' || String(i.project ?? '') === projectFilter;

    return matchSearch && matchStatus && matchProject;
  });

  // Project list
  const projects = [...new Set(items.map(i => String(i.project ?? '')).filter(Boolean))].sort();

  // Trade grouping
  const tradeGroups = TRADES.map(trade => {
    const tradeItems = items.filter(i => String(i.trade ?? '') === trade);
    return {
      trade,
      items: tradeItems,
      openCount: tradeItems.filter(i => i.status === 'Open').length,
      inProgressCount: tradeItems.filter(i => i.status === 'In Progress').length,
      resolvedCount: tradeItems.filter(i => i.status === 'Resolved').length,
      overdueCount: tradeItems.filter(i => {
        if (['Closed','Signed Off'].includes(String(i.status??''))) return false;
        if (!i.due_date) return false;
        return new Date(String(i.due_date)) < new Date();
      }).length,
    };
  }).filter(g => g.items.length > 0);

  // Photo items
  const photoItems = items.filter(i => Number(i.photos ?? 0) > 0).sort((a, b) => Number(b.photos ?? 0) - Number(a.photos ?? 0));

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(i: AnyRow) {
    setEditing(i);
    setForm({
      description: String(i.description ?? ''),
      location: String(i.location ?? ''),
      trade: String(i.trade ?? 'General'),
      assigned_to: String(i.assigned_to ?? ''),
      priority: String(i.priority ?? 'Medium'),
      status: String(i.status ?? 'Open'),
      due_date: String(i.due_date ?? ''),
      project: String(i.project ?? ''),
      notes: String(i.notes ?? ''),
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error('Description required');
      return;
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: String(editing.id), data: form });
      toast.success('Item updated');
    } else {
      await createMutation.mutateAsync(form);
      toast.success('Item added');
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Item deleted');
  }

  async function updateStatus(id: string, status: string) {
    await updateMutation.mutateAsync({ id, data: { status } });
    toast.success(`Status: ${status}`);
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="punch-list" />
      <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={24} className="text-orange-500" />
            <h1 className="text-2xl font-bold text-white">Punch List</h1>
          </div>
          <p className="text-sm text-gray-400">Snagging & defect tracking</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          <span>Add Snag</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Items', value: totalItems, icon: ClipboardList, color: 'text-blue-400', bg: 'bg-blue-900/20' },
          { label: 'Open', value: openCount, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/20' },
          { label: 'In Progress', value: inProgressCount, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
          { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-900/20' },
          { label: 'Overdue', value: overdueCount, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/20' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`${stat.bg} border border-gray-700 rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={stat.color} />
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {[
          { key: 'list', label: 'Snagging List', icon: ClipboardList },
          { key: 'trade', label: 'By Trade', icon: Tag },
          { key: 'photos', label: 'Photo Log', icon: Image },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key as 'list' | 'trade' | 'photos')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mainTab === tab.key
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : mainTab === 'list' ? (
        // SNAGGING LIST TAB
        <>
          {/* Quick Filters */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'All', value: 'All' as const },
                { label: 'Open', value: 'Open' as const },
                { label: 'In Progress', value: 'In Progress' as const },
                { label: 'Resolved', value: 'Resolved' as const },
                { label: 'Signed Off', value: 'Signed Off' as const },
                { label: 'Overdue', value: 'Overdue' as const },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === f.value
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search description, location, trade…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
                />
              </div>
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="text-sm border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="All">All Projects</option>
                {projects.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-400">{filtered.length} items</span>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <EmptyState title="No items match your filters" icon={ClipboardList} />
          ) : (
            <>
            <div className="cb-table-scroll touch-pan-x bg-gray-900 border border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800">
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Location</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Trade</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Assigned To</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Priority</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Due Date</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300">Photos</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const id = String(item.id ?? '');
                    const isSelected = selectedIds.has(id);
                    const priority = String(item.priority ?? 'Medium');
                    const status = String(item.status ?? 'Open');
                    const isExp = expandedDetail === id;
                    return (
                      <React.Fragment key={id}>
                        <tr className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                              {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-200 max-w-xs truncate">{String(item.description ?? '')}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{String(item.location ?? '')}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{String(item.trade ?? '')}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{String(item.assigned_to ?? '')}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${priorityColour[priority] ?? 'bg-gray-700 text-gray-400'}`}>
                              {priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${statusColour[status] ?? 'bg-gray-700 text-gray-400'}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{String(item.due_date ?? '')}</td>
                          <td className="px-4 py-3 text-center">
                            {Number(item.photos ?? 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                                <Camera size={12} />
                                {Number(item.photos)}
                              </span>
                            ) : (
                              <span className="text-gray-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setExpandedDetail(isExp ? null : id)}
                              className="inline-flex items-center justify-center p-1 hover:bg-gray-700 rounded transition-colors"
                              title="View details"
                            >
                              <ChevronRight size={14} className={`text-gray-400 transition-transform ${isExp ? 'rotate-90' : ''}`} />
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-gray-800/50 border-b border-gray-700">
                            <td colSpan={10} className="px-4 py-4">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">DESCRIPTION</p>
                                    <p className="text-gray-300 text-sm">{String(item.description ?? '')}</p>
                                  </div>
                                  {Boolean(item.notes) && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">NOTES</p>
                                      <p className="text-gray-300 text-sm">{String(item.notes ?? '')}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => updateStatus(id, 'In Progress')}
                                    className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
                                  >
                                    Mark In Progress
                                  </button>
                                  <button
                                    onClick={() => updateStatus(id, 'Resolved')}
                                    className="px-3 py-1.5 text-xs btn btn-primary rounded transition-colors"
                                  >
                                    Mark Resolved
                                  </button>
                                  <button
                                    onClick={() => updateStatus(id, 'Signed Off')}
                                    className="px-3 py-1.5 text-xs btn btn-success rounded transition-colors"
                                  >
                                    Sign Off
                                  </button>
                                  <button
                                    onClick={() => openEdit(item)}
                                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(id)}
                                    className="px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
            </div>
            </>
          )}
        </>
      ) : mainTab === 'trade' ? (
        // BY TRADE TAB
        <div className="space-y-3">
          {tradeGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Tag size={48} className="mb-3 opacity-30" />
              <p>No items by trade</p>
            </div>
          ) : (
            tradeGroups.map(group => (
              <div key={group.trade} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedTrade(expandedTrade === group.trade ? null : group.trade)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Tag size={16} className="text-orange-500" />
                    <div className="text-left">
                      <p className="font-semibold text-white">{group.trade}</p>
                      <p className="text-xs text-gray-400">{group.items.length} items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-gray-400">Open: {group.openCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-gray-400">Progress: {group.inProgressCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-gray-400">Resolved: {group.resolvedCount}</span>
                      </div>
                      {group.overdueCount > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-600" />
                          <span className="text-red-400">Overdue: {group.overdueCount}</span>
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 transition-transform ${expandedTrade === group.trade ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
                {expandedTrade === group.trade && (
                  <div className="border-t border-gray-700 px-4 py-3 space-y-2 bg-gray-800/50">
                    {group.items.map(item => (
                      <div key={String(item.id ?? '')} className="flex items-center justify-between p-2 bg-gray-900/50 rounded border border-gray-700">
                        <div className="flex-1">
                          <p className="text-sm text-gray-200">{String(item.description ?? '')}</p>
                          <p className="text-xs text-gray-500">
                            {String(item.location ?? '')} • {String(item.assigned_to ?? '')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(item.status ?? 'Open')] ?? 'bg-gray-700 text-gray-400'}`}>
                            {String(item.status ?? 'Open')}
                          </span>
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        // PHOTO LOG TAB
        <div>
          {photoItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Image size={48} className="mb-3 opacity-30" />
              <p>No items with photos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photoItems.map(item => (
                <div key={String(item.id ?? '')} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors cursor-pointer group">
                  <div className="aspect-video bg-gray-800 flex items-center justify-center relative overflow-hidden">
                    <div className="flex flex-col items-center justify-center gap-2 group-hover:opacity-75 transition-opacity">
                      <Camera size={24} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-400">{Number(item.photos)} photo{Number(item.photos) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-200 line-clamp-2">{String(item.description ?? '')}</p>
                    <div className="space-y-1 text-xs text-gray-400">
                      {!!item.location && (
                        <p className="flex items-center gap-1">
                          <MapPin size={12} /> {String(item.location)}
                        </p>
                      )}
                      {!!item.project && (
                        <p className="flex items-center gap-1">
                          <Tag size={12} /> {String(item.project)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 pt-2 border-t border-gray-700">
                      <button
                        onClick={() => openEdit(item)}
                        className="flex-1 px-2 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                      >
                        <Edit2 size={12} className="inline mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(String(item.id ?? ''))}
                        className="flex-1 px-2 py-1.5 text-xs bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded transition-colors"
                      >
                        <Trash2 size={12} className="inline mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Snag' : 'Add Snag'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    placeholder="What needs to be fixed?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Room 101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Trade</label>
                  <select
                    value={form.trade}
                    onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {TRADES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Assigned To</label>
                  <input
                    type="text"
                    value={form.assigned_to}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Name or team"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
                  <input
                    type="text"
                    value={form.project}
                    onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Project name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-600 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    placeholder="Additional notes or context…"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {editing ? 'Update' : 'Add'}
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
export default PunchList;
