/**
 * BIM4D — 4D BIM time-linked construction sequence viewer.
 * Uses bim4dApi from services/api.ts.
 * Shows construction phases overlaid on a timeline scrubber with enhanced tabs.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Play, Pause, SkipBack, ChevronLeft, ChevronRight,
  Calendar, Clock, Layers, Plus, Eye, EyeOff, TrendingUp, AlertCircle, Download
} from 'lucide-react';
import { bim4dApi } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import clsx from 'clsx';

type BIM4DModel = {
  id: string;
  project_id: string;
  project_name?: string;
  name: string;
  description?: string;
  model_url?: string;
  thumbnail_url?: string;
  ifc_version?: string;
  simulation_start?: string;
  simulation_end?: string;
  phase?: string;
  status: string;
  task_count?: number;
};

type BIM4DTask = {
  id: string;
  model_id: string;
  task_id: string;
  task_name?: string;
  element_ids: string[];
  start_date?: string;
  end_date?: string;
  colour?: string;
  percent_complete?: number;
};

type TabType = '4d-viewer' | 'schedule' | 'tasks' | 'analytics';

type ScheduleTask = {
  id: string;
  name: string;
  duration: number;
  start: string;
  end: string;
  predecessors: string[];
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  isSummary?: boolean;
  isSubtask?: boolean;
  parentId?: string;
};

const PHASE_COLOURS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const PHASE_NAMES = [
  'Substructure', 'Frame', 'Core', 'Envelope', 'MEP Rough-In', 'Internal Fit-Out', 'External Works', 'Commissioning'
];

const generateMockSchedule = (): ScheduleTask[] => [
  { id: 'T001', name: 'Site Mobilisation & Setup', duration: 10, start: '2026-04-20', end: '2026-05-01', predecessors: [], status: 'completed', progress: 100 },
  { id: 'T002', name: 'Enabling Works & Demolition', duration: 15, start: '2026-05-02', end: '2026-05-20', predecessors: ['T001'], status: 'completed', progress: 100 },
  { id: 'T003', name: 'Substructure (Piles & Foundations)', duration: 28, start: '2026-05-21', end: '2026-06-23', predecessors: ['T002'], status: 'in-progress', progress: 65 },
  { id: 'T004', name: 'Ground Floors & Slabs', duration: 14, start: '2026-06-24', end: '2026-07-10', predecessors: ['T003'], status: 'pending', progress: 0 },
  { id: 'T005', name: 'Structural Frame (Floors 1-10)', duration: 42, start: '2026-07-11', end: '2026-08-25', predecessors: ['T004'], status: 'pending', progress: 0 },
  { id: 'T006', name: 'Core Works (Stairs/Lift Shaft)', duration: 35, start: '2026-07-15', end: '2026-08-20', predecessors: ['T004'], status: 'pending', progress: 0, parentId: 'T005' },
  { id: 'T007', name: 'Facade & Envelope Installation', duration: 45, start: '2026-08-21', end: '2026-10-10', predecessors: ['T005'], status: 'pending', progress: 0 },
  { id: 'T008', name: 'MEP Rough-In (All Services)', duration: 40, start: '2026-08-26', end: '2026-10-10', predecessors: ['T005'], status: 'pending', progress: 0 },
  { id: 'T009', name: 'Internal Partitions & Dry Lining', duration: 30, start: '2026-10-11', end: '2026-11-15', predecessors: ['T007', 'T008'], status: 'pending', progress: 0, parentId: 'T008' },
  { id: 'T010', name: 'Finishes (Flooring, Walls, Ceiling)', duration: 35, start: '2026-11-16', end: '2026-12-31', predecessors: ['T009'], status: 'pending', progress: 0 },
  { id: 'T011', name: 'MEP Commissioning & Testing', duration: 20, start: '2026-12-15', end: '2027-01-10', predecessors: ['T010'], status: 'pending', progress: 0 },
  { id: 'T012', name: 'Snagging & Handover Prep', duration: 14, start: '2027-01-11', end: '2027-01-25', predecessors: ['T011'], status: 'pending', progress: 0 },
  { id: 'T013', name: 'External Works & Landscaping', duration: 25, start: '2026-10-01', end: '2026-11-30', predecessors: ['T007'], status: 'pending', progress: 0 },
  { id: 'T014', name: 'Final Inspection & Handover', duration: 5, start: '2027-01-26', end: '2027-01-31', predecessors: ['T012', 'T013'], status: 'pending', progress: 0 },
];

export function BIM4D() {
  const [models, setModels] = useState<BIM4DModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<BIM4DModel | null>(null);
  const [tasks, setTasks] = useState<BIM4DTask[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleTask[]>([]);
  const [, setTasksLoading] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('4d-viewer');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [visiblePhases, setVisiblePhases] = useState<Set<number>>(new Set(PHASE_NAMES.map((_, i) => i)));
  const [cameraView, setCameraView] = useState<'top' | 'front' | 'side' | 'iso'>('iso');
  const [form, setForm] = useState({
    name: '', project_id: 'demo-project', description: '',
    model_url: '', simulation_start: '', simulation_end: '',
  });

  const fetchModels = useCallback(async () => {
    try {
      const res = await bim4dApi.getProjectModels('demo-project');
      const data = Array.isArray(res.data) ? res.data : [];
      setModels(data);
      if (data.length > 0) {
        setSelectedModel(data[0]);
        setScheduleData(generateMockSchedule());
      }
    } catch {
      setModels([]);
      setScheduleData(generateMockSchedule());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  useEffect(() => {
    if (!selectedModel) return;
    setTasksLoading(true);
    bim4dApi.getTasks(selectedModel.id)
      .then(res => setTasks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [selectedModel]);

  // Auto-play animation
  useEffect(() => {
    if (!isPlaying || tasks.length === 0) return;
    const interval = setInterval(() => {
      setCurrentPhaseIndex(i => (i + 1) % Math.max(tasks.length, 1));
    }, 3000 / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, tasks.length, playbackSpeed]);

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await bim4dApi.create({
        project_id: form.project_id,
        name: form.name,
        description: form.description,
        model_url: form.model_url || undefined,
        simulation_start: form.simulation_start || undefined,
        simulation_end: form.simulation_end || undefined,
      });
      toast.success('4D model created');
      setShowModelModal(false);
      fetchModels();
    } catch {
      toast.error('Failed to create 4D model');
    }
  };

  const fmtDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const totalDays = selectedModel?.simulation_start && selectedModel?.simulation_end
    ? Math.round((new Date(selectedModel.simulation_end).getTime() - new Date(selectedModel.simulation_start).getTime()) / 86400000)
    : 0;

  const getTaskPosition = (task: BIM4DTask) => {
    if (!selectedModel?.simulation_start || !selectedModel?.simulation_end || !task.start_date) return { left: 0, width: 0 };
    const start = new Date(selectedModel.simulation_start).getTime();
    const end = new Date(selectedModel.simulation_end).getTime();
    const taskStart = new Date(task.start_date).getTime();
    const taskEnd = task.end_date ? new Date(task.end_date).getTime() : taskStart;
    const total = end - start;
    const left = ((taskStart - start) / total) * 100;
    const width = ((taskEnd - taskStart) / total) * 100;
    return { left: Math.max(0, left), width: Math.min(100 - left, width) };
  };

  const getPhaseColour = (index: number) => PHASE_COLOURS[index % PHASE_COLOURS.length];

  const togglePhaseVisibility = (phaseIndex: number) => {
    const newSet = new Set(visiblePhases);
    if (newSet.has(phaseIndex)) newSet.delete(phaseIndex);
    else newSet.add(phaseIndex);
    setVisiblePhases(newSet);
  };

  const getTaskDateRange = (start: string, end: string): number => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.round((e - s) / 86400000);
  };

  const getSchedulePosition = (taskStart: string, projectStart: string, projectEnd: string): { left: number; width: number } => {
    const pStart = new Date(projectStart).getTime();
    const pEnd = new Date(projectEnd).getTime();
    const tStart = new Date(taskStart).getTime();
    const total = pEnd - pStart;
    const left = ((tStart - pStart) / total) * 100;
    return { left: Math.max(0, left), width: 5 };
  };

  const Tabs = () => (
    <div className="flex gap-2 border-b border-gray-800 overflow-x-auto">
      {[
        { id: '4d-viewer', label: '4D Viewer' },
        { id: 'schedule', label: 'Schedule' },
        { id: 'tasks', label: 'Tasks' },
        { id: 'analytics', label: 'Analytics' },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabType)}
          className={clsx(
            'px-4 py-3 font-medium text-sm transition-all border-b-2 whitespace-nowrap',
            activeTab === tab.id
              ? 'border-indigo-500 text-indigo-500'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <ModuleBreadcrumbs currentModule="bim-4d" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Box size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display text-white">4D BIM</h1>
              <p className="text-sm text-gray-400">Time-linked construction sequence viewer</p>
            </div>
          </div>
          <button
            onClick={() => setShowModelModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus size={16} /> New 4D Model
          </button>
        </div>

        {/* Model Selector */}
        {models.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {models.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m); setCurrentPhaseIndex(0); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedModel?.id === m.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}

        {Tabs()}

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
        ) : models.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No 4D models configured"
            description="Create a 4D BIM model to view the construction sequence timeline."
          />
        ) : (
          <>
            {activeTab === '4d-viewer' && selectedModel && (
              <>
                {/* Model Info */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      {selectedModel.thumbnail_url ? (
                        <img src={selectedModel.thumbnail_url} alt={selectedModel.name} className="w-16 h-16 rounded-lg object-cover bg-gray-800" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <Box size={24} className="text-indigo-400" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-lg font-semibold text-white">{selectedModel.name}</h2>
                        <p className="text-sm text-gray-400">{selectedModel.description || 'No description'}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          {selectedModel.simulation_start && (
                            <span className="flex items-center gap-1"><Calendar size={10} /> {fmtDate(selectedModel.simulation_start)}</span>
                          )}
                          {totalDays > 0 && (
                            <span className="flex items-center gap-1"><Clock size={10} /> {totalDays} days</span>
                          )}
                          {selectedModel.task_count !== undefined && (
                            <span className="flex items-center gap-1"><Layers size={10} /> {selectedModel.task_count} tasks</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPhaseIndex(0)}
                        className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                        title="Reset"
                      >
                        <SkipBack size={16} />
                      </button>
                      <button
                        onClick={() => setCurrentPhaseIndex(i => Math.max(0, i - 1))}
                        disabled={currentPhaseIndex === 0}
                        className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setIsPlaying(p => !p)}
                        className={`p-2 rounded-lg transition-colors ${isPlaying ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}
                      >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        onClick={() => setCurrentPhaseIndex(i => Math.min(tasks.length - 1, i + 1))}
                        disabled={currentPhaseIndex >= tasks.length - 1}
                        className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <select
                        value={playbackSpeed}
                        onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                        className="px-2 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded text-xs"
                      >
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={4}>4x</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Phase Selector Sidebar */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-1">
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <Layers size={14} /> Construction Phases
                      </h3>
                      <div className="space-y-2">
                        {PHASE_NAMES.map((phase, i) => (
                          <button
                            key={i}
                            onClick={() => togglePhaseVisibility(i)}
                            className={clsx('w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2',
                              visiblePhases.has(i) ? 'bg-gray-800' : 'bg-gray-800/50 opacity-50'
                            )}
                          >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getPhaseColour(i) }} />
                            <span className="text-gray-300 flex-1">{phase}</span>
                            {visiblePhases.has(i) ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3 space-y-6">
                    {/* Camera Presets */}
                    <div className="flex gap-2">
                      {[
                        { id: 'top', label: 'Top' },
                        { id: 'front', label: 'Front' },
                        { id: 'side', label: 'Side' },
                        { id: 'iso', label: 'Isometric' },
                      ].map((view) => (
                        <button
                          key={view.id}
                          onClick={() => setCameraView(view.id as typeof cameraView)}
                          className={clsx('px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                            cameraView === view.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          )}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>

                    {/* Timeline */}
                    {tasks.length > 0 && (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <div className="p-4 border-b border-gray-800">
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Layers size={14} className="text-indigo-400" />
                            Construction Timeline — Phase {currentPhaseIndex + 1} of {tasks.length}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {tasks[currentPhaseIndex]?.task_name || 'Unknown phase'}
                          </p>
                        </div>

                        {/* Gantt Bars */}
                        <div className="relative p-6">
                          {/* Phase labels */}
                          <div className="flex gap-2 mb-4 flex-wrap">
                            {tasks.map((task, i) => {
                              const colour = task.colour || getPhaseColour(i);
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => setCurrentPhaseIndex(i)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    currentPhaseIndex === i
                                      ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900'
                                      : 'opacity-60 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: colour + '30', color: colour, borderColor: colour + '60' }}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: colour }}
                                  />
                                  {task.task_name || `Phase ${i + 1}`}
                                </button>
                              );
                            })}
                          </div>

                          {/* Gantt bars */}
                          <div className="relative h-12 bg-gray-800/50 rounded-lg overflow-hidden">
                            {/* Grid lines */}
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                className="absolute top-0 bottom-0 border-l border-gray-700/50"
                                style={{ left: `${i * 10}%` }}
                              />
                            ))}
                            {/* Task bars */}
                            {tasks.map((task, i) => {
                              const pos = getTaskPosition(task);
                              const colour = task.colour || getPhaseColour(i);
                              const isActive = currentPhaseIndex === i;
                              return (
                                <div
                                  key={task.id}
                                  className={`absolute top-2 bottom-2 rounded transition-all duration-300 cursor-pointer hover:brightness-110 ${
                                    isActive ? 'ring-2 ring-white' : ''
                                  }`}
                                  style={{
                                    left: `${pos.left}%`,
                                    width: `${Math.max(pos.width, 2)}%`,
                                    backgroundColor: colour,
                                    opacity: isActive ? 1 : 0.5,
                                  }}
                                  onClick={() => setCurrentPhaseIndex(i)}
                                  title={`${task.task_name || 'Phase'}: ${task.start_date || ''} → ${task.end_date || ''}`}
                                />
                              );
                            })}
                          </div>

                          {/* Date labels */}
                          {selectedModel && (
                            <div className="flex justify-between text-xs text-gray-600 mt-1 px-1">
                              <span>{fmtDate(selectedModel.simulation_start)}</span>
                              <span>{fmtDate(selectedModel.simulation_end)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Phase Detail */}
                    {tasks.length > 0 && currentPhaseIndex < tasks.length && (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                        <div className="flex items-start gap-3 mb-4">
                          <div
                            className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                            style={{ backgroundColor: tasks[currentPhaseIndex].colour || getPhaseColour(currentPhaseIndex) }}
                          />
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {tasks[currentPhaseIndex].task_name || `Phase ${currentPhaseIndex + 1}`}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>{fmtDate(tasks[currentPhaseIndex].start_date)}</span>
                              <span>→</span>
                              <span>{fmtDate(tasks[currentPhaseIndex].end_date)}</span>
                              {tasks[currentPhaseIndex].element_ids.length > 0 && (
                                <span>{tasks[currentPhaseIndex].element_ids.length} elements</span>
                              )}
                            </div>
                          </div>
                          {tasks[currentPhaseIndex].percent_complete !== undefined && (
                            <div className="ml-auto flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${tasks[currentPhaseIndex].percent_complete}%`,
                                    backgroundColor: tasks[currentPhaseIndex].colour || getPhaseColour(currentPhaseIndex),
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400">{tasks[currentPhaseIndex].percent_complete}%</span>
                            </div>
                          )}
                        </div>

                        {selectedModel?.model_url && (
                          <div className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-center h-48">
                            <div className="text-center">
                              <Box size={32} className="mx-auto mb-2 text-gray-600" />
                              <p className="text-sm text-gray-500">IFC Viewer — connect to BIMViewer for full 3D view</p>
                              <a href={selectedModel.model_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline mt-1 block">
                                Open model file
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Task Table */}
                    {tasks.length > 0 && (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <div className="p-4 border-b border-gray-800">
                          <h3 className="text-sm font-semibold text-white">All Phases</h3>
                        </div>
                        <div className="cb-table-scroll touch-pan-x">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-800/50 border-b border-gray-800">
                              <tr>
                                {['Phase', 'Task Name', 'Start', 'End', 'Duration', 'Elements', 'Progress'].map(h => (
                                  <th key={h} className="text-left px-4 py-2.5 text-xs font-display text-gray-500 tracking-widest uppercase">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                              {tasks.map((task, i) => {
                                const days = task.start_date && task.end_date
                                  ? Math.round((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / 86400000)
                                  : null;
                                const colour = task.colour || getPhaseColour(i);
                                return (
                                  <tr
                                    key={task.id}
                                    className={`hover:bg-gray-800/30 cursor-pointer ${currentPhaseIndex === i ? 'bg-gray-800/50' : ''}`}
                                    onClick={() => setCurrentPhaseIndex(i)}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded" style={{ backgroundColor: colour }} />
                                        <span className="text-gray-400">{i + 1}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-white font-medium">{task.task_name || '—'}</td>
                                    <td className="px-4 py-3 text-gray-400">{fmtDate(task.start_date)}</td>
                                    <td className="px-4 py-3 text-gray-400">{fmtDate(task.end_date)}</td>
                                    <td className="px-4 py-3 text-gray-400">{days !== null ? `${days}d` : '—'}</td>
                                    <td className="px-4 py-3 text-gray-400">{task.element_ids.length}</td>
                                    <td className="px-4 py-3">
                                      {task.percent_complete !== undefined ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${task.percent_complete}%`, backgroundColor: colour }} />
                                          </div>
                                          <span className="text-xs text-gray-400">{task.percent_complete}%</span>
                                        </div>
                                      ) : <span className="text-gray-600">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'schedule' && selectedModel && (
              <div className="space-y-6">
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="text-lg font-display text-white">Project Schedule</h3>
                    <button className="btn btn-secondary text-sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </button>
                  </div>
                  <div className="cb-table-scroll touch-pan-x">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/50 border-b border-gray-800">
                        <tr>
                          {['Task ID', 'Task Name', 'Duration', 'Start', 'End', 'Predecessors', 'Status', 'Progress'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-display text-gray-500 tracking-widest uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {scheduleData.map((task) => {
                          const statusColor = task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            task.status === 'in-progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-400';
                          const isCritical = task.predecessors.length > 0 && task.status !== 'completed';

                          return (
                            <tr key={task.id} className={clsx('hover:bg-gray-800/30', isCritical ? 'bg-red-500/5 border-l-2 border-l-red-500' : '')}>
                              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{task.id}</td>
                              <td className="px-4 py-3">
                                <span className={clsx('text-white font-medium', task.isSummary && 'font-bold')}>{task.name}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-400">{task.duration}d</td>
                              <td className="px-4 py-3 text-gray-400">{fmtDate(task.start)}</td>
                              <td className="px-4 py-3 text-gray-400">{fmtDate(task.end)}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{task.predecessors.length > 0 ? task.predecessors.join(', ') : '—'}</td>
                              <td className="px-4 py-3">
                                <span className={clsx('px-2 py-1 rounded text-xs font-medium', statusColor)}>
                                  {task.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${task.progress}%`, backgroundColor: task.progress === 100 ? '#10b981' : '#f59e0b' }} />
                                  </div>
                                  <span className="text-xs text-gray-400">{task.progress}%</span>
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

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                  <h3 className="text-lg font-display text-white mb-4">Task Details</h3>
                  <div className="cb-table-scroll touch-pan-x">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/50 border-b border-gray-800">
                        <tr>
                          {['Task Name', 'Phase', 'Planned Start', 'Planned End', '% Complete', 'Resources', 'Status'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-display text-gray-500 tracking-widest uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {scheduleData.slice(0, 10).map((task) => (
                          <tr key={task.id} className="hover:bg-gray-800/30 cursor-pointer">
                            <td className="px-4 py-3 text-white font-medium">{task.name}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">Phase {scheduleData.indexOf(task) + 1}</td>
                            <td className="px-4 py-3 text-gray-400">{fmtDate(task.start)}</td>
                            <td className="px-4 py-3 text-gray-400">{fmtDate(task.end)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${task.progress}%`, backgroundColor: '#3b82f6' }} />
                                </div>
                                <span className="text-xs text-gray-400">{task.progress}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">3-5</td>
                            <td className="px-4 py-3">
                              <span className={clsx('px-2 py-1 rounded text-xs font-medium',
                                task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                task.status === 'in-progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-400'
                              )}>
                                {task.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card p-5 text-center">
                    <p className="text-xs text-gray-400 uppercase mb-2">Schedule Performance Index</p>
                    <p className="text-3xl font-display text-emerald-400">1.05</p>
                    <p className="text-xs text-gray-500 mt-1">On track</p>
                  </div>
                  <div className="card p-5 text-center">
                    <p className="text-xs text-gray-400 uppercase mb-2">Cost Performance Index</p>
                    <p className="text-3xl font-display text-emerald-400">0.98</p>
                    <p className="text-xs text-gray-500 mt-1">Within budget</p>
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-lg font-display text-white mb-4">Schedule Progress (S-Curve)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={[
                        { month: 'Apr', planned: 8, actual: 10 },
                        { month: 'May', planned: 18, actual: 19 },
                        { month: 'Jun', planned: 30, actual: 31 },
                        { month: 'Jul', planned: 45, actual: 42 },
                        { month: 'Aug', planned: 60, actual: 58 },
                        { month: 'Sep', planned: 72, actual: 68 },
                        { month: 'Oct', planned: 82, actual: 78 },
                        { month: 'Nov', planned: 92, actual: 85 },
                        { month: 'Dec', planned: 100, actual: 90 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                        <Legend />
                        <Area type="monotone" dataKey="planned" stroke="#9ca3af" fill="none" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-lg font-display text-white mb-4">Phase Completion %</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { phase: 'Substructure', complete: 65 },
                        { phase: 'Frame', complete: 0 },
                        { phase: 'Core', complete: 0 },
                        { phase: 'Envelope', complete: 0 },
                        { phase: 'MEP', complete: 0 },
                        { phase: 'Fit-Out', complete: 0 },
                        { phase: 'External', complete: 0 },
                        { phase: 'Commission', complete: 0 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="phase" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                        <Bar dataKey="complete" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-lg font-display text-white mb-4">Upcoming 4 Weeks</h3>
                  <div className="space-y-3">
                    {scheduleData.slice(3, 7).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-white">{task.name}</p>
                          <p className="text-xs text-gray-400">{fmtDate(task.start)} - {fmtDate(task.end)}</p>
                        </div>
                        <span className={clsx('px-2 py-1 rounded text-xs font-medium',
                          task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          task.status === 'in-progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-400'
                        )}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="text-lg font-display text-white mb-4 flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-400" />
                    Risk Alerts
                  </h3>
                  <div className="space-y-2">
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-400 font-medium">Substructure - 3 days behind schedule</p>
                      <p className="text-xs text-gray-400 mt-1">Mitigation: increase labour resources</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-sm text-amber-400 font-medium">MEP rough-in at risk due to Material delays</p>
                      <p className="text-xs text-gray-400 mt-1">Action: expedite supplier orders</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Create Model Modal */}
        {showModelModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">New 4D Model</h2>
                <button onClick={() => setShowModelModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><Plus size={18} /></button>
              </div>
              <form onSubmit={handleCreateModel} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Model Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Canary Wharf Phase 1"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project ID *</label>
                  <input
                    value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    placeholder="proj_xxxxx"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Sim Start</label>
                    <input
                      type="date"
                      value={form.simulation_start}
                      onChange={e => setForm(f => ({ ...f, simulation_start: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Sim End</label>
                    <input
                      type="date"
                      value={form.simulation_end}
                      onChange={e => setForm(f => ({ ...f, simulation_end: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModelModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default BIM4D;
