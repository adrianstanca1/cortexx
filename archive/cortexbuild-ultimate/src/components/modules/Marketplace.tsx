import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Zap,
  Plug,
  LayoutTemplate,
  Download,
  BookOpen,
  MessageCircle,
  Star,
  CheckSquare,
  Square,
  Trash2,
  Search,
  Filter,
  X,
  ExternalLink,
  Lock,
  Award,
  Users,
  FileText,
  AlertCircle,
  Settings,
  Code,
  Upload,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Zap as ZapIcon,
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type SubTab = 'apps' | 'integrations' | 'templates' | 'training' | 'support' | 'reviews' | 'my-integrations' | 'api-keys';
type _AnyRow = Record<string, unknown>;

const TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'apps', label: 'Apps', icon: Zap },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'training', label: 'Training', icon: BookOpen },
  { key: 'support', label: 'Support', icon: MessageCircle },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'my-integrations', label: 'My Integrations', icon: Plug },
  { key: 'api-keys', label: 'API Keys', icon: Code },
];

const APPS = [
  { id: 'xero', name: 'Xero Accounting', desc: 'Sync financial data and invoices', category: 'Accounting', rating: 4.8, installs: 1200, price: 'Free', installed: true },
  { id: 'autocad', name: 'AutoCAD', desc: 'CAD drawing integration', category: 'BIM & CAD', rating: 4.9, installs: 980, price: '£150/mo', installed: false },
  { id: 'revit', name: 'Revit BIM', desc: 'Building Information Modeling', category: 'BIM & CAD', rating: 4.7, installs: 750, price: '£200/mo', installed: true },
  { id: 'procore', name: 'Procore Sync', desc: 'Bidirectional project sync', category: 'Construction', rating: 4.6, installs: 580, price: '£100/mo', installed: false },
  { id: 'ms365', name: 'Microsoft 365', desc: 'Office integration', category: 'Productivity', rating: 4.8, installs: 2100, price: 'Free', installed: true },
  { id: 'google', name: 'Google Workspace', desc: 'Google integration', category: 'Productivity', rating: 4.7, installs: 1900, price: 'Free', installed: true },
  { id: 'dropbox', name: 'Dropbox Business', desc: 'Cloud file storage', category: 'Documents', rating: 4.5, installs: 420, price: '£50/mo', installed: false },
  { id: 'docusign', name: 'DocuSign', desc: 'E-signature solutions', category: 'Documents', rating: 4.9, installs: 890, price: '£75/mo', installed: true },
  { id: 'plangrid', name: 'PlanGrid', desc: 'Construction collaboration', category: 'Construction', rating: 4.4, installs: 320, price: '£120/mo', installed: false },
  { id: 'bricscad', name: 'BricsCAD', desc: 'CAD alternative', category: 'BIM & CAD', rating: 4.3, installs: 210, price: '£80/mo', installed: false },
  { id: 'trimble', name: 'Trimble Connect', desc: 'Construction platform', category: 'Construction', rating: 4.6, installs: 490, price: '£90/mo', installed: false },
  { id: 'hseq', name: 'HSEQ Manager', desc: 'Health and safety management', category: 'Safety', rating: 4.7, installs: 560, price: '£65/mo', installed: true },
  { id: 'weather', name: 'WeatherAPI Pro', desc: 'Weather forecasting', category: 'Field', rating: 4.2, installs: 180, price: 'Free', installed: false },
  { id: 'hammertech', name: 'HammerTech Safety', desc: 'Safety incident tracking', category: 'Safety', rating: 4.8, installs: 640, price: '£55/mo', installed: false },
  { id: 'heavybid', name: 'HeavyBid Estimating', desc: 'Construction estimating', category: 'Accounting', rating: 4.5, installs: 380, price: '£130/mo', installed: false },
  { id: 'bluebeam', name: 'Bluebeam Revu', desc: 'Document collaboration', category: 'Documents', rating: 4.9, installs: 1100, price: '£95/mo', installed: true },
];

