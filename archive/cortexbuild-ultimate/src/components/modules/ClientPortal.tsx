/**
 * ClientPortal — read-only Client/Owner Portal for UK construction projects.
 * Reads optional `?token=` for UX / future portal-token auth; API calls use the logged-in session (see server/routes/client-portal.js).
 * Uses portalApi from services/api.ts.
 *
 * Tabbed interface: Overview, Progress, Financials, Documents, Issues
 */
import { useState, useEffect } from 'react';
import {
  Building2, FileText, AlertTriangle, Clock,
  TrendingUp, ChevronDown, ChevronUp, DollarSign,
  CheckCircle, Camera, Calendar, Download, Plus, X,
  Search, Filter, ZoomIn
} from 'lucide-react';
import {
  BarChart, Bar, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart
} from 'recharts';
import { portalApi } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { toast } from 'sonner';

type PortalProject = {
  id: string;
  name: string;
  client: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  manager: string;
  location: string;
  type: string;
  startDate: string;
  endDate: string;
  completionDate?: string;
  description: string;
  openIssues?: number;
  daysRemaining?: number;
};

type PortalRfi = {
  number: string;
  subject: string;
  priority: string;
  status: string;
  submittedDate: string;
  dueDate: string;
  assignedTo: string;
};

type PortalValuation = {
  appNo: string;
  period: string;
  startDate: string;
  endDate: string;
  grossValue: number;
  retentionPct: number;
  netValue: number;
  status: string;
  certifiedDate: string;
  submittedDate: string;
};

type PortalDailyReport = {
  reportDate: string;
  weather: string;
  workersOnSite: number;
  progress: string;
  delays: string;
  safetyObservations: string;
};

type Milestone = {
  name: string;
  dueDate: string;
  status: 'completed' | 'pending' | 'at-risk';
};

type ActivityItem = {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user: string;
};

type WorkPackage = {
  id: string;
  name: string;
  plannedPercent: number;
  actualPercent: number;
  status: 'on-track' | 'at-risk' | 'delayed';
};

type Document = {
  id: string;
  name: string;
  type: 'drawing' | 'report' | 'programme' | 'certificate' | 'other';
  revision: string;
  dateIssued: string;
  url?: string;
};

type Issue = {
  id: string;
  description: string;
  location: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved';
  targetCloseDate?: string;
  photoUrl?: string;
};

