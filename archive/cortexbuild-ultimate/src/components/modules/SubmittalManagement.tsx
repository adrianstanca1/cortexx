import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Download,
  MessageSquare,
  Eye
} from 'lucide-react';
import { submittalsApi } from '../../services/api';
import { toast } from 'sonner';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

interface Submittal {
  id: string;
  number: string;
  title: string;
  type: 'Shop Drawing' | 'Product Data' | 'Sample' | 'Certificate' | 'Test Report';
  submittedBy: string;
  submittedDate: Date;
  dueDate: Date;
  status: 'pending' | 'under-review' | 'approved' | 'approved-with-comments' | 'rejected' | 'resubmit-required';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reviewer: string;
  description: string;
  files: string[];
  comments: number;
  revisionNumber: number;
  trade: string;
}

// API response shape maps to Submittal interface
function mapApiToSubmittal(item: Record<string, unknown>): Submittal {
  return {
    id: String(item.id || ''),
    number: String(item.submittal_number || item.number || ''),
    title: String(item.title || ''),
    type: (item.type as Submittal['type']) || 'Product Data',
    submittedBy: String(item.submitted_by || item.submittedBy || ''),
    submittedDate: new Date(typeof item.submitted_date === 'string' ? item.submitted_date : typeof item.submittedDate === 'string' ? item.submittedDate : Date.now()),
    dueDate: new Date(typeof item.due_date === 'string' ? item.due_date : typeof item.dueDate === 'string' ? item.dueDate : Date.now()),
    status: (item.status as Submittal['status']) || 'pending',
    priority: (item.priority as Submittal['priority']) || 'medium',
    reviewer: String(item.reviewer || ''),
    description: String(item.description || ''),
    files: Array.isArray(item.files) ? (item.files as string[]).map(String) : [],
    comments: Number(item.comments || item.comment_count || 0),
    revisionNumber: Number(item.revision_number ?? item.revisionNumber ?? 1),
    trade: String(item.trade || ''),
  };
}

// Mock data fallback for when API is unavailable
const MOCK_SUBMITTALS: Submittal[] = [
  {
    id: '1',
    number: 'SUB-001',
    title: 'Structural Steel Shop Drawings',
    type: 'Shop Drawing',
    submittedBy: 'Steel Fabricators Ltd',
    submittedDate: new Date('2026-03-28'),
    dueDate: new Date('2026-04-05'),
    status: 'under-review',
    priority: 'high',
    reviewer: 'James Wilson',
    description: 'Shop drawings for main structural steel frame, Level 1-3',
    files: ['steel-drawings-v2.pdf', 'connection-details.dwg'],
    comments: 3,
    revisionNumber: 2,
    trade: 'Structural',
  },
  {
    id: '2',
    number: 'SUB-002',
    title: 'HVAC Equipment Product Data',
    type: 'Product Data',
    submittedBy: 'Climate Systems Inc',
    submittedDate: new Date('2026-03-25'),
    dueDate: new Date('2026-04-02'),
    status: 'approved-with-comments',
    priority: 'medium',
    reviewer: 'Sarah Mitchell',
    description: 'Product data sheets for rooftop HVAC units and indoor air handlers',
    files: ['hvac-product-data.pdf', 'performance-specs.xlsx'],
    comments: 5,
    revisionNumber: 1,
    trade: 'HVAC',
  },
  {
    id: '3',
    number: 'SUB-003',
    title: 'Curtain Wall System Sample',
    type: 'Sample',
    submittedBy: 'Glazing Solutions Ltd',
    submittedDate: new Date('2026-03-30'),
    dueDate: new Date('2026-04-10'),
    status: 'pending',
    priority: 'critical',
    reviewer: 'Michael Chen',
    description: 'Physical sample of curtain wall glazing system for facade',
    files: ['sample-specs.pdf', 'installation-guide.pdf'],
    comments: 0,
    revisionNumber: 1,
    trade: 'Exterior',
  },
  {
    id: '4',
    number: 'SUB-004',
    title: 'Fire Safety Test Report',
    type: 'Test Report',
    submittedBy: 'Fire Protection Co',
    submittedDate: new Date('2026-03-20'),
    dueDate: new Date('2026-03-28'),
    status: 'approved',
    priority: 'high',
    reviewer: 'Lisa Thompson',
    description: 'Fire resistance testing report for structural steel assemblies',
    files: ['fire-test-report.pdf', 'certification.pdf'],
    comments: 2,
    revisionNumber: 1,
    trade: 'Fire Safety',
  },
  {
    id: '5',
    number: 'SUB-005',
    title: 'Concrete Mix Design',
    type: 'Certificate',
    submittedBy: 'Premier Concrete Ltd',
    submittedDate: new Date('2026-03-15'),
    dueDate: new Date('2026-03-25'),
    status: 'rejected',
    priority: 'high',
    reviewer: 'David Park',
    description: 'Mix design certification for high-strength concrete foundation',
    files: ['mix-design.pdf'],
    comments: 7,
    revisionNumber: 3,
    trade: 'Concrete',
  },
];