const INTEGRATIONS = [
  { id: 'xero', name: 'Xero', desc: 'Sync invoices, payments and financial data', category: 'Accounting', status: 'connected', lastSync: '2 hours ago' },
  { id: 'quickbooks', name: 'QuickBooks', desc: 'Accounting software integration', category: 'Accounting', status: 'available', lastSync: null },
  { id: 'sage', name: 'Sage', desc: 'Sage 50 and Sage 100 integration', category: 'Accounting', status: 'available', lastSync: null },
  { id: 'companies-house', name: 'Companies House API', desc: 'Company registration data', category: 'Compliance', status: 'connected', lastSync: '5 days ago' },
  { id: 'hmrc', name: 'HMRC MTD', desc: 'Making Tax Digital compliance', category: 'Compliance', status: 'available', lastSync: null },
  { id: 'slack', name: 'Slack', desc: 'Notifications and messaging', category: 'Communication', status: 'connected', lastSync: '10 minutes ago' },
  { id: 'teams', name: 'Microsoft Teams', desc: 'Teams integration and alerts', category: 'Communication', status: 'available', lastSync: null },
  { id: 'gdrive', name: 'Google Drive', desc: 'File sync and storage', category: 'Storage', status: 'connected', lastSync: '30 minutes ago' },
  { id: 'onedrive', name: 'OneDrive', desc: 'Microsoft cloud storage', category: 'Storage', status: 'available', lastSync: null },
  { id: 'sharepoint', name: 'SharePoint', desc: 'Enterprise content management', category: 'Storage', status: 'available', lastSync: null },
  { id: 'docusign', name: 'DocuSign', desc: 'E-signature integration', category: 'Signature', status: 'connected', lastSync: '1 day ago' },
  { id: 'adobe-sign', name: 'Adobe Sign', desc: 'Adobe e-signature service', category: 'Signature', status: 'available', lastSync: null },
  { id: 'twilio', name: 'Twilio SMS', desc: 'SMS notifications', category: 'Communication', status: 'available', lastSync: null },
  { id: 'sendgrid', name: 'SendGrid Email', desc: 'Email delivery service', category: 'Communication', status: 'available', lastSync: null },
];

const TEMPLATES = [
  { id: 'pid', name: 'Project Initiation Document', category: 'Commercial', type: 'DOCX', downloads: 1200, featured: true },
  { id: 'rams', name: 'Pre-Construction RAMS', category: 'Safety', type: 'DOCX', downloads: 2100, featured: true },
  { id: 'site-plan', name: 'Site Establishment Plan', category: 'Safety', type: 'DOCX', downloads: 890, featured: false },
  { id: 'procurement', name: 'Procurement Strategy', category: 'Commercial', type: 'XLSX', downloads: 560, featured: false },
  { id: 'risk-register', name: 'Risk Register', category: 'Quality', type: 'XLSX', downloads: 1450, featured: true },
  { id: 'programme', name: 'Programme Template', category: 'Programme', type: 'XLSX', downloads: 2800, featured: true },
  { id: 'qmp', name: 'Quality Management Plan', category: 'Quality', type: 'DOCX', downloads: 720, featured: false },
  { id: 'emp', name: 'Environmental Management Plan', category: 'Safety', type: 'DOCX', downloads: 540, featured: false },
  { id: 'h-s-plan', name: 'H&S Plan', category: 'Safety', type: 'DOCX', downloads: 3200, featured: true },
  { id: 'cis-pack', name: 'CIS Subcontractor Pack', category: 'Commercial', type: 'PDF', downloads: 910, featured: false },
  { id: 'valuation', name: 'Valuation Application', category: 'Commercial', type: 'DOCX', downloads: 1680, featured: false },
  { id: 'change-order', name: 'Change Order Form', category: 'Commercial', type: 'DOCX', downloads: 2340, featured: true },
  { id: 'rfi-form', name: 'RFI Form', category: 'Commercial', type: 'DOCX', downloads: 1950, featured: false },
  { id: 'inspection', name: 'Inspection Checklist', category: 'Quality', type: 'PDF', downloads: 1120, featured: false },
  { id: 'toolbox', name: 'Toolbox Talk Record', category: 'Safety', type: 'DOCX', downloads: 2760, featured: false },
  { id: 'incident', name: 'Incident Report', category: 'Safety', type: 'DOCX', downloads: 1890, featured: false },
  { id: 'closeout', name: 'Project Closeout Checklist', category: 'Handover', type: 'XLSX', downloads: 670, featured: false },
  { id: 'handover', name: 'Handover Certificate', category: 'Handover', type: 'DOCX', downloads: 580, featured: false },
  { id: 'om-manual', name: 'O&M Manuals Template', category: 'Handover', type: 'DOCX', downloads: 420, featured: false },
  { id: 'client-report', name: 'Client Report Template', category: 'Commercial', type: 'DOCX', downloads: 1340, featured: false },
];

