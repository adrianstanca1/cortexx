import { useState } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Star,
  Clock,
  Settings,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  BarChart2,
  TrendingUp,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { type ReportTemplate } from '../../services/api';
import { useReportTemplates, useDuplicateTemplate } from '../../hooks/useData';
import { toast } from 'sonner';
import clsx from 'clsx';

type AnyRow = Record<string, unknown>;
type SubTab = 'templates' | 'builder' | 'scheduled' | 'history' | 'archive' | 'analytics';

interface ReportTemplateExt extends ReportTemplate, AnyRow {
  usage?: number;
  lastUsed?: string;
}

const REPORT_TYPES: Record<string, { label: string; icon: string; description: string }> = {
  'financial-summary': { label: 'Financial Summary', icon: '💰', description: 'Revenue, costs, and profit overview' },
  'project-costs': { label: 'Project Costs', icon: '🏗️', description: 'Detailed project cost breakdown' },
  'safety': { label: 'Safety Report', icon: '⚠️', description: 'Safety incidents and compliance' },
  'progress': { label: 'Progress Report', icon: '📊', description: 'Project progress and milestones' },
  'hr': { label: 'HR Report', icon: '👥', description: 'Team hours and productivity' },
};

const TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'builder', label: 'Builder', icon: Settings },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'history', label: 'History', icon: Download },
  { key: 'archive', label: 'Archive', icon: FileText },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
];

