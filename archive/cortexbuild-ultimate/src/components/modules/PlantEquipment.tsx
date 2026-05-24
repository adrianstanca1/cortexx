import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck, Plus, Search, Wrench, CheckCircle2, Trash2, X, Calendar, DollarSign, MapPin, Tag, BarChart3, CheckSquare, Square
} from 'lucide-react';
import { useEquipment } from '../../hooks/useData';
import { equipmentApi } from '../../services/api';
import { toast } from 'sonner';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type AnyRow = Record<string, unknown>;

const EQUIPMENT_TYPES = [
  'Crane', 'MEWP', 'Excavator', 'Dumper', 'Concrete Equipment',
  'Generator', 'Compressor', 'Scaffold', 'Forklift', 'Other'
];

const STATUS_OPTIONS = ['On Site', 'Available', 'Maintenance', 'Hired Out'];
const SERVICE_TYPES = ['Routine', 'Major', 'Repair', 'LOLER', 'PSSR'];

const statusColors: Record<string, string> = {
  'On Site': 'bg-blue-900/30 text-blue-300 border border-blue-700',
  'Available': 'bg-green-900/30 text-green-300 border border-green-700',
  'Maintenance': 'bg-yellow-900/30 text-yellow-300 border border-yellow-700',
  'Hired Out': 'bg-purple-900/30 text-purple-300 border border-purple-700',
};

const emptyEquipmentForm = {
  name: '', type: '', registration: '', status: 'Available',
  location: '', dailyRate: '', nextService: ''
};

const emptyServiceForm = {
  equipmentId: '', serviceDate: '', serviceType: 'Routine',
  notes: '', nextDueDate: '', technician: ''
};

const emptyHireForm = {
  equipmentId: '', hireCompany: '', dailyRate: '', startDate: '',
  endDate: '', project: ''
};