const TRAINING_COURSES = [
  { id: 'getting-started', title: 'Getting Started with CortexBuild', duration: '30 min', level: 'Beginner', rating: 4.9, enrolled: 8920, citb: false, progress: 100, status: 'completed' },
  { id: 'projects', title: 'Projects Module Mastery', duration: '2.5 hours', level: 'Intermediate', rating: 4.7, enrolled: 4560, citb: false, progress: 0, status: 'not-started' },
  { id: 'safety', title: 'Safety Management', duration: '1.5 hours', level: 'Intermediate', rating: 4.8, enrolled: 6340, citb: true, progress: 45, status: 'in-progress' },
  { id: 'finance', title: 'Financial Reporting', duration: '2 hours', level: 'Advanced', rating: 4.6, enrolled: 2890, citb: false, progress: 0, status: 'not-started' },
  { id: 'ai-features', title: 'AI Features Deep Dive', duration: '1 hour', level: 'Intermediate', rating: 4.9, enrolled: 5120, citb: false, progress: 0, status: 'not-started' },
  { id: 'admin', title: 'Admin & Configuration', duration: '1.5 hours', level: 'Advanced', rating: 4.5, enrolled: 1890, citb: false, progress: 0, status: 'not-started' },
  { id: 'api', title: 'API Developer Guide', duration: '3 hours', level: 'Advanced', rating: 4.8, enrolled: 3450, citb: false, progress: 0, status: 'not-started' },
  { id: 'mobile', title: 'Mobile App Guide', duration: '45 min', level: 'Beginner', rating: 4.7, enrolled: 4320, citb: false, progress: 0, status: 'not-started' },
];

const APP_REVIEWS = [
  { id: 'rev1', appId: 'xero', author: 'John Smith', rating: 5, date: '2026-03-18', comment: 'Excellent integration, saves hours on invoicing' },
  { id: 'rev2', appId: 'xero', author: 'Sarah Johnson', rating: 4, date: '2026-03-15', comment: 'Good but API could be faster' },
  { id: 'rev3', appId: 'revit', author: 'Mike Davis', rating: 5, date: '2026-03-20', comment: 'Perfect for BIM coordination' },
  { id: 'rev4', appId: 'ms365', author: 'Emma Wilson', rating: 4, date: '2026-03-19', comment: 'Reliable and integrates well' },
  { id: 'rev5', appId: 'bluebeam', author: 'David Brown', rating: 5, date: '2026-03-17', comment: 'Industry standard, essential tool' },
  { id: 'rev6', appId: 'autocad', author: 'James Taylor', rating: 4, date: '2026-03-14', comment: 'Solid integration, some lag issues' },
];

const MY_INSTALLED = [
  { id: 'xero', name: 'Xero Accounting', status: 'connected', lastSync: '2026-03-20 14:32', apiCallsToday: 124, syncInterval: '2 hours' },
  { id: 'revit', name: 'Revit BIM', status: 'connected', lastSync: '2026-03-20 10:15', apiCallsToday: 89, syncInterval: '4 hours' },
  { id: 'ms365', name: 'Microsoft 365', status: 'connected', lastSync: '2026-03-20 15:45', apiCallsToday: 342, syncInterval: '1 hour' },
  { id: 'google', name: 'Google Workspace', status: 'connected', lastSync: '2026-03-20 14:20', apiCallsToday: 256, syncInterval: '2 hours' },
  { id: 'docusign', name: 'DocuSign', status: 'connected', lastSync: '2026-03-20 09:10', apiCallsToday: 34, syncInterval: '6 hours' },
  { id: 'hseq', name: 'HSEQ Manager', status: 'warning', lastSync: '2026-03-19 16:40', apiCallsToday: 12, syncInterval: '12 hours' },
  { id: 'bluebeam', name: 'Bluebeam Revu', status: 'connected', lastSync: '2026-03-20 13:25', apiCallsToday: 178, syncInterval: '3 hours' },
];

const API_KEYS = [
  { id: 'key1', name: 'Production API Key', keyPreview: 'sk_live_4eC39HqL***', scope: 'Full Access', created: '2026-01-15', lastUsed: '2026-03-20' },
  { id: 'key2', name: 'Development Key', keyPreview: 'sk_test_51H***', scope: 'Read-Only', created: '2026-02-01', lastUsed: '2026-03-18' },
  { id: 'key3', name: 'Webhook Key', keyPreview: 'whk_secret_***', scope: 'Webhook Events', created: '2026-01-20', lastUsed: '2026-03-20' },
];