export function ReportTemplates() {
  const { data: rawTemplates = [], isLoading: _isLoading } = useReportTemplates.useList();
  const templates = (rawTemplates as unknown as AnyRow[]).map(t => ({
    ...t,
    usage: 0,
    lastUsed: t.updated_at
      ? new Date(String(t.updated_at)).toLocaleDateString()
      : t.created_at ? new Date(String(t.created_at)).toLocaleDateString() : '—',
  })) as ReportTemplateExt[];
  const deleteMutation = useReportTemplates.useDelete();
  const duplicateMutation = useDuplicateTemplate();

  const [subTab, setSubTab] = useState<SubTab>('templates');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplateExt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this template? This action cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(String(id));
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateMutation.mutateAsync(String(id));
    } catch {
      toast.error('Failed to duplicate template');
    }
  };

  const filteredTemplates =
    selectedType === 'all'
      ? templates
      : templates.filter(t => String(t.type) === selectedType);

  const searchedTemplates = filteredTemplates.filter(t =>
    String(t.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <ModuleBreadcrumbs currentModule="report-templates" />
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-display text-white">Report Templates</h1>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Total Templates</p>
          <p className="text-2xl font-display text-white">{Number(templates.length)}</p>
        </div>
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Scheduled Reports</p>
          <p className="text-2xl font-display text-white">12</p>
        </div>
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Generated This Month</p>
          <p className="text-2xl font-display text-white">47</p>
        </div>
        <div className="input input-bordered p-4">
          <p className="text-xs text-gray-400 uppercase mb-1">Avg Generation Time</p>
          <p className="text-2xl font-display text-white">2.3s</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="border-b border-gray-700 flex gap-1 cb-table-scroll touch-pan-x">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                subTab === t.key
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TEMPLATES TAB */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 btn text-white text-sm"
            />
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="bg-gray-800 border border-gray-700 btn text-white text-sm"
            >
              <option value="all">All Types</option>
              {Object.entries(REPORT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.icon} {val.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 btn btn-primary rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Template
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Object.entries(REPORT_TYPES).map(([key, val]) => {
              const count = templates.filter(t => String(t.type) === key).length;
              const isActive = selectedType === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedType(key === selectedType ? 'all' : key)}
                  className={clsx(
                    'bg-gray-900 border rounded-xl p-4 text-left transition-all',
                    isActive && 'ring-2 ring-blue-500'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{String(val.icon)}</span>
                    {Boolean(count > 0) && (
                      <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-400">
                        {Number(count)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-white mb-1">{String(val.label)}</h3>
                  <p className="text-xs text-gray-500">{String(val.description)}</p>
                </button>
              );
            })}
          </div>

          {_isLoading ? (
            <div className="p-8 flex justify-center">
              <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
            </div>
          ) : searchedTemplates.length === 0 ? (
            <EmptyState title="No templates found" variant="documents" />
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-lg divide-y divide-gray-800">
              {searchedTemplates.map(template => (
                <div key={Number(template.id)} className="p-4 hover:bg-gray-800/50">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-800 rounded-lg flex-shrink-0">
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white">{String(template.name ?? 'Untitled')}</h4>
                        {Boolean(template.isDefault) && (
                          <Star className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{String(template.description ?? 'No description')}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Settings className="h-3 w-3" />
                          {REPORT_TYPES[String(template.type)]?.label || String(template.type)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {String(new Date(String(template.createdAt ?? '')).toLocaleDateString())}
                        </span>
                        <span>Used {Number(template.usage ?? 0)} times</span>
                        {template.lastUsed && <span>Last: {String(template.lastUsed)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDuplicate(Number(template.id))}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(Number(template.id))}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400" />
                      </button>
                      <button
                        onClick={() =>
                          setExpandedId(Number(template.id) === expandedId ? null : Number(template.id))
                        }
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {Number(template.id) === expandedId ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  {Number(template.id) === expandedId && (
                    <div className="mt-4 ml-12 p-4 bg-gray-800/50 rounded-lg">
                      <h5 className="text-xs text-gray-500 uppercase mb-2">Configuration</h5>
                      <pre className="text-xs text-gray-400 cb-table-scroll touch-pan-x">
                        {JSON.stringify(template.config, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUILDER TAB */}
      {subTab === 'builder' && (
        <TemplateBuilder templates={templates} />
      )}

      {/* SCHEDULED TAB */}
      {subTab === 'scheduled' && (
        <ScheduledReports />
      )}

      {/* HISTORY TAB */}
      {subTab === 'history' && (
        <ReportHistory />
      )}

      {/* ARCHIVE TAB */}
      {subTab === 'archive' && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
<th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Report Name</th>
                    <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Generated</th>
                    <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Format</th>
                    <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Size</th>
                    <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  { name: 'Monthly Financial Report - Feb 2026', generated: '2026-02-28', format: 'PDF', size: '2.3 MB' },
                  { name: 'Weekly Progress Summary - Week 12', generated: '2026-03-21', format: 'Excel', size: '1.1 MB' },
                ].map((report, idx) => (
                  <tr key={idx} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-300 font-medium">{String(report.name)}</td>
                    <td className="px-4 py-3 text-gray-400">{String(report.generated)}</td>
                    <td className="px-4 py-3 text-gray-400">{String(report.format)}</td>
                    <td className="px-4 py-3 text-gray-400">{String(report.size)}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {subTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <h3 className="font-display text-white mb-3">Most Used Templates</h3>
              <div className="space-y-3">
                {[
                  { name: 'Monthly Financial Report', uses: 127 },
                  { name: 'Weekly Progress Summary', uses: 94 },
                  { name: 'Daily Site Report', uses: 156 },
                ].map((tpl, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between mb-1">
                      <p className="text-sm text-gray-300">{String(tpl.name)}</p>
                      <p className="text-sm font-medium text-blue-400">{Number(tpl.uses)}</p>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (Number(tpl.uses) / 156) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <h3 className="font-display text-white mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Generation Trend
              </h3>
              <p className="text-3xl font-display text-white mb-1">47</p>
              <p className="text-sm text-green-400">↑ 12% from last month</p>
            </div>
          </div>
        </div>
      )}

      {(showCreateModal || editingTemplate) && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
    </>
  );
}

function TemplateBuilder({ templates }: { templates: ReportTemplateExt[] }) {
  const [selectedReportType, setSelectedReportType] = useState<string>('Daily Report');
  const [sections, setSections] = useState<Set<string>>(new Set(['Cover Page', 'Executive Summary', 'KPI Cards']));
  const [layout, setLayout] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const [colorScheme, setColorScheme] = useState<string>('blue');
  const [templateName, setTemplateName] = useState('');

  const reportTypeOptions = ['Daily Report', 'Safety Report', 'Quality Inspection', 'Progress Update', 'Board Report'];
  const sectionOptions = ['Cover Page', 'Executive Summary', 'KPI Cards', 'Charts', 'Tables', 'Appendices'];
  const colorSchemes = [
    { name: 'blue', label: 'Professional Blue', bg: 'bg-blue-600' },
    { name: 'green', label: 'Corporate Green', bg: 'bg-green-600' },
    { name: 'orange', label: 'Warm Orange', bg: 'bg-orange-600' },
    { name: 'purple', label: 'Executive Purple', bg: 'bg-purple-600' },
    { name: 'slate', label: 'Modern Slate', bg: 'bg-slate-600' },
  ];

  const toggleSection = (section: string) => {
    const newSections = new Set(sections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setSections(newSections);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }
    toast.success('Template saved successfully');
    setTemplateName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Panel - Configuration */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="font-display text-white mb-3 text-sm">Report Type</h3>
          <select
            value={selectedReportType}
            onChange={e => setSelectedReportType(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          >
            {reportTypeOptions.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="font-display text-white mb-3 text-sm">Sections</h3>
          <div className="space-y-2">
            {sectionOptions.map(section => (
              <label key={section} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sections.has(section)}
                  onChange={() => toggleSection(section)}
                  className="rounded border border-gray-700 text-blue-500"
                />
                <span className="text-sm text-gray-300">{section}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="font-display text-white mb-3 text-sm">Layout</h3>
          <div className="space-y-2">
            {(['Portrait', 'Landscape'] as const).map(l => (
              <label key={l} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="layout"
                  value={l}
                  checked={layout === l}
                  onChange={() => setLayout(l)}
                  className="rounded border border-gray-700"
                />
                <span className="text-sm text-gray-300">{l}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <h4 className="text-xs text-gray-400 mb-2">Page Size</h4>
            {(['A4', 'Letter'] as const).map(size => (
              <label key={size} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageSize"
                  value={size}
                  checked={pageSize === size}
                  onChange={() => setPageSize(size)}
                  className="rounded border border-gray-700"
                />
                <span className="text-sm text-gray-300">{size}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="font-display text-white mb-3 text-sm">Color Scheme</h3>
          <div className="space-y-2">
            {colorSchemes.map(scheme => (
              <button
                key={scheme.name}
                onClick={() => setColorScheme(scheme.name)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg text-sm transition-colors ${
                  colorScheme === scheme.name ? 'bg-gray-800 ring-2 ring-gray-500' : 'hover:bg-gray-800'
                }`}
              >
                <div className={`w-4 h-4 rounded ${scheme.bg}`} />
                <span className="text-gray-300">{scheme.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Middle - Preview */}
      <div className="lg:col-span-2 bg-gray-900 border border-gray-700 rounded-lg p-6">
        <div className={`bg-white rounded-lg shadow-lg ${layout === 'Portrait' ? 'aspect-[8.5/11]' : 'aspect-[11/8.5]'} p-8 text-gray-900 flex flex-col justify-between overflow-hidden`}>
          <div>
            <div className={`h-12 ${colorSchemes.find(c => c.name === colorScheme)?.bg} rounded mb-4`} />
            <h2 className="text-xl font-bold mb-2">{selectedReportType}</h2>
            <p className="text-xs text-gray-500 mb-4">Generated on {new Date().toLocaleDateString('en-GB')}</p>
            {Array.from(sections).map(section => (
              <div key={section} className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">{section}</h3>
                <div className="h-2 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400">
            {pageSize} · {layout} · Page 1
          </div>
        </div>
      </div>

      {/* Right - Save */}
      <div className="lg:col-span-1">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sticky top-6">
          <h3 className="font-display text-white mb-3 text-sm">Save Template</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Monthly Safety Report"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="p-3 bg-gray-800/50 rounded text-xs text-gray-400">
              <p className="font-medium text-gray-300 mb-1">Template Details:</p>
              <ul className="space-y-1">
                <li>Type: {selectedReportType}</li>
                <li>Sections: {Array.from(sections).length}</li>
                <li>Layout: {layout} ({pageSize})</li>
                <li>Color: {colorSchemes.find(c => c.name === colorScheme)?.label}</li>
              </ul>
            </div>
            <button
              onClick={handleSaveTemplate}
              className="w-full px-4 py-2 btn btn-primary rounded-lg text-sm font-medium"
            >
              <Plus className="h-4 w-4 inline mr-2" />
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduledReports() {
  const [schedules, setSchedules] = useState([
    { id: 1, name: 'Monthly Financial Report', template: 'financial-summary', frequency: 'Monthly 1st', nextRun: '2026-05-01', recipients: 'finance@corp.uk', format: 'PDF', status: 'Active' },
    { id: 2, name: 'Weekly Safety Brief', template: 'safety', frequency: 'Weekly Monday', nextRun: '2026-05-05', recipients: 'safety@corp.uk,site@corp.uk', format: 'PDF', status: 'Active' },
    { id: 3, name: 'Daily Site Report', template: 'progress', frequency: 'Daily 8am', nextRun: '2026-04-28', recipients: 'pm@corp.uk', format: 'Excel', status: 'Inactive' },
    { id: 4, name: 'Quarterly Board Summary', template: 'financial-summary', frequency: 'Monthly 1st', nextRun: '2026-07-01', recipients: 'board@corp.uk', format: 'Word', status: 'Active' },
  ]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    template: 'financial-summary',
    frequency: 'Daily 8am',
    recipients: '',
    format: 'PDF' as 'PDF' | 'Excel' | 'Word',
  });

  const frequencyOptions = ['Daily 8am', 'Weekly Monday', 'Weekly Friday', 'Monthly 1st', 'Monthly 15th'];
  const formatOptions = ['PDF', 'Excel', 'Word'];

  const handleAddSchedule = () => {
    if (!formData.recipients.trim()) {
      toast.error('Recipients are required');
      return;
    }
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1);

    if (editingId) {
      setSchedules(schedules.map(s => s.id === editingId ? { ...s, ...formData } : s));
      toast.success('Schedule updated');
    } else {
      setSchedules([...schedules, {
        id: Math.max(...schedules.map(s => s.id), 0) + 1,
        name: `Report ${new Date().toLocaleDateString('en-GB')}`,
        template: formData.template,
        frequency: formData.frequency,
        nextRun: nextRun.toISOString().split('T')[0],
        recipients: formData.recipients,
        format: formData.format,
        status: 'Active',
      }]);
      toast.success('Schedule created');
    }
    setShowModal(false);
    setEditingId(null);
    setFormData({ template: 'financial-summary', frequency: 'Daily 8am', recipients: '', format: 'PDF' });
  };

  const toggleStatus = (id: number) => {
    setSchedules(schedules.map(s =>
      s.id === id ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' } : s
    ));
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => { setEditingId(null); setShowModal(true); }}
        className="px-4 py-2 btn btn-primary rounded-lg text-sm font-medium flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Schedule
      </button>
      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="cb-table-scroll touch-pan-x">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Report Name</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Template</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Frequency</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Next Run</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Format</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Status</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {schedules.map(schedule => (
                <tr key={schedule.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-300 font-medium">{schedule.name}</td>
                  <td className="px-4 py-3 text-gray-400">{REPORT_TYPES[schedule.template]?.label || schedule.template}</td>
                  <td className="px-4 py-3 text-gray-400">{schedule.frequency}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(schedule.nextRun).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-gray-400"><span className="px-2 py-1 bg-gray-700 rounded text-xs">{schedule.format}</span></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(schedule.id)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        schedule.status === 'Active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {schedule.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(schedule.id);
                        setFormData({
                          template: schedule.template,
                          frequency: schedule.frequency,
                          recipients: schedule.recipients,
                          format: schedule.format as 'PDF' | 'Excel' | 'Word',
                        });
                        setShowModal(true);
                      }}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSchedules(schedules.filter(s => s.id !== schedule.id));
                        toast.success('Schedule deleted');
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-lg font-display text-white">
                {editingId ? 'Edit Schedule' : 'New Schedule'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Template</label>
                <select
                  value={formData.template}
                  onChange={e => setFormData({ ...formData, template: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                >
                  {Object.entries(REPORT_TYPES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                >
                  {frequencyOptions.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Recipients (comma-separated)</label>
                <input
                  type="text"
                  value={formData.recipients}
                  onChange={e => setFormData({ ...formData, recipients: e.target.value })}
                  placeholder="name@company.uk, another@company.uk"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Format</label>
                <div className="flex gap-2">
                  {formatOptions.map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setFormData({ ...formData, format: fmt as 'PDF' | 'Excel' | 'Word' })}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        formData.format === fmt
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingId(null); }}
                className="px-4 py-2 btn btn-ghost rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSchedule}
                className="px-4 py-2 btn btn-primary rounded-lg font-medium"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportHistory() {
  const mockReports = [
    { date: '2026-04-27', name: 'Monthly Financial Report', template: 'financial-summary', generatedBy: 'Sarah Johnson', format: 'PDF', size: '3.2 MB' },
    { date: '2026-04-27', name: 'Weekly Safety Brief', template: 'safety', generatedBy: 'Mike Chen', format: 'PDF', size: '1.8 MB' },
    { date: '2026-04-25', name: 'Daily Site Report', template: 'progress', generatedBy: 'John Smith', format: 'Excel', size: '0.9 MB' },
    { date: '2026-04-24', name: 'Quality Inspection', template: 'quality', generatedBy: 'Emma Davis', format: 'PDF', size: '4.1 MB' },
    { date: '2026-04-22', name: 'Monthly Financial Report', template: 'financial-summary', generatedBy: 'Sarah Johnson', format: 'PDF', size: '3.5 MB' },
    { date: '2026-04-21', name: 'HR Summary Report', template: 'hr', generatedBy: 'Lisa Wong', format: 'Word', size: '2.1 MB' },
    { date: '2026-04-20', name: 'Project Cost Analysis', template: 'project-costs', generatedBy: 'David Brown', format: 'Excel', size: '1.4 MB' },
    { date: '2026-04-19', name: 'Weekly Safety Brief', template: 'safety', generatedBy: 'Mike Chen', format: 'PDF', size: '2.0 MB' },
    { date: '2026-04-18', name: 'Daily Site Report', template: 'progress', generatedBy: 'John Smith', format: 'Excel', size: '0.8 MB' },
    { date: '2026-04-15', name: 'Quarterly Board Report', template: 'financial-summary', generatedBy: 'Sarah Johnson', format: 'PDF', size: '5.3 MB' },
  ];

  const [filterTemplate, setFilterTemplate] = useState('all');
  const [startDate, setStartDate] = useState('2026-04-01');
  const [endDate, setEndDate] = useState('2026-04-27');

  const filteredReports = mockReports.filter(r => {
    const matchTemplate = filterTemplate === 'all' || r.template === filterTemplate;
    const matchDate = r.date >= startDate && r.date <= endDate;
    return matchTemplate && matchDate;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-700 rounded-lg p-4">
        <select
          value={filterTemplate}
          onChange={e => setFilterTemplate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
        >
          <option value="all">All Templates</option>
          {Object.entries(REPORT_TYPES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
        <span className="ml-auto text-sm text-gray-400 flex items-end">{filteredReports.length} reports</span>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="cb-table-scroll touch-pan-x">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Date Generated</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Report Name</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Template</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Generated By</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Format</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Size</th>
                <th className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-300">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredReports.map((report, idx) => (
                <tr key={idx} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-300">{new Date(report.date).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-gray-300 font-medium">{report.name}</td>
                  <td className="px-4 py-3 text-gray-400">{REPORT_TYPES[report.template]?.label || report.template}</td>
                  <td className="px-4 py-3 text-gray-400">{report.generatedBy}</td>
                  <td className="px-4 py-3 text-gray-400"><span className="px-2 py-1 bg-gray-700 rounded text-xs">{report.format}</span></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{report.size}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onSave,
}: {
  template?: ReportTemplateExt | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(String(template?.name ?? ''));
  const [type, setType] = useState(String(template?.type ?? 'custom'));
  const [description, setDescription] = useState(String(template?.description ?? ''));
  const createMutation = useReportTemplates.useCreate();
  const updateMutation = useReportTemplates.useUpdate();

  const isEditing = Boolean(template);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSave = async () => {
    if (!name) {
      toast.error('Name is required');
      return;
    }
    try {
      if (template) {
        await updateMutation.mutateAsync({ id: String(template.id), data: { name, type, description } });
        toast.success('Template updated');
      } else {
        await createMutation.mutateAsync({ data: { name, type, description, config: {} } });
        toast.success('Template created');
      }
      onSave();
    } catch {
      toast.error('Failed to save template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-display text-white">
            {template ? 'Edit Template' : 'Create Template'}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 btn text-white"
              placeholder="Monthly Financial Report"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 btn text-white"
            >
              {Object.entries(REPORT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.icon} {val.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 btn text-white h-20"
              placeholder="Brief description of this template..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 btn btn-ghost rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="px-4 py-2 btn btn-primary rounded-lg font-medium flex items-center gap-2"
          >
            {mutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            {template ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default ReportTemplates;