export function PlantEquipment() {
  const { useList, useCreate, useUpdate, useDelete } = useEquipment;
  const { data: raw = [], isLoading } = useList();
  const equipment = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState<'fleet' | 'service' | 'hire' | 'utilisation'>('fleet');
  const [fleetFilter, setFleetFilter] = useState<'All' | 'On Site' | 'Available' | 'Maintenance' | 'Hired Out'>('All');
  const [search, setSearch] = useState('');
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<AnyRow | null>(null);
  const [selectedEquipmentDetail, setSelectedEquipmentDetail] = useState<AnyRow | null>(null);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [hireForm, setHireForm] = useState(emptyHireForm);

  const [serviceLogs, setServiceLogs] = useState<AnyRow[]>([]);
  const [hireLogs, setHireLogs] = useState<AnyRow[]>([]);

  useEffect(() => {
    equipmentApi.getServiceLogs().then(data => setServiceLogs(data as AnyRow[])).catch((err) => {
      console.error('Failed to load service logs:', err);
    });
    equipmentApi.getHireLogs().then(data => setHireLogs(data as AnyRow[])).catch((err) => {
      console.error('Failed to load hire logs:', err);
    });
  }, []);

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

  // Filter fleet by status and search
  const filteredFleet = useMemo(() => {
    return equipment.filter(e => {
      const matchStatus = fleetFilter === 'All' || e.status === fleetFilter;
      const matchSearch = !search ||
        String(e.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        String(e.type ?? '').toLowerCase().includes(search.toLowerCase()) ||
        String(e.registration ?? '').toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [equipment, fleetFilter, search]);

  // Stats calculations
  const totalFleet = equipment.length;
  const onSiteCount = equipment.filter(e => e.status === 'On Site').length;
  const availableCount = equipment.filter(e => e.status === 'Available').length;
  const maintenanceCount = equipment.filter(e => e.status === 'Maintenance').length;
  const totalDailyRate = equipment.reduce((sum, e) => sum + (Number(e.dailyRate ?? 0)), 0);

  // Service schedule (sorted by nextService date)
  const serviceSchedule = equipment
    .filter(e => e.nextService)
    .sort((a, b) => new Date(String(a.nextService)).getTime() - new Date(String(b.nextService)).getTime());

  const getServiceUrgency = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (days < 0) return 'overdue';
    if (days <= 7) return 'due-soon';
    return 'ok';
  };

  // Hire management
  const activeHires = hireLogs.filter(h => h.status === 'Active');
  const totalHireCost = activeHires.reduce((sum, h) => sum + (Number(h.daily_rate) * 30), 0); // Monthly projection

  // Utilisation data derived from actual hire and service logs (last 30 days)
  const utilisationData = equipment.map(e => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    const eqHires = hireLogs.filter(h =>
      String(h.equipment_id ?? '') === String(e.id ?? '') ||
      String(h.name ?? '') === String(e.name ?? '')
    );
    const eqServices = serviceLogs.filter(s =>
      String(s.equipment_id ?? '') === String(e.id ?? '')
    );
    const onSiteDays = Math.min(30, eqHires.reduce((sum, h) => {
      if (!h.start_date) return sum;
      const start = Math.max(new Date(String(h.start_date)).getTime(), thirtyDaysAgo);
      const end = h.end_date ? Math.min(new Date(String(h.end_date)).getTime(), now) : now;
      return end > start ? sum + Math.ceil((end - start) / 86400000) : sum;
    }, 0));
    const maintenanceDays = Math.min(30 - onSiteDays, eqServices.reduce((sum, s) => {
      const d = s.date ? new Date(String(s.date)).getTime() : 0;
      return d > thirtyDaysAgo && d < now ? sum + 1 : sum;
    }, 0));
    const idleDays = Math.max(0, 30 - onSiteDays - maintenanceDays);
    return {
      name: String(e.name ?? '').substring(0, 12),
      onSiteDays,
      idleDays,
      maintenanceDays,
    };
  }).slice(0, 8);

  const statusDistribution = [
    { name: 'On Site', value: onSiteCount, fill: '#3b82f6' },
    { name: 'Available', value: availableCount, fill: '#10b981' },
    { name: 'Maintenance', value: maintenanceCount, fill: '#f59e0b' },
    { name: 'Hired Out', value: equipment.filter(e => e.status === 'Hired Out').length, fill: '#8b5cf6' }
  ].filter(d => d.value > 0);

  // Open equipment modal
  function openEquipmentCreate() {
    setEditingEquipment(null);
    setEquipmentForm({ ...emptyEquipmentForm });
    setShowEquipmentModal(true);
  }

  function openEquipmentEdit(e: AnyRow) {
    setEditingEquipment(e);
    setEquipmentForm({
      name: String(e.name ?? ''),
      type: String(e.type ?? ''),
      registration: String(e.registration ?? ''),
      status: String(e.status ?? 'Available'),
      location: String(e.location ?? ''),
      dailyRate: String(e.dailyRate ?? ''),
      nextService: String(e.nextService ?? '')
    });
    setShowEquipmentModal(true);
  }

  async function handleEquipmentSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const payload = {
      ...equipmentForm,
      dailyRate: equipmentForm.dailyRate !== null && equipmentForm.dailyRate !== undefined ? Number(equipmentForm.dailyRate) : 0
    };
    try {
      if (editingEquipment) {
        await updateMutation.mutateAsync({ id: String(editingEquipment.id), data: payload });
        toast.success('Equipment updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Equipment added');
      }
      setShowEquipmentModal(false);
    } catch {
      toast.error('Error saving equipment');
    }
  }

  async function handleDeleteEquipment(id: string) {
    if (!confirm('Remove this equipment?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Equipment removed');
    } catch {
      toast.error('Error deleting equipment');
    }
  }

  async function _changeEquipmentStatus(e: AnyRow, newStatus: string) {
    try {
      await updateMutation.mutateAsync({ id: String(e.id), data: { status: newStatus } });
      toast.success(`Status changed to ${newStatus}`);
    } catch {
      toast.error('Error updating status');
    }
  }

  function handleDetailClick(e: AnyRow) {
    setSelectedEquipmentDetail(e);
    setShowDetailModal(true);
  }

  async function handleServiceSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      const log = await equipmentApi.createServiceLog({
        equipment_id: serviceForm.equipmentId || null,
        date: serviceForm.serviceDate,
        type: serviceForm.serviceType,
        notes: serviceForm.notes,
        next_due: serviceForm.nextDueDate || null,
        technician: serviceForm.technician,
      });
      setServiceLogs(prev => [log as AnyRow, ...prev]);
      toast.success('Service logged successfully');
      setShowServiceModal(false);
      setServiceForm({ ...emptyServiceForm });
    } catch {
      toast.error('Failed to log service');
    }
  }

  async function handleHireSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const eqName = equipment.find(e => String(e.id) === hireForm.equipmentId)?.name ?? 'Hire Record';
    try {
      const log = await equipmentApi.createHireLog({
        equipment_id: hireForm.equipmentId || null,
        name: String(eqName),
        company: hireForm.hireCompany,
        daily_rate: parseFloat(hireForm.dailyRate) || 0,
        start_date: hireForm.startDate || null,
        end_date: hireForm.endDate || null,
        project: hireForm.project,
      });
      setHireLogs(prev => [log as AnyRow, ...prev]);
      toast.success('Hire record added');
      setShowHireModal(false);
      setHireForm({ ...emptyHireForm });
    } catch {
      toast.error('Failed to add hire record');
    }
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="plant" />
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-gray-100">Plant & Equipment</h1>
          <p className="text-sm text-gray-400 mt-1">Fleet management, maintenance tracking & utilisation analytics</p>
        </div>
        <button
          onClick={openEquipmentCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          <span>Add Equipment</span>
        </button>
      </div>

      {/* Stats Cards - 5 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Fleet', value: totalFleet, icon: Truck, color: 'text-blue-400', bg: 'bg-blue-900/20' },
          { label: 'On Site', value: onSiteCount, icon: MapPin, color: 'text-green-400', bg: 'bg-green-900/20' },
          { label: 'Available', value: availableCount, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
          { label: 'In Maintenance', value: maintenanceCount, icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-900/20' },
          { label: 'Daily Rate', value: `£${totalDailyRate.toLocaleString()}`, icon: DollarSign, color: 'text-orange-400', bg: 'bg-orange-900/20' }
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-2xl font-display text-gray-100 mt-2">{kpi.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { key: 'fleet' as const, label: 'Fleet Register', icon: Truck },
          { key: 'service' as const, label: 'Service Schedule', icon: Calendar },
          { key: 'hire' as const, label: 'Hire Management', icon: Tag },
          { key: 'utilisation' as const, label: 'Utilisation', icon: BarChart3 }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === tab.key
                ? 'border-blue-600 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          FLEET REGISTER TAB
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'fleet' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, type, registration…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              />
            </div>
            <select
              value={fleetFilter}
              onChange={(e) => setFleetFilter(e.target.value as 'All' | 'On Site' | 'Available' | 'Maintenance' | 'Hired Out')}
              className="text-sm bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['All', 'On Site', 'Available', 'Maintenance', 'Hired Out'].map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400 ml-auto">{filteredFleet.length} items</span>
          </div>

          {/* Equipment Cards */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filteredFleet.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No equipment found"
              description="Try adjusting filters or add new equipment."
            />
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFleet.map((e) => {
                const id = String(e.id ?? '');
                const isSelected = selectedIds.has(id);
                const statusColor = statusColors[String(e.status ?? 'Available')] || statusColors['Available'];
                return (
                  <div
                    key={id}
                    className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors cursor-pointer"
                    onClick={() => handleDetailClick(e)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <button type="button" onClick={ev => { ev.stopPropagation(); toggle(id); }}>
                        {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                      </button>
                      <div className="flex-1">
                        <h3 className="font-display text-gray-100 text-sm">{String(e.name ?? 'Unknown')}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{String(e.type ?? '')}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium whitespace-nowrap ${statusColor}`}>
                        {String(e.status ?? '')}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-gray-300">
                      {!!e.registration && (
                        <div className="flex items-center gap-2">
                          <Tag size={14} className="text-gray-500" />
                          <span>{String(e.registration)}</span>
                        </div>
                      )}
                      {!!e.location && (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-500" />
                          <span>{String(e.location)}</span>
                        </div>
                      )}
                      {!!e.nextService && (
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-500" />
                          <span>Service: {String(e.nextService)}</span>
                        </div>
                      )}
                      {!!e.dailyRate && (
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-gray-500" />
                          <span>£{Number(e.dailyRate).toLocaleString()}/day</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEquipmentEdit(e);
                        }}
                        className="flex-1 px-3 py-1.5 text-xs bg-blue-900/30 text-blue-300 rounded hover:bg-blue-900/50 font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleDeleteEquipment(String(e.id));
                        }}
                        className="flex-1 px-3 py-1.5 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
              ]}
              onClearSelection={clearSelection}
            />
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          SERVICE SCHEDULE TAB
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'service' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display text-gray-100">Maintenance Timeline</h2>
            <button
              onClick={() => setShowServiceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Log Service
            </button>
          </div>

          {/* Service Schedule Table */}
          {serviceSchedule.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400 font-medium">No scheduled services</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50 border-b border-gray-700">
                  <tr>
                    {['Equipment', 'Type', 'Status', 'Next Service', 'Days Until', 'Mechanic'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {serviceSchedule.map((e) => {
                    const urgency = getServiceUrgency(String(e.nextService ?? ''));
                    const daysUntil = Math.ceil(
                      (new Date(String(e.nextService ?? '')).getTime() - Date.now()) / 86400000
                    );
                    const urgencyColor = {
                      overdue: 'text-red-400 font-display',
                      'due-soon': 'text-amber-400 font-medium',
                      ok: 'text-green-400'
                    }[urgency];

                    return (
                      <tr key={String(e.id ?? '')} className="hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-100 font-medium">{String(e.name ?? '')}</td>
                        <td className="px-4 py-3 text-gray-300">{String(e.type ?? '')}</td>
                        <td className="px-4 py-3">
                          <span className={statusColors[String(e.status ?? '')] || statusColors['Available']}>
                            {String(e.status ?? '')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-200">{String(e.nextService ?? '')}</td>
                        <td className={`px-4 py-3 ${urgencyColor}`}>{daysUntil}d</td>
                        <td className="px-4 py-3 text-gray-300">Mechanic TBD</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Service Log Table */}
          <div className="space-y-2 mt-8">
            <h3 className="text-sm font-display text-gray-100">Recent Service Log</h3>
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50 border-b border-gray-700">
                  <tr>
                    {['Equipment', 'Date', 'Type', 'Technician', 'Next Due'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {serviceLogs.map((row) => (
                    <tr key={String(row.id)} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-100 font-medium">{String(row.equipment_id ?? '').slice(0, 8)}</td>
                      <td className="px-4 py-3 text-gray-300">{String(row.date ?? '')}</td>
                      <td className="px-4 py-3 text-gray-300">{String(row.type ?? '')}</td>
                      <td className="px-4 py-3 text-gray-300">{String(row.technician ?? '')}</td>
                      <td className="px-4 py-3 text-gray-200">{String(row.next_due ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          HIRE MANAGEMENT TAB
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'hire' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display text-gray-100">Hired-In Plant</h2>
              <p className="text-xs text-gray-400 mt-1">Active hires: {activeHires.length} | Monthly projection: £{totalHireCost.toLocaleString()}</p>
            </div>
            <button
              onClick={() => setShowHireModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Hire
            </button>
          </div>

          {/* Hire Table */}
          {hireLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
              <Tag size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400 font-medium">No hired equipment</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50 border-b border-gray-700">
                  <tr>
                    {['Equipment', 'Hire Company', 'Daily Rate', 'Start Date', 'End Date', 'Project', 'Status', 'Total Cost'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {hireLogs.map((row) => {
                    const days = Math.ceil(
                      (new Date(String(row.end_date)).getTime() - new Date(String(row.start_date)).getTime()) / 86400000
                    );
                    const totalCost = Number(row.daily_rate) * days;
                    return (
                      <tr key={String(row.id)} className="hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-100 font-medium">{String(row.name ?? '')}</td>
                        <td className="px-4 py-3 text-gray-300">{String(row.company ?? '')}</td>
                        <td className="px-4 py-3 text-gray-100 font-medium">£{Number(row.daily_rate).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-300">{String(row.start_date ?? '')}</td>
                        <td className="px-4 py-3 text-gray-300">{String(row.end_date ?? '')}</td>
                        <td className="px-4 py-3 text-gray-300">{String(row.project ?? '')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            row.status === 'Active'
                                ? 'bg-green-900/30 text-green-300'
                                : 'bg-gray-700/50 text-gray-300'
                          }`}>
                            {String(row.status ?? '')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-100 font-mono">£{totalCost.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          UTILISATION TAB
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'utilisation' && (
        <div className="space-y-6">
          {/* Status Distribution Chart */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-display text-gray-100 mb-4">Fleet Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#d1d5db' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Utilisation Table */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-display text-gray-100">Equipment Utilisation - This Month</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 border-b border-gray-700">
                <tr>
                  {['Equipment', 'On Site Days', 'Idle Days', 'Maintenance Days', 'Utilisation %'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {utilisationData.map((row, idx) => {
                  const total = row.onSiteDays + row.idleDays + row.maintenanceDays;
                  const utilisation = Math.round((row.onSiteDays / total) * 100);
                  return (
                    <tr key={idx} className="hover:bg-gray-700/50">
                      <td className="px-6 py-3 text-gray-100 font-medium">{row.name}</td>
                      <td className="px-6 py-3 text-gray-300">{row.onSiteDays}d</td>
                      <td className="px-6 py-3 text-gray-300">{row.idleDays}d</td>
                      <td className="px-6 py-3 text-gray-300">{row.maintenanceDays}d</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${utilisation}%` }}
                            />
                          </div>
                          <span className="text-gray-200 font-medium w-10">{utilisation}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          EQUIPMENT DETAIL MODAL
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedEquipmentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-display text-gray-100">Equipment Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Name</p>
                  <p className="text-gray-100 font-display">{String(selectedEquipmentDetail.name ?? '')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Type</p>
                  <p className="text-gray-100">{String(selectedEquipmentDetail.type ?? '')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Registration</p>
                  <p className="text-gray-100">{String(selectedEquipmentDetail.registration ?? '—')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Status</p>
                  <span className={statusColors[String(selectedEquipmentDetail.status ?? '')] || statusColors['Available']}>
                    {String(selectedEquipmentDetail.status ?? '')}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Location</p>
                  <p className="text-gray-100">{String(selectedEquipmentDetail.location ?? '—')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Daily Rate</p>
                  <p className="text-gray-100 font-display">£{Number(selectedEquipmentDetail.dailyRate ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Next Service</p>
                  <p className="text-gray-100">{String(selectedEquipmentDetail.nextService ?? '—')}</p>
                </div>
              </div>

              {/* Service History */}
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-sm font-display text-gray-100 mb-4">Service History</h3>
                <div className="space-y-3">
                  {serviceLogs.slice(0, 10).map((item: AnyRow, idx: number) => (
                    <div key={String(item.id ?? idx)} className="flex items-start gap-3 pb-3 border-b border-gray-700">
                      <Calendar size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100">{String(item.type ?? '')}</p>
                        <p className="text-xs text-gray-400">{String(item.date ?? '')} • {String(item.technician ?? '')}</p>
                        <p className="text-xs text-gray-300 mt-1">{String(item.notes ?? '')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t border-gray-700">
                <button
                  onClick={() => {
                    openEquipmentEdit(selectedEquipmentDetail);
                    setShowDetailModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  Edit Equipment
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          ADD/EDIT EQUIPMENT MODAL
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {showEquipmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-display text-gray-100">
                {editingEquipment ? 'Edit Equipment' : 'Add Equipment'}
              </h2>
              <button
                onClick={() => setShowEquipmentModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEquipmentSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equipment Name *</label>
                  <input
                    required
                    value={equipmentForm.name}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <select
                    value={equipmentForm.type}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type…</option>
                    {EQUIPMENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Registration</label>
                  <input
                    value={equipmentForm.registration}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, registration: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={equipmentForm.status}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                  <input
                    value={equipmentForm.location}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Daily Rate (£)</label>
                  <input
                    type="number"
                    value={equipmentForm.dailyRate}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, dailyRate: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Next Service Date</label>
                  <input
                    type="date"
                    value={equipmentForm.nextService}
                    onChange={(e) => setEquipmentForm((f) => ({ ...f, nextService: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {editingEquipment ? 'Update' : 'Add'} Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          LOG SERVICE MODAL
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-display text-gray-100">Log Service</h2>
              <button
                onClick={() => setShowServiceModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleServiceSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equipment *</label>
                  <select
                    value={serviceForm.equipmentId}
                    onChange={(e) => setServiceForm((f) => ({ ...f, equipmentId: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select equipment…</option>
                    {equipment.map((e) => (
                      <option key={String(e.id ?? '')} value={String(e.id ?? '')}>
                        {String(e.name ?? '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Service Date *</label>
                  <input
                    type="date"
                    value={serviceForm.serviceDate}
                    onChange={(e) => setServiceForm((f) => ({ ...f, serviceDate: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Service Type</label>
                  <select
                    value={serviceForm.serviceType}
                    onChange={(e) => setServiceForm((f) => ({ ...f, serviceType: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SERVICE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Technician</label>
                  <input
                    value={serviceForm.technician}
                    onChange={(e) => setServiceForm((f) => ({ ...f, technician: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <textarea
                    rows={3}
                    value={serviceForm.notes}
                    onChange={(e) => setServiceForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Next Due Date</label>
                  <input
                    type="date"
                    value={serviceForm.nextDueDate}
                    onChange={(e) => setServiceForm((f) => ({ ...f, nextDueDate: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Log Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          ADD HIRE MODAL
          ══════════════════════════════════════════════════════════════════════════════════ */}
      {showHireModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-display text-gray-100">Add Hire Record</h2>
              <button
                onClick={() => setShowHireModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleHireSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equipment *</label>
                  <select
                    value={hireForm.equipmentId}
                    onChange={(e) => setHireForm((f) => ({ ...f, equipmentId: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select equipment…</option>
                    {equipment.map((e) => (
                      <option key={String(e.id ?? '')} value={String(e.id ?? '')}>
                        {String(e.name ?? '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hire Company</label>
                  <input
                    value={hireForm.hireCompany}
                    onChange={(e) => setHireForm((f) => ({ ...f, hireCompany: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Daily Rate (£)</label>
                  <input
                    type="number"
                    value={hireForm.dailyRate}
                    onChange={(e) => setHireForm((f) => ({ ...f, dailyRate: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={hireForm.startDate}
                    onChange={(e) => setHireForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
                  <input
                    type="date"
                    value={hireForm.endDate}
                    onChange={(e) => setHireForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Project</label>
                  <input
                    value={hireForm.project}
                    onChange={(e) => setHireForm((f) => ({ ...f, project: e.target.value }))}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHireModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Add Hire
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
export default React.memo(PlantEquipment);