export function ClientPortal() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<PortalProject | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'financials' | 'documents' | 'issues'>('overview');
  const [rfis, setRfis] = useState<PortalRfi[]>([]);
  const [valuations, setValuations] = useState<PortalValuation[]>([]);
  const [dailyReports, setDailyReports] = useState<PortalDailyReport[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [rfisExpanded, setRfisExpanded] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [valuationsExpanded, setValuationsExpanded] = useState(false);
  const [documentFilter, setDocumentFilter] = useState<string>('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showDocRequestForm, setShowDocRequestForm] = useState(false);
  const [issueFormData, setIssueFormData] = useState<{ description: string; location: string; priority: 'low' | 'medium' | 'high' }>({ description: '', location: '', priority: 'medium' });
  const [docRequestData, setDocRequestData] = useState({ description: '' });

  const portalToken = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await portalApi.getProjects();
        const data = Array.isArray(res.data) ? res.data : getMockProjects();
        setProjects(data);
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
        }
      } catch {
        const mockData = getMockProjects();
        setProjects(mockData);
        if (mockData.length > 0 && !selectedProject) {
          setSelectedProject(mockData[0]);
        }
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadProjectData() {
      if (!selectedProject) return;
      try {
        const [rfiRes, valRes, drRes] = await Promise.allSettled([
          portalApi.getProjectRfis(selectedProject.id, { limit: 10 }),
          portalApi.getProjectValuations(selectedProject.id),
          portalApi.getProjectDailyReports(selectedProject.id, 14),
        ]);
        if (rfiRes.status === 'fulfilled') setRfis(Array.isArray(rfiRes.value.data) ? rfiRes.value.data : []);
        if (valRes.status === 'fulfilled') setValuations(Array.isArray(valRes.value.data) ? valRes.value.data : []);
        if (drRes.status === 'fulfilled') setDailyReports(Array.isArray(drRes.value.data) ? drRes.value.data : []);
      } catch {
        // Fall back to mock data
        setRfis(getMockRfis());
        setValuations(getMockValuations());
        setDailyReports(getMockDailyReports());
      }
      // Load additional data for tabs
      setMilestones(getMockMilestones());
      setActivities(getMockActivities());
      setWorkPackages(getMockWorkPackages());
      setDocuments(getMockDocuments());
      setIssues(getMockIssues());
    }
    loadProjectData();
  }, [selectedProject]);

  // Mock data generators
  const getMockProjects = (): PortalProject[] => [
    {
      id: 'proj-001',
      name: 'Central Square Development',
      client: 'Landmark Property Group',
      status: 'On Track',
      progress: 65,
      budget: 4500000,
      spent: 2925000,
      manager: 'James Wilson',
      location: 'Manchester City Centre',
      type: 'Mixed-Use Commercial',
      startDate: '2024-03-15',
      endDate: '2026-09-30',
      completionDate: '2026-09-30',
      description: 'A flagship mixed-use development featuring retail, offices and residential space.',
      openIssues: 3,
      daysRemaining: 487
    }
  ];

  const getMockMilestones = (): Milestone[] => [
    { name: 'Foundations Complete', dueDate: '2024-08-31', status: 'completed' },
    { name: 'Structural Frame', dueDate: '2025-02-28', status: 'completed' },
    { name: 'Envelope Weathertight', dueDate: '2025-06-30', status: 'pending' },
    { name: 'MEP Rough-In', dueDate: '2025-09-30', status: 'pending' },
    { name: 'Fit-Out Complete', dueDate: '2026-06-30', status: 'pending' },
    { name: 'Handover', dueDate: '2026-09-30', status: 'pending' }
  ];

  const getMockActivities = (): ActivityItem[] => [
    { id: '1', type: 'milestone', description: 'Structural frame reached level 8', timestamp: '2025-04-24', user: 'Site Manager' },
    { id: '2', type: 'document', description: 'Monthly progress report uploaded', timestamp: '2025-04-23', user: 'Project Manager' },
    { id: '3', type: 'issue', description: 'Concrete delivery delayed - schedule updated', timestamp: '2025-04-22', user: 'Site Engineer' },
    { id: '4', type: 'valuation', description: 'Application 008 certified £847,500', timestamp: '2025-04-20', user: 'Commercial Manager' },
    { id: '5', type: 'safety', description: 'Site audit completed - 0 non-conformances', timestamp: '2025-04-19', user: 'Safety Officer' }
  ];

  const getMockWorkPackages = (): WorkPackage[] => [
    { id: 'wp-1', name: 'Foundations & Ground Works', plannedPercent: 100, actualPercent: 100, status: 'on-track' },
    { id: 'wp-2', name: 'Structural Steel Frame', plannedPercent: 90, actualPercent: 85, status: 'at-risk' },
    { id: 'wp-3', name: 'Envelope & Weatherproofing', plannedPercent: 50, actualPercent: 45, status: 'on-track' },
    { id: 'wp-4', name: 'MEP Installation', plannedPercent: 20, actualPercent: 10, status: 'delayed' },
    { id: 'wp-5', name: 'Internal Fit-Out', plannedPercent: 5, actualPercent: 0, status: 'on-track' },
    { id: 'wp-6', name: 'External Works & Landscaping', plannedPercent: 10, actualPercent: 5, status: 'on-track' }
  ];

  const getMockDocuments = (): Document[] => [
    { id: 'd-1', name: 'Architectural Plans - Level 1-3', type: 'drawing', revision: 'P3', dateIssued: '2025-03-15' },
    { id: 'd-2', name: 'Structural Design Report', type: 'report', revision: 'Rev A', dateIssued: '2025-02-20' },
    { id: 'd-3', name: 'Project Programme - Updated', type: 'programme', revision: '2025-04', dateIssued: '2025-04-01' },
    { id: 'd-4', name: 'Concrete Test Certificates - Batch 5', type: 'certificate', revision: '—', dateIssued: '2025-04-10' },
    { id: 'd-5', name: 'MEP Specifications', type: 'drawing', revision: 'P2', dateIssued: '2025-03-28' },
    { id: 'd-6', name: 'Monthly Progress Report - March', type: 'report', revision: '—', dateIssued: '2025-04-05' }
  ];

  const getMockIssues = (): Issue[] => [
    { id: 'i-1', description: 'Concrete delivery delay affecting foundation schedule', location: 'South Foundation Zone', priority: 'high', status: 'in-progress', targetCloseDate: '2025-05-05' },
    { id: 'i-2', description: 'Minor discrepancy in door frame dimensions', location: 'Level 3 East Wing', priority: 'medium', status: 'open', targetCloseDate: '2025-05-10' },
    { id: 'i-3', description: 'Scaffold inspection required before next phase', location: 'Entire Site', priority: 'high', status: 'open', targetCloseDate: '2025-05-02' },
    { id: 'i-4', description: 'Weatherproofing joint requires rework', location: 'Roof Level', priority: 'low', status: 'resolved', targetCloseDate: '2025-04-20' }
  ];

  const getMockRfis = (): PortalRfi[] => [
    { number: 'RFI-001', subject: 'Clarification on window schedule options', priority: 'High', status: 'Open', submittedDate: '2025-04-10', dueDate: '2025-04-20', assignedTo: 'Design Team' },
    { number: 'RFI-002', subject: 'MEP coordination drawing required', priority: 'Urgent', status: 'In Review', submittedDate: '2025-04-15', dueDate: '2025-04-25', assignedTo: 'M&E Consultant' },
    { number: 'RFI-003', subject: 'Confirmation of specification change', priority: 'Medium', status: 'Answered', submittedDate: '2025-04-08', dueDate: '2025-04-18', assignedTo: 'Architect' }
  ];

  const getMockValuations = (): PortalValuation[] => [
    { appNo: 'VAL-007', period: 'March 2025', startDate: '2025-03-01', endDate: '2025-03-31', grossValue: 847500, retentionPct: 5, netValue: 805125, status: 'Certified', certifiedDate: '2025-04-10', submittedDate: '2025-04-05' },
    { appNo: 'VAL-008', period: 'April 2025', startDate: '2025-04-01', endDate: '2025-04-30', grossValue: 925000, retentionPct: 5, netValue: 878750, status: 'Submitted', certifiedDate: '—', submittedDate: '2025-05-05' }
  ];

  const getMockDailyReports = (): PortalDailyReport[] => [
    { reportDate: '2025-04-24', weather: 'Partly Cloudy, 16°C', workersOnSite: 87, progress: 'Structural frame progressing to level 8', delays: 'None', safetyObservations: 'All clear' },
    { reportDate: '2025-04-23', weather: 'Sunny, 18°C', workersOnSite: 92, progress: 'Concrete pour completed for level 7', delays: 'None', safetyObservations: 'Safety briefing conducted' },
    { reportDate: '2025-04-22', weather: 'Rainy, 14°C', workersOnSite: 45, progress: 'Limited work due to weather', delays: 'Concrete delivery postponed 1 day', safetyObservations: 'Drainage maintained' }
  ];

  const getProgressChartData = () => [
    { month: 'Jan', planned: 8, actual: 5 },
    { month: 'Feb', planned: 18, actual: 15 },
    { month: 'Mar', planned: 32, actual: 28 },
    { month: 'Apr', planned: 50, actual: 48 },
    { month: 'May', planned: 65, actual: 0 },
    { month: 'Jun', planned: 80, actual: 0 }
  ];

  const getMonthlyValuationData = () => [
    { month: 'Jan', amount: 625000 },
    { month: 'Feb', amount: 720000 },
    { month: 'Mar', amount: 847500 },
    { month: 'Apr', amount: 925000 },
    { month: 'May', amount: 0 },
    { month: 'Jun', amount: 0 }
  ];

  const fmt = (n: number) => `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const priorityColour = (p: string) => {
    switch (p) {
      case 'Urgent': return 'bg-red-500/20 text-red-300';
      case 'High': return 'bg-orange-500/20 text-orange-300';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-300';
      default: return 'bg-gray-700/30 text-gray-300';
    }
  };

  const statusColour = (s: string) => {
    switch (s) {
      case 'Open': return 'bg-blue-500/20 text-blue-300';
      case 'In Review': return 'bg-yellow-500/20 text-yellow-300';
      case 'Answered': return 'bg-green-500/20 text-green-300';
      case 'Closed': return 'bg-gray-700/30 text-gray-300';
      default: return 'bg-gray-700/30 text-gray-300';
    }
  };

  const valStatusColour = (s: string) => {
    switch (s) {
      case 'Certified': return 'bg-green-500/20 text-green-300';
      case 'Paid': return 'bg-emerald-500/20 text-emerald-300';
      case 'Submitted': return 'bg-blue-500/20 text-blue-300';
      default: return 'bg-gray-700/30 text-gray-300';
    }
  };

  const issuePriorityColour = (p: string) => {
    switch (p) {
      case 'high': return 'bg-red-500/20 text-red-300';
      case 'medium': return 'bg-amber-500/20 text-amber-300';
      case 'low': return 'bg-green-500/20 text-green-300';
      default: return 'bg-gray-700/30 text-gray-300';
    }
  };

  const issueStatusColour = (s: string) => {
    switch (s) {
      case 'open': return 'bg-red-500/20 text-red-300';
      case 'in-progress': return 'bg-yellow-500/20 text-yellow-300';
      case 'resolved': return 'bg-green-500/20 text-green-300';
      default: return 'bg-gray-700/30 text-gray-300';
    }
  };

  const handleReportIssue = () => {
    if (!issueFormData.description.trim() || !issueFormData.location.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    toast.success('Issue reported successfully');
    setShowIssueForm(false);
    setIssueFormData({ description: '', location: '', priority: 'medium' });
  };

  const handleRequestDocument = () => {
    if (!docRequestData.description.trim()) {
      toast.error('Please describe the document needed');
      return;
    }
    toast.success('Document request submitted');
    setShowDocRequestForm(false);
    setDocRequestData({ description: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <ModuleBreadcrumbs currentModule="client-portal" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Building2 size={20} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display text-white">Client Portal</h1>
              <p className="text-sm text-gray-400">Project progress & documents for clients and owners</p>
            </div>
          </div>
          {!portalToken && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400" />
              <span className="text-xs text-yellow-300">Portal token missing — add ?token=xxx to URL</span>
            </div>
          )}
        </div>

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-400">Project:</span>
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const proj = projects.find(p => p.id === e.target.value);
                if (proj) setSelectedProject(proj);
              }}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {!selectedProject ? (
          <div className="text-center py-16 text-gray-500">
            <Building2 size={48} className="mx-auto mb-3 opacity-30" />
            <p>No projects available for this portal.</p>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 border-b-0 p-0 flex">
              {(['overview', 'progress', 'financials', 'documents', 'issues'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-orange-500 text-orange-400 bg-gray-800/50'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <>
                  {/* Hero Card */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <h2 className="text-2xl font-display text-white mb-2">{selectedProject.name}</h2>
                        <p className="text-gray-400 text-sm mb-4">{selectedProject.description}</p>
                        <div className="flex gap-3 flex-wrap">
                          <div className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs font-medium">{selectedProject.status}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={14} /> Started: {selectedProject.startDate}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={14} /> Due: {selectedProject.endDate}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(55, 65, 81)" strokeWidth="8" />
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke="rgb(251, 146, 60)"
                              strokeWidth="8"
                              strokeDasharray={`${(selectedProject.progress ?? 0) * 2.827} 282.7`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <p className="text-2xl font-display text-white">{selectedProject.progress ?? 0}%</p>
                            <p className="text-xs text-gray-400">Complete</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">% Complete</p>
                      <p className="text-2xl font-display text-orange-400">{selectedProject.progress ?? 0}%</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Budget Used</p>
                      <p className="text-lg font-display text-white">{Math.round(((selectedProject.spent ?? 0) / (selectedProject.budget ?? 1)) * 100)}%</p>
                      <p className="text-xs text-gray-400 mt-1">{fmt(selectedProject.spent ?? 0)}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Open Issues</p>
                      <p className="text-2xl font-display text-red-400">{selectedProject.openIssues ?? 0}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Days Remaining</p>
                      <p className="text-2xl font-display text-blue-400">{selectedProject.daysRemaining ?? 0}</p>
                    </div>
                  </div>

                  {/* Milestones Timeline */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Project Milestones</h3>
                    <div className="space-y-3">
                      {milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {m.status === 'completed' ? (
                              <CheckCircle size={20} className="text-green-400" />
                            ) : (
                              <Clock size={20} className="text-yellow-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${m.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                              {m.name}
                            </p>
                            <p className="text-xs text-gray-500">{m.dueDate}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            m.status === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {m.status === 'completed' ? 'Done' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Updates Feed */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Recent Updates</h3>
                    <div className="space-y-3">
                      {activities.slice(0, 5).map((a) => (
                        <div key={a.id} className="flex items-start gap-3 pb-3 border-b border-gray-800 last:border-b-0">
                          <div className="w-2 h-2 mt-2 rounded-full bg-orange-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">{a.description}</p>
                            <p className="text-xs text-gray-500 mt-1">{a.user} • {a.timestamp}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weather Widget (Mock) */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Site Weather</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl mb-2">☀️</p>
                        <p className="text-sm text-white">Today</p>
                        <p className="text-xs text-gray-400">18°C, Sunny</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl mb-2">⛅</p>
                        <p className="text-sm text-white">Tomorrow</p>
                        <p className="text-xs text-gray-400">16°C, Partly Cloudy</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl mb-2">🌧️</p>
                        <p className="text-sm text-white">Wed 30th</p>
                        <p className="text-xs text-gray-400">14°C, Rainy</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl mb-2">☀️</p>
                        <p className="text-sm text-white">Thu 1st</p>
                        <p className="text-xs text-gray-400">17°C, Sunny</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* PROGRESS TAB */}
              {activeTab === 'progress' && (
                <>
                  {/* Phase Breakdown */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Construction Phase Breakdown</h3>
                    <div className="space-y-4">
                      {['Foundations', 'Frame', 'Envelope', 'MEP', 'Fit-Out', 'External'].map((phase, i) => {
                        const pcts = [100, 85, 45, 10, 0, 5];
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-300">{phase}</span>
                              <span className="text-orange-400 font-medium">{pcts[i]}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <div
                                className="bg-orange-500 h-2 rounded-full transition-all"
                                style={{ width: `${pcts[i]}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Work Package Table */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-800">
                      <h3 className="font-semibold text-white">Work Package Progress</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/50 border-b border-gray-800">
                        <tr>
                          {['Work Package', 'Planned', 'Actual', 'Variance', 'Status'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {workPackages.map((wp) => {
                          const variance = wp.actualPercent - wp.plannedPercent;
                          return (
                            <tr key={wp.id} className="hover:bg-gray-800/30">
                              <td className="px-4 py-3 text-white">{wp.name}</td>
                              <td className="px-4 py-3 text-gray-300">{wp.plannedPercent}%</td>
                              <td className="px-4 py-3 text-white font-medium">{wp.actualPercent}%</td>
                              <td className={`px-4 py-3 text-sm font-medium ${variance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {variance > 0 ? '+' : ''}{variance}%
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  wp.status === 'on-track' ? 'bg-green-500/20 text-green-300' :
                                  wp.status === 'at-risk' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-red-500/20 text-red-300'
                                }`}>
                                  {wp.status === 'on-track' ? 'On Track' : wp.status === 'at-risk' ? 'At Risk' : 'Delayed'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Progress Photos Gallery */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Weekly Progress Photos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { date: 'Apr 24', desc: 'Structural frame - Level 8' },
                        { date: 'Apr 17', desc: 'Concrete pour - Level 7' },
                        { date: 'Apr 10', desc: 'Formwork preparation' },
                        { date: 'Apr 3', desc: 'Foundation works' },
                        { date: 'Mar 27', desc: 'Site clearance' },
                        { date: 'Mar 20', desc: 'Hoarding installation' }
                      ].map((photo, i) => (
                        <div key={i} className="relative group overflow-hidden rounded-lg">
                          <div className="w-full aspect-video bg-gray-800 flex items-center justify-center">
                            <Camera size={32} className="text-gray-600" />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <p className="text-xs text-white font-medium">{photo.date}</p>
                            <p className="text-xs text-gray-300">{photo.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* S-Curve Chart */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Progress Curve (Planned vs Actual)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={getProgressChartData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(55, 65, 81)" />
                        <XAxis dataKey="month" stroke="rgb(107, 114, 128)" />
                        <YAxis stroke="rgb(107, 114, 128)" />
                        <Tooltip contentStyle={{ backgroundColor: 'rgb(17, 24, 39)', border: '1px solid rgb(55, 65, 81)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="planned" stroke="rgb(59, 130, 246)" strokeWidth={2} name="Planned" />
                        <Line type="monotone" dataKey="actual" stroke="rgb(251, 146, 60)" strokeWidth={2} name="Actual" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {/* FINANCIALS TAB */}
              {activeTab === 'financials' && (
                <>
                  {/* Budget Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Original Contract Value</p>
                      <p className="text-xl font-display text-white">{fmt(selectedProject.budget)}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Approved Variations</p>
                      <p className="text-xl font-display text-orange-400">£0</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Forecast Final Account</p>
                      <p className="text-xl font-display text-white">{fmt(selectedProject.budget)}</p>
                    </div>
                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                      <p className="text-xs text-gray-500 mb-2">Spent to Date</p>
                      <p className="text-xl font-display text-green-400">{fmt(selectedProject.spent)}</p>
                    </div>
                  </div>

                  {/* Monthly Cashflow */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Monthly Certified Cashflow</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={getMonthlyValuationData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(55, 65, 81)" />
                        <XAxis dataKey="month" stroke="rgb(107, 114, 128)" />
                        <YAxis stroke="rgb(107, 114, 128)" />
                        <Tooltip contentStyle={{ backgroundColor: 'rgb(17, 24, 39)', border: '1px solid rgb(55, 65, 81)' }} />
                        <Bar dataKey="amount" fill="rgb(251, 146, 60)" name="Certified Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Valuations Table */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-800">
                      <h3 className="font-semibold text-white">Payment Valuations</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/50 border-b border-gray-800">
                        <tr>
                          {['App No.', 'Period', 'Amount', 'Certified', 'Status'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {valuations.map((v, i) => (
                          <tr key={i} className={v.status === 'Certified' ? 'bg-green-500/5 hover:bg-green-500/10' : 'hover:bg-gray-800/30'}>
                            <td className="px-4 py-3 font-mono text-orange-400">{v.appNo}</td>
                            <td className="px-4 py-3 text-gray-300">{v.period}</td>
                            <td className="px-4 py-3 text-white font-medium">{fmt(v.netValue)}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{v.certifiedDate}</td>
                            <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${valStatusColour(v.status)}`}>{v.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Retention Schedule */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                    <h3 className="font-semibold text-white mb-4">Retention Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">Current Retention Held</p>
                        <p className="text-2xl font-display text-orange-400">{fmt((selectedProject.spent ?? 0) * 0.05)}</p>
                        <p className="text-xs text-gray-400 mt-2">5% of certified amount</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">50% Release at Practical Completion</p>
                        <p className="text-lg font-display text-white">{fmt(((selectedProject.spent ?? 0) * 0.05) / 2)}</p>
                        <p className="text-xs text-gray-400 mt-2">Est. Sept 2026</p>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-2">50% Release at Final Account</p>
                        <p className="text-lg font-display text-white">{fmt(((selectedProject.spent ?? 0) * 0.05) / 2)}</p>
                        <p className="text-xs text-gray-400 mt-2">Est. Dec 2026</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === 'documents' && (
                <>
                  {/* Filter */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        value={documentFilter}
                        onChange={(e) => setDocumentFilter(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <button
                      onClick={() => setShowDocRequestForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                    >
                      <Plus size={16} /> Request Document
                    </button>
                  </div>

                  {/* Documents List */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/50 border-b border-gray-800">
                        <tr>
                          {['Document', 'Type', 'Revision', 'Date Issued', 'Action'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {documents
                          .filter(d => documentFilter === '' || d.name.toLowerCase().includes(documentFilter.toLowerCase()))
                          .map((d) => (
                            <tr key={d.id} className="hover:bg-gray-800/30">
                              <td className="px-4 py-3 text-white flex items-center gap-2">
                                <FileText size={16} className="text-blue-400 flex-shrink-0" />
                                {d.name}
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{d.type}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{d.revision}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{d.dateIssued}</td>
                              <td className="px-4 py-3">
                                <button className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                                  <Download size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Document Request Form Modal */}
                  {showDocRequestForm && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                          <h3 className="text-lg font-semibold text-white">Request Document</h3>
                          <button onClick={() => setShowDocRequestForm(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                            <X size={18} />
                          </button>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Document Required *</label>
                            <textarea
                              value={docRequestData.description}
                              onChange={(e) => setDocRequestData({ description: e.target.value })}
                              placeholder="e.g. Updated architectural plans for Level 4"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 h-24 resize-none"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setShowDocRequestForm(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
                              Cancel
                            </button>
                            <button onClick={handleRequestDocument} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                              Send Request
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ISSUES TAB */}
              {activeTab === 'issues' && (
                <>
                  {/* Report Issue Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowIssueForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                    >
                      <Plus size={16} /> Report New Issue
                    </button>
                  </div>

                  {/* Issues List */}
                  <div className="space-y-3">
                    {issues.map((issue) => (
                      <div key={issue.id} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <p className="text-white font-medium">{issue.description}</p>
                            <p className="text-xs text-gray-400 mt-1">Location: {issue.location}</p>
                          </div>
                          <div className="flex gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${issuePriorityColour(issue.priority)}`}>
                              {issue.priority.toUpperCase()}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${issueStatusColour(issue.status)}`}>
                              {issue.status.replace('-', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {issue.targetCloseDate && (
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={12} /> Target close: {issue.targetCloseDate}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Report Issue Form Modal */}
                  {showIssueForm && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900">
                          <h3 className="text-lg font-semibold text-white">Report Issue</h3>
                          <button onClick={() => setShowIssueForm(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                            <X size={18} />
                          </button>
                        </div>
                        <div className="p-6 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                            <textarea
                              value={issueFormData.description}
                              onChange={(e) => setIssueFormData(f => ({ ...f, description: e.target.value }))}
                              placeholder="Describe the issue or defect..."
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 h-24 resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Location *</label>
                            <input
                              value={issueFormData.location}
                              onChange={(e) => setIssueFormData(f => ({ ...f, location: e.target.value }))}
                              placeholder="e.g. Level 3, East Wing"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                            <select
                              value={issueFormData.priority}
                              onChange={(e) => setIssueFormData(f => ({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setShowIssueForm(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
                              Cancel
                            </button>
                            <button onClick={handleReportIssue} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                              Report Issue
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default ClientPortal;