export function Marketplace() {
  const [subTab, setSubTab] = useState<SubTab>('apps');
  const [installedApps, setInstalledApps] = useState(['xero', 'revit', 'ms365', 'google', 'docusign', 'hseq', 'bluebeam']);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [userReview, setUserReview] = useState({ rating: 5, comment: '' });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedAppForReview, setSelectedAppForReview] = useState<string | null>(null);
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeyValue, setShowKeyValue] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState(API_KEYS);
  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Remove ${ids.length} app(s)?`)) return;
    try {
      setInstalledApps(prev => prev.filter(id => !ids.includes(id)));
      toast.success(`Removed ${ids.length} app(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk action failed');
    }
  }

  const statusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'bg-emerald-500/20 text-emerald-400';
      case 'available': return 'bg-blue-500/20 text-blue-400';
      case 'warning': return 'bg-amber-500/20 text-amber-400';
      case 'coming-soon': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'connected': return '✓ Connected';
      case 'available': return 'Available';
      case 'warning': return '⚠ Sync Issue';
      case 'coming-soon': return 'Scheduled';
      default: return status;
    }
  };

  const toggleApp = (id: string) => {
    setInstalledApps(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const appCategories = Array.from(new Set(APPS.map(a => a.category)));
  const filteredApps = APPS.filter(app =>
    (categoryFilter === 'All' || app.category === categoryFilter) &&
    (searchQuery === '' || app.name.toLowerCase().includes(searchQuery.toLowerCase()) || app.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const templateCategories = Array.from(new Set(TEMPLATES.map(t => t.category)));
  const [templateFilter, setTemplateFilter] = useState<string>('All');
  const filteredTemplates = TEMPLATES.filter(t =>
    templateFilter === 'All' || t.category === templateFilter
  );

  const inProgressCourses = TRAINING_COURSES.filter(c => c.status === 'in-progress');
  const completedCourses = TRAINING_COURSES.filter(c => c.status === 'completed');

  const handleSubmitReview = () => {
    if (userReview.comment.trim()) {
      toast.success('Review submitted successfully');
      setUserReview({ rating: 5, comment: '' });
      setShowReviewModal(false);
      setSelectedAppForReview(null);
    }
  };

  const ratingBreakdown = [
    { name: '5★', value: 45 },
    { name: '4★', value: 30 },
    { name: '3★', value: 15 },
    { name: '2★', value: 7 },
    { name: '1★', value: 3 },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'];

  const usageData = [
    { name: 'Xero', calls: 124 },
    { name: 'Revit', calls: 89 },
    { name: 'MS365', calls: 342 },
    { name: 'Google', calls: 256 },
    { name: 'DocuSign', calls: 34 },
  ];

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return;
    const newKey = {
      id: `key${apiKeys.length + 1}`,
      name: newKeyName,
      keyPreview: 'sk_live_' + Math.random().toString(36).substring(2, 15) + '***',
      scope: 'Full Access',
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
    };
    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
    setShowGenerateKeyModal(false);
    toast.success('API key generated successfully');
  };

  const handleRevokeKey = (id: string) => {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return;
    setApiKeys(apiKeys.filter(k => k.id !== id));
    toast.success('API key revoked');
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="marketplace" />
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display text-white">CortexBuild Marketplace</h1>
        </div>
        <p className="text-gray-400 text-sm">Browse apps, integrations, templates, training and support resources</p>

        {/* KPI Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="input input-bordered p-4">
            <p className="text-sm text-gray-400 mb-1">Active Apps</p>
            <p className="text-2xl font-display text-white">{installedApps.length}</p>
          </div>
          <div className="input input-bordered p-4">
            <p className="text-sm text-gray-400 mb-1">Connected Integrations</p>
            <p className="text-2xl font-display text-white">{INTEGRATIONS.filter(i => i.status === 'connected').length}</p>
          </div>
          <div className="input input-bordered p-4">
            <p className="text-sm text-gray-400 mb-1">Available Templates</p>
            <p className="text-2xl font-display text-white">{TEMPLATES.length}</p>
          </div>
          <div className="input input-bordered p-4">
            <p className="text-sm text-gray-400 mb-1">API Calls Today</p>
            <p className="text-2xl font-display text-white">{MY_INSTALLED.reduce((sum, i) => sum + i.apiCallsToday, 0)}</p>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  subTab === t.key
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* APPS TAB */}
        {subTab === 'apps' && (
          <div className="space-y-5">
            <div className="flex gap-4 items-end">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search apps..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full input input-bordered pl-10 px-4 py-3 text-white placeholder-gray-500"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="input input-bordered px-4 py-3 text-white"
              >
                <option>All</option>
                {appCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Featured/Popular Section */}
            {filteredApps.filter(a => a.installs > 1000).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-400 uppercase">Popular Apps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredApps.filter(a => a.installs > 1000).slice(0, 4).map(app => {
                    const isInstalled = installedApps.includes(app.id);
                    return (
                      <div
                        key={app.id}
                        className="border rounded-xl p-4 bg-gray-900 border-amber-600/30 hover:border-amber-600 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-display text-white text-sm">{String(app.name)}</h4>
                            <p className="text-xs text-amber-400">{String(app.category)}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor(isInstalled ? 'connected' : 'available')}`}>
                            {isInstalled ? 'Installed' : 'Available'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">{String(app.desc)}</p>
                        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                          <Star className="h-3 w-3 text-amber-400" />
                          <span>{Number(app.rating)}</span>
                          <span>{Number(app.installs)} installs</span>
                        </div>
                        <button
                          onClick={() => toggleApp(String(app.id))}
                          className={`w-full px-3 py-2 rounded-lg font-medium text-xs transition ${
                            isInstalled
                              ? 'btn btn-ghost'
                              : 'btn btn-primary'
                          }`}
                        >
                          {isInstalled ? 'Uninstall' : 'Install'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Apps Grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">All Apps ({filteredApps.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredApps.map(app => {
                  const isInstalled = installedApps.includes(app.id);
                  const isSelected = selectedIds.has(app.id);
                  return (
                    <div
                      key={app.id}
                      className={`border rounded-xl p-5 transition ${
                        isInstalled ? 'bg-gray-900 border-blue-600/40' : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <button type="button" onClick={() => toggle(app.id)}>
                            {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                          </button>
                          <div>
                            <h4 className="font-display text-white text-sm">{String(app.name)}</h4>
                            <p className="text-xs text-blue-400">{String(app.category)}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor(isInstalled ? 'connected' : 'available')}`}>
                          {Boolean(isInstalled) && 'Installed'}
                          {Boolean(!isInstalled) && 'Available'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{String(app.desc)}</p>
                      <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400" />
                          {Number(app.rating)}
                        </span>
                        <span>{Number(app.installs)} installs</span>
                        <span className="font-medium text-amber-400">{String(app.price)}</span>
                      </div>
                      <button
                        onClick={() => toggleApp(String(app.id))}
                        className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition ${
                          isInstalled
                            ? 'btn btn-ghost'
                            : 'btn btn-primary'
                        }`}
                      >
                        {Boolean(isInstalled) && 'Uninstall'}
                        {Boolean(!isInstalled) && 'Install'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <BulkActionsBar
              selectedIds={Array.from(selectedIds)}
              actions={[
                { id: 'delete', label: 'Uninstall Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This will uninstall the selected apps.' },
              ]}
              onClearSelection={clearSelection}
            />
          </div>
        )}

        {/* INTEGRATIONS TAB */}
        {subTab === 'integrations' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-medium">
                {Number(INTEGRATIONS.filter(i => i.status === 'connected').length)} connected
              </span>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">
                {Number(INTEGRATIONS.filter(i => i.status === 'available').length)} available
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INTEGRATIONS.map(intg => (
                <div
                  key={String(intg.id)}
                  className={`bg-gray-900 border rounded-xl p-5 space-y-3 ${intg.status === 'connected' ? 'border-emerald-700/50' : 'border-gray-800 hover:border-gray-700'} transition`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-display text-white">{String(intg.name)}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(intg.status)}`}>
                          {statusLabel(intg.status)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-400 mb-1.5">{String(intg.category)}</p>
                      <p className="text-sm text-gray-400">{String(intg.desc)}</p>
                    </div>
                  </div>

                  {intg.lastSync && (
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-xs text-gray-500">Last sync: {String(intg.lastSync)}</p>
                    </div>
                  )}

                  {intg.status === 'connected' && (
                    <div className="pt-2 border-t border-gray-800 flex gap-2">
                      <button className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 rounded transition">
                        Test Connection
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 rounded transition">
                        <Settings className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-800 flex gap-2">
                    <button
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        intg.status === 'connected'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'btn btn-primary'
                      }`}
                    >
                      {intg.status === 'connected' ? 'Manage' : 'Connect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEMPLATES TAB */}
        {subTab === 'templates' && (
          <div className="space-y-5">
            <div className="flex gap-4 items-end">
              <select
                value={templateFilter}
                onChange={e => setTemplateFilter(e.target.value)}
                className="input input-bordered px-4 py-3 text-white"
              >
                <option>All</option>
                {templateCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-sm text-gray-400">Showing {filteredTemplates.length} templates</p>
            </div>

            {/* Featured Section */}
            {filteredTemplates.filter(t => t.featured).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-400 uppercase">Featured Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.filter(t => t.featured).map(tpl => (
                    <div key={String(tpl.id)} className="bg-gray-900 border border-amber-600/30 hover:border-amber-600 transition rounded-xl p-5 flex gap-4">
                      <div className="p-3 bg-amber-900/40 rounded-lg flex-shrink-0">
                        <FileText className="h-6 w-6 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-display text-white mb-0.5">{String(tpl.name)}</h4>
                        <p className="text-xs text-amber-400 mb-1.5">{String(tpl.category)}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{Number(tpl.downloads)} downloads</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded">{tpl.type}</span>
                        </div>
                        <button className="mt-3 w-full px-3 py-1.5 btn btn-primary rounded-lg text-xs font-medium transition flex items-center justify-center gap-1">
                          <Download className="h-3 w-3" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Templates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">All Templates ({filteredTemplates.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(tpl => (
                  <div key={String(tpl.id)} className="bg-gray-900 border border-gray-800 hover:border-gray-700 transition rounded-xl p-5 flex gap-4">
                    <div className="p-2.5 bg-blue-900/40 rounded-lg flex-shrink-0">
                      <LayoutTemplate className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-white mb-0.5 text-sm">{String(tpl.name)}</h4>
                      <p className="text-xs text-blue-400 mb-1.5">{String(tpl.category)}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{Number(tpl.downloads)} downloads</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded">{tpl.type}</span>
                        </div>
                        <button className="px-2 py-1 btn btn-primary rounded text-xs font-medium transition flex items-center gap-1">
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TRAINING TAB */}
        {subTab === 'training' && (
          <div className="space-y-6">
            {/* In Progress */}
            {inProgressCourses.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-400 uppercase">Continue Learning</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inProgressCourses.map(course => (
                    <div key={String(course.id)} className="card bg-gray-900 border border-amber-600/30 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-xs text-amber-400 uppercase font-medium">{String(course.level)}</p>
                        {course.citb && <Award className="h-4 w-4 text-green-400" />}
                      </div>
                      <h4 className="font-display text-white mb-3 text-sm">{String(course.title)}</h4>
                      <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
                        <div
                          className="h-2 rounded-full bg-amber-500"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-400">{course.progress}% complete</p>
                        <p className="text-xs text-gray-500">{String(course.duration)}</p>
                      </div>
                      <button className="w-full px-3 py-2 btn btn-primary rounded-lg text-xs font-medium">
                        Continue
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedCourses.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-green-400 uppercase">Completed Courses</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedCourses.map(course => (
                    <div key={String(course.id)} className="card bg-gray-900 border border-green-600/30 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-xs text-green-400 uppercase font-medium">{String(course.level)}</p>
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      </div>
                      <h4 className="font-display text-white mb-2 text-sm">{String(course.title)}</h4>
                      <p className="text-xs text-gray-400 mb-3">{String(course.duration)}</p>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-amber-400" />
                        <span className="text-xs text-gray-500">{Number(course.rating)}</span>
                        <span className="text-xs text-gray-500">({Number(course.enrolled)} enrolled)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Courses */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">All Courses ({TRAINING_COURSES.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TRAINING_COURSES.filter(c => c.status === 'not-started').map(course => (
                  <div key={String(course.id)} className="card bg-gray-900 border border-gray-800 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs text-blue-400 uppercase font-medium">{String(course.level)}</p>
                      {course.citb && <Award className="h-4 w-4 text-green-400" />}
                    </div>
                    <h4 className="font-display text-white mb-2 text-sm">{String(course.title)}</h4>
                    <p className="text-xs text-gray-400 mb-3">{String(course.duration)}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-3 w-3 text-amber-400" />
                      <span className="text-xs text-gray-500">{Number(course.rating)}</span>
                      <span className="text-xs text-gray-500">({Number(course.enrolled)} enrolled)</span>
                    </div>
                    <button className="w-full px-3 py-2 btn btn-primary rounded-lg text-xs font-medium">
                      Start
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {subTab === 'reviews' && (
          <div className="space-y-6">
            {/* Rating Breakdown */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-display text-white mb-4">Integration Reviews & Ratings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-white font-semibold mb-4">Rating Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={ratingBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {ratingBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <span className="text-gray-300 text-sm">Average Rating</span>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-400" />
                      <span className="text-2xl font-display text-white">4.7</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <span className="text-gray-300 text-sm">Total Reviews</span>
                    <span className="text-2xl font-display text-white">{APP_REVIEWS.length}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowReviewModal(true);
                      setSelectedAppForReview(installedApps[0] || 'xero');
                    }}
                    className="w-full px-4 py-2 btn btn-primary rounded-lg font-semibold text-sm"
                  >
                    Write a Review
                  </button>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">Recent Reviews</h3>
              <div className="space-y-3">
                {APP_REVIEWS.map(review => (
                  <div key={review.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-semibold">{review.author}</p>
                        <p className="text-xs text-gray-500">{review.date}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm">{review.comment}</p>
                    <p className="text-xs text-blue-400 mt-2">
                      {APPS.find(a => a.id === review.appId)?.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MY INTEGRATIONS TAB */}
        {subTab === 'my-integrations' && (
          <div className="space-y-6">
            {/* Usage Chart */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">API Calls by Integration (Today)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Integrations Table */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-white font-semibold">Installed Integrations</h3>
              </div>
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Last Sync</th>
                      <th className="px-6 py-3 text-center text-xs font-display text-gray-400">API Calls</th>
                      <th className="px-6 py-3 text-center text-xs font-display text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {MY_INSTALLED.map(intg => (
                      <tr key={intg.id} className="hover:bg-gray-800/50">
                        <td className="px-6 py-4 text-white font-semibold">{intg.name}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(intg.status)}`}>
                            {statusLabel(intg.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300 text-sm">{intg.lastSync}</td>
                        <td className="px-6 py-4 text-center text-white font-semibold">{intg.apiCallsToday}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Sync now">
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white" title="Configure">
                              <Settings className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* API KEYS TAB */}
        {subTab === 'api-keys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display text-white">API Key Management</h3>
                <p className="text-sm text-gray-400 mt-1">Manage your API keys and credentials</p>
              </div>
              <button
                onClick={() => setShowGenerateKeyModal(true)}
                className="flex items-center gap-2 px-4 py-2 btn btn-primary rounded-lg font-semibold text-sm"
              >
                <ZapIcon className="h-4 w-4" />
                Generate Key
              </button>
            </div>

            {/* Keys Table */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Key Preview</th>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Scope</th>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-display text-gray-400">Last Used</th>
                      <th className="px-6 py-3 text-center text-xs font-display text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {apiKeys.map(key => (
                      <tr key={key.id} className="hover:bg-gray-800/50">
                        <td className="px-6 py-4 text-white font-semibold">{key.name}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded">
                              {showKeyValue === key.id ? 'sk_live_' + Math.random().toString(36).substring(2, 20) : key.keyPreview}
                            </code>
                            <button
                              onClick={() => setShowKeyValue(showKeyValue === key.id ? null : key.id)}
                              className="text-gray-400 hover:text-white"
                              title={showKeyValue === key.id ? 'Hide' : 'Show'}
                            >
                              {showKeyValue === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText('sk_live_' + Math.random().toString(36).substring(2, 20));
                                toast.success('Key copied to clipboard');
                              }}
                              className="text-gray-400 hover:text-white"
                              title="Copy"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-1 bg-blue-900/40 text-blue-400 rounded-full font-medium">
                            {key.scope}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">{key.created}</td>
                        <td className="px-6 py-4 text-gray-300">{key.lastUsed}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800 text-red-400 rounded font-medium transition-colors"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* API Documentation */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-4">API Documentation</h4>
              <div className="space-y-2">
                <p className="text-gray-300 text-sm">Base URL: <code className="text-amber-400 font-mono">https://api.cortexbuild.com/v1</code></p>
                <p className="text-gray-300 text-sm">Authentication: Bearer token in Authorization header</p>
                <a href="#" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                  View API Reference <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT TAB */}
        {subTab === 'support' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* System Status */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <p className="font-semibold text-green-400">All Systems Operational</p>
                </div>
                <p className="text-sm text-gray-400">Last updated: 5 minutes ago</p>
              </div>

              {/* Live Chat */}
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="h-5 w-5 text-blue-400" />
                  <p className="font-semibold text-white">Live Chat Support</p>
                </div>
                <p className="text-xs text-gray-400 mb-3">Available Mon-Fri 9:00 AM - 5:00 PM (GMT)</p>
                <button className="w-full px-4 py-2 btn btn-primary rounded-lg text-sm font-medium">
                  Start Chat
                </button>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400">Quick Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Documentation', icon: FileText },
                  { label: 'Video Tutorials', icon: BookOpen },
                  { label: 'Community Forum', icon: Users },
                  { label: 'API Reference', icon: Code },
                  { label: 'Release Notes', icon: AlertCircle },
                  { label: 'Feature Requests', icon: Zap },
                ].map((link, idx) => (
                  <a
                    key={idx}
                    href="#"
                    className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg p-4 flex items-center gap-3 transition"
                  >
                    <div className="p-2 bg-amber-900/30 rounded-lg flex-shrink-0">
                      <link.icon className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{link.label}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>

            {/* Support Ticket Form */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-display text-white mb-4">Submit Support Ticket</h3>
              <form className="space-y-4">
                <input
                  type="text"
                  placeholder="Subject"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm"
                />
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm">
                  <option>Category: Technical</option>
                  <option>Category: Billing</option>
                  <option>Category: Feature Request</option>
                  <option>Category: Other</option>
                </select>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm">
                  <option>Priority: Medium</option>
                  <option>Priority: High</option>
                  <option>Priority: Low</option>
                </select>
                <textarea
                  placeholder="Description"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm resize-none"
                  rows={5}
                />
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
                  <Upload className="h-6 w-6 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Drag and drop files or click to upload</p>
                  <p className="text-xs text-gray-500">Max 10MB per file</p>
                </div>
                <button type="button" className="w-full px-4 py-3 btn btn-primary rounded-lg font-medium">
                  Submit Ticket
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">Email Support</p>
                <p className="text-white font-medium">support@cortexbuild.com</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">Phone Support</p>
                <p className="text-white font-medium">+44 (0)20 XXXX XXXX</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">Slack Community</p>
                <p className="text-white font-medium">Join our Slack channel</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">Write a Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Select App</label>
                <select
                  value={selectedAppForReview || ''}
                  onChange={e => setSelectedAppForReview(e.target.value)}
                  className="w-full input input-bordered text-white"
                >
                  {installedApps.map(id => {
                    const app = APPS.find(a => a.id === id);
                    return <option key={id} value={id}>{app?.name}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Rating (out of 5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(r => (
                    <button
                      key={r}
                      onClick={() => setUserReview({ ...userReview, rating: r })}
                      className="transition"
                    >
                      <Star className={`h-6 w-6 ${userReview.rating >= r ? 'fill-amber-400 text-amber-400' : 'text-gray-500'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Comment</label>
                <textarea
                  value={userReview.comment}
                  onChange={e => setUserReview({ ...userReview, comment: e.target.value })}
                  placeholder="Share your experience..."
                  className="w-full input input-bordered text-white resize-none"
                  rows={4}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                Cancel
              </button>
              <button onClick={handleSubmitReview} className="px-4 py-2 btn btn-primary rounded-lg font-semibold">
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate API Key Modal */}
      {showGenerateKeyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-display text-white">Generate API Key</h3>
              <button onClick={() => setShowGenerateKeyModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production API Key"
                  className="w-full input input-bordered text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Scope</label>
                <select className="w-full input input-bordered text-white">
                  <option>Full Access</option>
                  <option>Read-Only</option>
                  <option>Webhook Events</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setShowGenerateKeyModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                Cancel
              </button>
              <button onClick={handleGenerateKey} className="px-4 py-2 btn btn-primary rounded-lg font-semibold">
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default Marketplace;