export const SubmittalManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedSubmittal, setSelectedSubmittal] = useState<Submittal | null>(null);
  const [_showFilters, _setShowFilters] = useState(false);
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubmittals() {
      try {
        setLoading(true);
        const data = await submittalsApi.getAll();
        const items: Record<string, unknown>[] = Array.isArray(data)
          ? data
          : Array.isArray((data as Record<string, unknown>).submittals)
            ? (data as Record<string, unknown>).submittals as Record<string, unknown>[]
            : [];
        setSubmittals(items.map((item) => mapApiToSubmittal(item)));
      } catch {
        toast.error('Failed to load submittals — using offline data');
        setSubmittals(MOCK_SUBMITTALS);
      } finally {
        setLoading(false);
      }
    }
    loadSubmittals();
  }, []);

  // Expose reload for create/update operations
  const _reloadSubmittals = async () => {
    try {
      const data = await submittalsApi.getAll();
      const items: Record<string, unknown>[] = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>).submittals)
          ? (data as Record<string, unknown>).submittals as Record<string, unknown>[]
          : [];
      setSubmittals(items.map((item) => mapApiToSubmittal(item)));
    } catch {
      toast.error('Failed to refresh submittals');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'under-review': return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'approved-with-comments': return <CheckCircle className="h-4 w-4 text-yellow-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'resubmit-required': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'under-review': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'approved-with-comments': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'resubmit-required': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredSubmittals = submittals.filter(submittal => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending', 'under-review'].includes(submittal.status);
    if (activeTab === 'approved') return ['approved', 'approved-with-comments'].includes(submittal.status);
    if (activeTab === 'rejected') return ['rejected', 'resubmit-required'].includes(submittal.status);
    return true;
  });

  const getDaysUntilDue = (dueDate: Date): number => {
    const today = new Date();
    const timeDiff = dueDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const statusCounts = {
    pending: submittals.filter(s => ['pending', 'under-review'].includes(s.status)).length,
    approved: submittals.filter(s => ['approved', 'approved-with-comments'].includes(s.status)).length,
    rejected: submittals.filter(s => ['rejected', 'resubmit-required'].includes(s.status)).length,
    total: submittals.length
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <ModuleBreadcrumbs currentModule="submittal-management" />
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Upload className="h-8 w-8 text-blue-600" />
            Submittal Management
          </h1>
          <p className="text-gray-600 mt-1">Document review, approval workflows & compliance tracking</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Upload className="h-4 w-4" />
            New Submittal
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Submittals</p>
                <p className="text-2xl font-bold text-gray-900">{statusCounts.total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="card-header">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'all', label: `All (${statusCounts.total})` },
              { key: 'pending', label: `Pending (${statusCounts.pending})` },
              { key: 'approved', label: `Approved (${statusCounts.approved})` },
              { key: 'rejected', label: `Rejected (${statusCounts.rejected})` }
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab(key as 'all' | 'pending' | 'approved' | 'rejected')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-content">
          <div className="cb-table-scroll touch-pan-x">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Submittal</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Submitted By</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Due Date</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Priority</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Comments</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmittals.map((submittal) => {
                  const daysUntilDue = getDaysUntilDue(submittal.dueDate);
                  const isOverdue = daysUntilDue < 0;
                  const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;

                  return (
                    <tr
                      key={submittal.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedSubmittal(submittal)}
                    >
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{submittal.number}</div>
                          <div className="text-sm text-gray-600">{submittal.title}</div>
                          <div className="text-xs text-gray-500">{submittal.trade}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                          {submittal.type}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">{submittal.submittedBy}</div>
                        <div className="text-xs text-gray-500">Rev {submittal.revisionNumber}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className={`text-sm ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {submittal.dueDate.toLocaleDateString()}
                        </div>
                        <div className={`text-xs ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-500'}`}>
                          {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : 
                           isDueSoon ? `${daysUntilDue} days left` : 
                           `${daysUntilDue} days`}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(submittal.priority)}`}>
                          {submittal.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(submittal.status)}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(submittal.status)}`}>
                            {submittal.status.replace('-', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{submittal.comments}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button className="text-gray-600 hover:text-gray-800">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-800">
                            <Download className="h-4 w-4" />
                          </button>
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

      {/* Submittal Detail Modal */}
      {selectedSubmittal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedSubmittal.number}</h2>
                  <p className="text-gray-600">{selectedSubmittal.title}</p>
                </div>
                <button
                  onClick={() => setSelectedSubmittal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm font-medium">
                      {selectedSubmittal.type}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Submitted By</label>
                    <p className="text-sm text-gray-900">{selectedSubmittal.submittedBy}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer</label>
                    <p className="text-sm text-gray-900">{selectedSubmittal.reviewer}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
                    <p className="text-sm text-gray-900">{selectedSubmittal.trade}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <span className={`px-3 py-1 rounded text-sm font-medium ${getPriorityColor(selectedSubmittal.priority)}`}>
                      {selectedSubmittal.priority}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedSubmittal.status)}
                      <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(selectedSubmittal.status)}`}>
                        {selectedSubmittal.status.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <p className="text-sm text-gray-900">{selectedSubmittal.dueDate.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Revision</label>
                    <p className="text-sm text-gray-900">Rev {selectedSubmittal.revisionNumber}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-sm text-gray-900">{selectedSubmittal.description}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Attached Files</label>
                <div className="space-y-2">
                  {selectedSubmittal.files.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-600" />
                      <span className="flex-1 text-sm text-gray-900">{file}</span>
                      <button className="text-blue-600 hover:text-blue-800">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedSubmittal(null)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Reject
                </button>
                <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                  Approve with Comments
                </button>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmittalManagement;
