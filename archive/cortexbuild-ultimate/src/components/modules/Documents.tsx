import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, Download, Eye, Edit2, Trash2, X, Upload, FileCheck, Image, FolderOpen,
  BarChart3, Grid, List, FileIcon as FileIconDefault, History, UploadCloud, PenLine, Sparkles, Loader2,
  Send, Users, Mail, Clock, CheckCircle, AlertCircle, ChevronDown, TrendingUp, PieChart as PieChartIcon,
  RefreshCw, User
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { API_BASE } from '@/lib/auth-storage';
import { signaturesApi } from '../../services/api';
import { SignatureCapture, SignatureDisplay } from '../ui/SignatureCapture';
import { useAuth } from '../../context/AuthContext';
import type { Signature } from '../../services/api';
import { analyzeDocument, type AnalyzeDocumentResponse } from '../../services/ai';

interface DocumentVersion {
  id: string;
  version: string;
  file_path: string;
  uploaded_by: string;
  changes: string;
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  project_id: string;
  project: string;
  uploaded_by: string;
  version: string;
  size: string;
  status: string;
  category: string;
  file_path?: string;
  access_level: string;
  parent_folder: string;
  created_at: string;
  versions?: DocumentVersion[];
  ai_extracted_snippet?: string | null;
  ai_analysis_cache?: AnalyzeDocumentResponse | Record<string, unknown> | null;
  ai_analysis_at?: string | null;
}

interface Transmittal {
  id: string;
  number: string;
  date: string;
  to: string[];
  subject: string;
  purpose: 'For Approval' | 'For Information' | 'For Construction';
  documents: string[];
  status: 'Draft' | 'Sent' | 'Acknowledged' | 'Rejected';
  responses: { recipient: string; status: string; date: string }[];
}

interface ControlledDocument {
  id: string;
  number: string;
  title: string;
  currentRevision: string;
  dateIssued: string;
  author: string;
  status: 'Current' | 'Superseded' | 'Obsolete';
  purpose: string;
  revisionHistory: { revision: string; date: string; changes: string }[];
}

const CATEGORIES = ['PLANS', 'DRAWINGS', 'PERMITS', 'RAMS', 'CONTRACTS', 'REPORTS', 'SPECS', 'PHOTOS'];
const ACCESS_LEVELS = [
  { value: 'public', label: 'Public', color: 'text-green-400' },
  { value: 'internal', label: 'Internal', color: 'text-blue-400' },
  { value: 'restricted', label: 'Restricted', color: 'text-amber-400' },
  { value: 'confidential', label: 'Confidential', color: 'text-red-400' },
];

function _formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'PDF': return FileText;
    case 'DOC': case 'DOCX': return FileCheck;
    case 'XLS': case 'XLSX': return BarChart3;
    case 'JPG': case 'JPEG': case 'PNG': case 'GIF': case 'WEBP': return Image;
    default: return FileIconDefault;
  }
}

function getTypeColor(type: string) {
  switch (type.toUpperCase()) {
    case 'PDF': return 'bg-red-500/20 text-red-400';
    case 'DOC': case 'DOCX': return 'bg-blue-500/20 text-blue-400';
    case 'XLS': case 'XLSX': return 'bg-green-500/20 text-green-400';
    case 'JPG': case 'JPEG': case 'PNG': case 'GIF': case 'WEBP': return 'bg-purple-500/20 text-purple-400';
    default: return 'bg-slate-700 text-slate-400';
  }
}

export function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('REPORTS');
  const [selectedAccess, setSelectedAccess] = useState<string>('public');
  const [dragOver, setDragOver] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [existingSignatures, setExistingSignatures] = useState<Signature[]>([]);
  const [docIntel, setDocIntel] = useState<AnalyzeDocumentResponse | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelRefreshing, setIntelRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'transmittals' | 'controlled' | 'analytics'>('library');
  const [transmittals, setTransmittals] = useState<Transmittal[]>([
    {
      id: '1',
      number: 'TM-001',
      date: new Date(Date.now() - 86400000).toISOString(),
      to: ['client@example.com', 'architect@example.com'],
      subject: 'Structural drawings for review',
      purpose: 'For Approval',
      documents: ['DOC-STR-001', 'DOC-STR-002'],
      status: 'Sent',
      responses: [
        { recipient: 'client@example.com', status: 'Acknowledged', date: new Date(Date.now() - 43200000).toISOString() }
      ]
    }
  ]);
  const [controlledDocuments, setControlledDocuments] = useState<ControlledDocument[]>([
    {
      id: '1',
      number: 'DOC-001',
      title: 'Health & Safety Policy',
      currentRevision: 'Rev 4',
      dateIssued: new Date(Date.now() - 2592000000).toISOString(),
      author: 'Safety Manager',
      status: 'Current',
      purpose: 'Compliance',
      revisionHistory: [
        { revision: 'Rev 4', date: new Date(Date.now() - 2592000000).toISOString(), changes: 'Updated incident reporting procedure' },
        { revision: 'Rev 3', date: new Date(Date.now() - 5184000000).toISOString(), changes: 'Added new PPE requirements' }
      ]
    },
    {
      id: '2',
      number: 'DOC-002',
      title: 'Site Safety Plan',
      currentRevision: 'Rev 2',
      dateIssued: new Date(Date.now() - 1296000000).toISOString(),
      author: 'Site Manager',
      status: 'Current',
      purpose: 'Project Safety',
      revisionHistory: [
        { revision: 'Rev 2', date: new Date(Date.now() - 1296000000).toISOString(), changes: 'Updated for Phase 2' }
      ]
    }
  ]);
  const [showTransmittalModal, setShowTransmittalModal] = useState(false);
  const [transmittalForm, setTransmittalForm] = useState({ recipients: '', subject: '', purpose: 'For Information' as const, selectedDocs: [] as string[] });
  const [expandedControlled, setExpandedControlled] = useState<string | null>(null);
  const [controlledFilter, setControlledFilter] = useState<string>('ALL');

  const { user } = useAuth();

  // Intentionally key off document id only — avoid refetch when the same row is re-selected with a new object identity.
  useEffect(() => {
    if (!selectedDoc) {
      setDocIntel(null);
      return;
    }
    setDocIntel(null);
    let cancelled = false;
    const docId = String(selectedDoc.id);
    (async () => {
      setIntelLoading(true);
      try {
        const r = await analyzeDocument(docId, { useCache: true });
        if (!cancelled) setDocIntel(r);
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message || 'Could not load document intelligence');
      } finally {
        if (!cancelled) setIntelLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedDoc.id is the stable key; full selectedDoc would over-trigger
  }, [selectedDoc?.id]);

  const runDocAnalysisRefresh = async () => {
    if (!selectedDoc) return;
    setIntelRefreshing(true);
    try {
      const r = await analyzeDocument(String(selectedDoc.id), { useCache: false });
      setDocIntel(r);
      toast.success('AI analysis refreshed');
    } catch (err) {
      toast.error((err as Error).message || 'AI analysis failed');
    } finally {
      setIntelRefreshing(false);
    }
  };

  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (searchQuery) params.append('search', searchQuery);
      params.append('include_versions', 'true');
      const res = await fetch(`${API_BASE}/files?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDocuments(data.data || []);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchQuery]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleUpload = async (file: File, category: string, access: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('access_level', access);
    formData.append('name', file.name);
    try {
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      toast.success(`Uploaded ${file.name}`);
      setShowUploadModal(false);
      fetchDocuments();
    } catch (err) { toast.error((err as Error).message || 'Upload failed'); }
  };

  const handleUploadVersion = async (docId: string, file: File, changes: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('changes', changes);
    try {
      const res = await fetch(`${API_BASE}/files/${docId}/upload-version`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      toast.success('New version uploaded');
      setShowVersionHistory(false);
      fetchDocuments();
    } catch { toast.error('Upload failed'); }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const res = await fetch(`${API_BASE}/files/${doc.id}/download`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const handlePreview = (doc: Document) => {
    const previewUrl = `${API_BASE}/files/${doc.id}/preview`;
    setPreviewDoc({ ...doc, file_path: previewUrl });
  };

  const handleUpdate = async (docId: string, updates: Partial<Document>) => {
    try {
      const res = await fetch(`${API_BASE}/files/${docId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Document updated');
      setEditingDoc(null);
      fetchDocuments();
    } catch { toast.error('Update failed'); }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Document deleted');
      setSelectedDoc(null);
      fetchDocuments();
    } catch { toast.error('Delete failed'); }
  };

  async function openSignModal() {
    if (!selectedDoc) return;
    setShowSignModal(true);
    try {
      const res = await signaturesApi.getByDocument('document', String(selectedDoc.id));
      setExistingSignatures(Array.isArray(res.data) ? res.data : []);
    } catch {
      setExistingSignatures([]);
    }
  }

  async function handleDocSignature(signatureData: string) {
    if (!selectedDoc || !user) return;
    try {
      await signaturesApi.create({
        document_type: 'document',
        document_id: String(selectedDoc.id),
        signer_name: user.name || user.email || 'Unknown',
        signer_role: user.role || 'Document Approver',
        signer_email: user.email,
        signature_data: signatureData,
      });
      toast.success('Document signed successfully');
      setShowSignModal(false);
    } catch {
      toast.error('Failed to save signature');
    }
  }

  const filteredDocs = documents.filter(doc => doc.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const isImage = (type: string) => ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(type.toUpperCase());
  const isPdf = (type: string) => type.toUpperCase() === 'PDF';

  const handleCreateTransmittal = () => {
    const newTransmittal: Transmittal = {
      id: String(Date.now()),
      number: `TM-${String(transmittals.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString(),
      to: transmittalForm.recipients.split(',').map(r => r.trim()),
      subject: transmittalForm.subject,
      purpose: transmittalForm.purpose,
      documents: transmittalForm.selectedDocs,
      status: 'Sent',
      responses: []
    };
    setTransmittals(prev => [...prev, newTransmittal]);
    setShowTransmittalModal(false);
    setTransmittalForm({ recipients: '', subject: '', purpose: 'For Information', selectedDocs: [] });
    toast.success('Transmittal sent successfully');
  };

  const analyticsData = {
    byCategory: [
      { name: 'PLANS', value: documents.filter(d => d.category === 'PLANS').length },
      { name: 'DRAWINGS', value: documents.filter(d => d.category === 'DRAWINGS').length },
      { name: 'PERMITS', value: documents.filter(d => d.category === 'PERMITS').length },
      { name: 'RAMS', value: documents.filter(d => d.category === 'RAMS').length },
      { name: 'CONTRACTS', value: documents.filter(d => d.category === 'CONTRACTS').length },
      { name: 'REPORTS', value: documents.filter(d => d.category === 'REPORTS').length }
    ].filter(d => d.value > 0),
    byType: [
      { name: 'PDF', value: documents.filter(d => d.type === 'PDF').length, fill: '#ef4444' },
      { name: 'DOCX', value: documents.filter(d => d.type === 'DOCX').length, fill: '#3b82f6' },
      { name: 'XLSX', value: documents.filter(d => d.type === 'XLSX').length, fill: '#22c55e' },
      { name: 'Images', value: documents.filter(d => ['JPG', 'PNG', 'JPEG'].includes(d.type.toUpperCase())).length, fill: '#a855f7' },
      { name: 'Other', value: documents.filter(d => !['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'JPEG'].includes(d.type.toUpperCase())).length, fill: '#64748b' }
    ].filter(d => d.value > 0),
    uploadTrend: [
      { week: 'W1', uploads: 3 },
      { week: 'W2', uploads: 5 },
      { week: 'W3', uploads: 2 },
      { week: 'W4', uploads: 7 },
      { week: 'W5', uploads: 4 },
      { week: 'W6', uploads: 6 },
      { week: 'W7', uploads: 8 },
      { week: 'W8', uploads: documents.length }
    ],
    topContributors: [
      { name: 'John Smith', uploads: 12 },
      { name: 'Alice Johnson', uploads: 9 },
      { name: 'Bob Wilson', uploads: 7 },
      { name: 'Carol Davis', uploads: 5 }
    ]
  };

  const pendingApproval = documents.filter(d => d.status === 'pending_approval').length;
  const expiringDocs = 0;

  return (
    <>
      <ModuleBreadcrumbs currentModule="documents" />
      <div className="min-h-screen bg-slate-950 p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-3xl font-display text-white">Documents</h1><p className="text-sm text-slate-400 mt-1">{documents.length} files</p></div>
        <div className="flex gap-2">
          {activeTab === 'transmittals' && <button onClick={() => setShowTransmittalModal(true)} className="btn-primary flex items-center gap-2"><Send className="w-4 h-4" /> New Transmittal</button>}
          {activeTab === 'library' && <button onClick={() => setShowUploadModal(true)} className="btn-primary flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Upload</button>}
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
        {(['library', 'transmittals', 'controlled', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            )}
          >
            {tab === 'library' && 'Document Library'}
            {tab === 'transmittals' && 'Transmittals'}
            {tab === 'controlled' && 'Controlled Documents'}
            {tab === 'analytics' && 'Analytics'}
          </button>
        ))}
      </div>

      {activeTab === 'library' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1" style={{minWidth: '200px'}}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input pl-10 w-full" />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input w-auto">
              <option value="ALL">All Categories</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <div className="flex gap-1">
              <button onClick={() => setViewMode('grid')} className={clsx('btn-secondary p-2', viewMode === 'grid' && 'bg-slate-600')}><Grid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={clsx('btn-secondary p-2', viewMode === 'list' && 'bg-slate-600')}><List className="w-4 h-4" /></button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-20 bg-slate-800 rounded mb-3"></div><div className="h-4 bg-slate-800 rounded w-3/4 mb-2"></div><div className="h-3 bg-slate-800 rounded w-1/2"></div></div>)}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredDocs.map(doc => {
                const FileIcon = getFileIcon(doc.type);
                return (
                  <div key={doc.id} className="card p-4 cursor-pointer hover:border-amber-500/50 transition-all" onClick={() => setSelectedDoc(doc)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={clsx('w-12 h-12 rounded-lg flex items-center justify-center', getTypeColor(doc.type))}><FileIcon className="w-6 h-6" /></div>
                      <span className="badge bg-slate-700 text-slate-300 text-xs">{doc.category}</span>
                    </div>
                    <h4 className="font-medium text-slate-200 text-sm mb-1 truncate" title={doc.name}>{doc.name}</h4>
                    <p className="text-xs text-slate-500 mb-2">{doc.type} - {doc.size} - v{doc.version}</p>
                    <div className="flex items-center justify-between">
                      <span className={clsx('text-xs', ACCESS_LEVELS.find(al => al.value === doc.access_level)?.color || 'text-slate-500')}>{doc.access_level}</span>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handlePreview(doc); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Type</th><th>Category</th><th>Access</th><th>Version</th><th>Size</th><th className="w-24">Actions</th></tr></thead>
                <tbody>
                  {filteredDocs.map(doc => (
                    <tr key={doc.id} className="cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                      <td><div className="flex items-center gap-2">{React.createElement(getFileIcon(doc.type), { className: 'w-4 h-4 text-slate-400' })}<span className="truncate max-w-xs">{doc.name}</span></div></td>
                      <td>{doc.type}</td><td><span className="badge bg-slate-700 text-slate-300 text-xs">{doc.category}</span></td>
                      <td><span className={clsx('text-xs', ACCESS_LEVELS.find(al => al.value === doc.access_level)?.color)}>{doc.access_level}</span></td>
                      <td>v{doc.version}</td><td>{doc.size}</td>
                      <td><div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handlePreview(doc); }} className="p-1.5 hover:bg-slate-700 rounded"><Eye className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} className="p-1.5 hover:bg-slate-700 rounded"><Download className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setShowVersionHistory(true); setSelectedDoc(doc); }} className="p-1.5 hover:bg-slate-700 rounded"><History className="w-4 h-4" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredDocs.length === 0 && !loading && (
            <EmptyState
              icon={FolderOpen}
              title="No documents found"
              description="Upload your first document to get started."
            />
          )}
        </div>
      )}

      {activeTab === 'transmittals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-sm text-slate-400">Total Transmittals</p>
              <p className="text-3xl font-bold text-white mt-1">{transmittals.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-400">Awaiting Response</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{transmittals.filter(t => t.status === 'Sent').length}</p>
            </div>
          </div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Transmittal #</th><th>Date</th><th>To</th><th>Subject</th><th># Docs</th><th>Purpose</th><th>Status</th><th className="w-24">Action</th></tr></thead>
              <tbody>
                {transmittals.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium text-amber-400">{t.number}</td>
                    <td className="text-sm text-slate-400">{new Date(t.date).toLocaleDateString('en-GB')}</td>
                    <td className="text-sm">{t.to.length} recipient{t.to.length !== 1 ? 's' : ''}</td>
                    <td className="truncate">{t.subject}</td>
                    <td>{t.documents.length}</td>
                    <td><span className="badge bg-slate-700 text-slate-300 text-xs">{t.purpose}</span></td>
                    <td><span className={clsx('badge text-xs', t.status === 'Sent' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400')}>{t.status}</span></td>
                    <td><button onClick={() => setSelectedDoc(null)} className="p-1.5 hover:bg-slate-700 rounded"><Eye className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'controlled' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select value={controlledFilter} onChange={e => setControlledFilter(e.target.value)} className="input w-auto">
              <option value="ALL">All Documents</option>
              <option value="Current">Current</option>
              <option value="Superseded">Superseded</option>
              <option value="Obsolete">Obsolete</option>
            </select>
          </div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Document #</th><th>Title</th><th>Revision</th><th>Date Issued</th><th>Author</th><th>Status</th><th>Purpose</th><th className="w-8"></th></tr></thead>
              <tbody>
                {controlledDocuments.filter(d => controlledFilter === 'ALL' || d.status === controlledFilter).map(doc => (
                  <React.Fragment key={doc.id}>
                    <tr className="cursor-pointer hover:bg-slate-800" onClick={() => setExpandedControlled(expandedControlled === doc.id ? null : doc.id)}>
                      <td className="font-medium text-amber-400">{doc.number}</td>
                      <td>{doc.title}</td>
                      <td className="text-sm font-mono text-slate-400">{doc.currentRevision}</td>
                      <td className="text-sm text-slate-400">{new Date(doc.dateIssued).toLocaleDateString('en-GB')}</td>
                      <td className="text-sm">{doc.author}</td>
                      <td><span className={clsx('badge text-xs', doc.status === 'Current' ? 'bg-green-500/20 text-green-400' : doc.status === 'Superseded' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}>{doc.status}</span></td>
                      <td className="text-sm text-slate-400">{doc.purpose}</td>
                      <td><ChevronDown className={clsx('w-4 h-4 transition-transform', expandedControlled === doc.id && 'rotate-180')} /></td>
                    </tr>
                    {expandedControlled === doc.id && (
                      <tr>
                        <td colSpan={8} className="bg-slate-800/50 p-4">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-300">Revision History</p>
                            {doc.revisionHistory.map((rev, idx) => (
                              <div key={idx} className="text-sm text-slate-400 pl-4 border-l border-slate-600">
                                <p className="font-mono text-amber-400">{rev.revision}</p>
                                <p className="text-xs text-slate-500">{new Date(rev.date).toLocaleDateString('en-GB')} — {rev.changes}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
              <p className="text-sm text-slate-400">Total Documents</p>
              <p className="text-3xl font-bold text-white mt-1">{documents.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-400">Uploaded This Month</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">12</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-400">Pending Approval</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{pendingApproval}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-400">Expiring Soon</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{expiringDocs}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-medium text-white mb-4">Documents by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
                  <Bar dataKey="value" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-6">
              <h3 className="font-medium text-white mb-4">Documents by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={analyticsData.byType} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {analyticsData.byType.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-medium text-white mb-4">Upload Trend (8 Weeks)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.uploadTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="week" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="uploads" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="font-medium text-white">Top Contributors</h3>
            </div>
            <table className="data-table">
              <thead><tr><th>Contributor</th><th className="text-right">Documents Uploaded</th><th className="text-right">% of Total</th></tr></thead>
              <tbody>
                {analyticsData.topContributors.map((contributor, idx) => {
                  const percentage = ((contributor.uploads / documents.length) * 100).toFixed(0);
                  return (
                    <tr key={idx}>
                      <td className="flex items-center gap-2"><div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-xs font-bold">{contributor.name.charAt(0)}</div>{contributor.name}</td>
                      <td className="text-right font-medium text-amber-400">{contributor.uploads}</td>
                      <td className="text-right text-slate-400">{percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-display">Document Details</h2><button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-slate-800 rounded"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div className={clsx('w-20 h-20 rounded-lg flex items-center justify-center mx-auto', getTypeColor(selectedDoc.type))}>{React.createElement(getFileIcon(selectedDoc.type), { className: 'w-10 h-10' })}</div>
              <div className="text-center"><h3 className="font-medium text-white break-words">{selectedDoc.name}</h3><p className="text-sm text-slate-500">{selectedDoc.type} - {selectedDoc.size}</p></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800 p-3 rounded-lg"><p className="text-slate-500 mb-1">Category</p><p className="text-white">{selectedDoc.category}</p></div>
                <div className="bg-slate-800 p-3 rounded-lg"><p className="text-slate-500 mb-1">Version</p><p className="text-white">v{selectedDoc.version}</p></div>
                <div className="bg-slate-800 p-3 rounded-lg"><p className="text-slate-500 mb-1">Access</p><p className={ACCESS_LEVELS.find(al => al.value === selectedDoc.access_level)?.color}>{selectedDoc.access_level}</p></div>
                <div className="bg-slate-800 p-3 rounded-lg"><p className="text-slate-500 mb-1">Uploaded By</p><p className="text-white truncate">{selectedDoc.uploaded_by}</p></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handlePreview(selectedDoc)} className="btn-primary flex-1"><Eye className="w-4 h-4 mr-1" /> Preview</button>
                <button onClick={() => handleDownload(selectedDoc)} className="btn-secondary flex-1"><Download className="w-4 h-4 mr-1" /> Download</button>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" aria-hidden />
                    Document intelligence
                  </h4>
                  {docIntel?.source && (
                    <span className="badge bg-slate-700 text-[10px] uppercase tracking-wide text-slate-300">
                      {docIntel.source}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="w-full btn-secondary inline-flex items-center justify-center gap-2"
                  disabled={intelRefreshing || intelLoading}
                  onClick={() => void runDocAnalysisRefresh()}
                >
                  {intelRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden />
                  )}
                  Run AI analysis
                </button>
                {intelLoading && !docIntel && (
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                    Loading analysis…
                  </p>
                )}
                {docIntel && (
                  <div className="space-y-3 text-sm text-slate-300">
                    {docIntel.confidence && (
                      <p className="text-xs text-slate-500">
                        Confidence: <span className="text-slate-400">{docIntel.confidence}</span>
                        {typeof docIntel.extractedChars === 'number' && (
                          <span className="ml-2">· {docIntel.extractedChars} chars extracted</span>
                        )}
                      </p>
                    )}
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wide text-slate-500 mb-1">Summary</p>
                      <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{docIntel.summary}</p>
                    </div>
                    {Array.isArray(docIntel.commercialRisks) && docIntel.commercialRisks.length > 0 && (
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wide text-slate-500 mb-1">Commercial risks</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                          {docIntel.commercialRisks.map((line, i) => (
                            <li key={`cr-${i}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(docIntel.suggestedActions) && docIntel.suggestedActions.length > 0 && (
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wide text-slate-500 mb-1">Suggested actions</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                          {docIntel.suggestedActions.map((line, i) => (
                            <li key={`sa-${i}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(docIntel.rfiSuggestions) && docIntel.rfiSuggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wide text-slate-500 mb-1">RFI suggestions</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                          {docIntel.rfiSuggestions.map((line, i) => (
                            <li key={`rfi-${i}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(docIntel.keyEntities) && docIntel.keyEntities.length > 0 && (
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wide text-slate-500 mb-1">Key entities</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                          {docIntel.keyEntities.map((line, i) => (
                            <li key={`ke-${i}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4"><button onClick={() => setShowVersionHistory(true)} className="w-full btn-secondary"><History className="w-4 h-4 mr-1" /> Version History</button></div>
              <div className="border-t border-slate-800 pt-4"><button onClick={() => openSignModal()} className="w-full btn-secondary"><PenLine className="w-4 h-4 mr-1" /> Sign Document</button></div>
              <div className="border-t border-slate-800 pt-4"><button onClick={() => setEditingDoc(selectedDoc)} className="w-full btn-secondary"><Edit2 className="w-4 h-4 mr-1" /> Edit Details</button></div>
              <div className="border-t border-slate-800 pt-4"><button onClick={() => handleDelete(selectedDoc.id)} className="w-full btn-secondary text-red-400 hover:bg-red-500/20"><Trash2 className="w-4 h-4 mr-1" /> Delete</button></div>
            </div>
          </div>
        </div>
      )}

      {showVersionHistory && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-overlay absolute inset-0" onClick={() => setShowVersionHistory(false)} />
          <div className="dialog-content p-6 w-full max-w-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-display">Version History - {selectedDoc.name}</h3><button onClick={() => setShowVersionHistory(false)} className="p-2 hover:bg-slate-700 rounded"><X className="w-5 h-5" /></button></div>
            <div className="bg-slate-800 p-4 rounded-lg border-l-4 border-amber-500 mb-4">
              <div className="flex items-center justify-between"><span className="font-medium text-amber-400">Current: v{selectedDoc.version}</span><span className="text-sm text-slate-500">{formatDateTime(selectedDoc.created_at)}</span></div>
              <p className="text-sm text-slate-400 mt-1">Current version</p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="font-display mb-3">Upload New Version</h4>
              <div className="flex gap-3">
                <input type="text" placeholder="Describe changes..." id="versionChanges" className="input flex-1" />
                <input type="file" id="versionFileInput" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadVersion(selectedDoc.id, file, (document.getElementById('versionChanges') as HTMLInputElement).value || 'Updated'); }} />
                <button onClick={() => document.getElementById('versionFileInput')?.click()} className="btn-secondary"><Upload className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-overlay absolute inset-0" onClick={() => setShowUploadModal(false)} />
          <div className="dialog-content p-6 w-full max-w-lg relative z-10">
            <h3 className="text-lg font-display mb-4">Upload Document</h3>
            <div className={clsx('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4', dragOver ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 hover:border-slate-600')}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleUpload(file, selectedCategory, selectedAccess); }}
              onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files?.[0]) handleUpload(files[0], selectedCategory, selectedAccess); }; input.click(); }}>
              <UploadCloud className={clsx('w-10 h-10 mx-auto mb-3', dragOver ? 'text-amber-500' : 'text-slate-500')} />
              <p className="text-slate-300">Drag and drop or click to upload</p>
              <p className="text-sm text-slate-500 mt-1">PDF, DOC, XLS, PNG, JPG up to 100MB</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="text-sm text-slate-400 mb-1 block">Category</label><select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="input w-full">{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
              <div><label className="text-sm text-slate-400 mb-1 block">Access Level</label><select value={selectedAccess} onChange={e => setSelectedAccess(e.target.value)} className="input w-full">{ACCESS_LEVELS.map(al => <option key={al.value} value={al.value}>{al.label}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-3"><button onClick={() => setShowUploadModal(false)} className="btn-secondary">Cancel</button></div>
          </div>
        </div>
      )}

      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-overlay absolute inset-0" onClick={() => setEditingDoc(null)} />
          <div className="dialog-content p-6 w-full max-w-md relative z-10">
            <h3 className="text-lg font-display mb-4">Edit Document</h3>
            <div className="space-y-4">
              <div><label className="text-sm text-slate-400 mb-1 block">Name</label><input type="text" defaultValue={editingDoc.name} id="editName" className="input w-full" /></div>
              <div><label className="text-sm text-slate-400 mb-1 block">Category</label><select defaultValue={editingDoc.category} id="editCategory" className="input w-full">{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
              <div><label className="text-sm text-slate-400 mb-1 block">Access Level</label><select defaultValue={editingDoc.access_level} id="editAccess" className="input w-full">{ACCESS_LEVELS.map(al => <option key={al.value} value={al.value}>{al.label}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingDoc(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => { handleUpdate(editingDoc.id, { name: (document.getElementById('editName') as HTMLInputElement).value, category: (document.getElementById('editCategory') as HTMLSelectElement).value, access_level: (document.getElementById('editAccess') as HTMLSelectElement).value }); }} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <button onClick={() => setPreviewDoc(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700"><X className="w-6 h-6" /></button>
          <div className="max-w-5xl max-h-[90vh] flex items-center justify-center">
            {isImage(previewDoc.type) ? <img src={previewDoc.file_path} alt={previewDoc.name} className="max-w-full max-h-[85vh] object-contain rounded-lg" /> :
             isPdf(previewDoc.type) ? <iframe src={previewDoc.file_path} className="w-[80vw] h-[85vh] rounded-lg" /> :
             <div className="text-center p-8"><FileIconDefault className="w-24 h-24 mx-auto mb-4 text-slate-600" /><p className="text-slate-400 mb-4">Preview not available</p><button onClick={() => handleDownload(previewDoc)} className="btn-primary">Download to View</button></div>}
          </div>
        </div>
      )}

      {showSignModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowSignModal(false)} />
          <div className="relative z-10 bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-display text-white">Sign Document</h2>
                <p className="text-sm text-gray-400 mt-0.5">{selectedDoc.name}</p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <SignatureCapture
                onSign={handleDocSignature}
                onCancel={() => setShowSignModal(false)}
                signerName={user?.name || user?.email}
              />
              {existingSignatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-400">Existing signatures</p>
                  {existingSignatures.map(sig => <SignatureDisplay key={sig.id} signature={sig} compact />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTransmittalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-overlay absolute inset-0" onClick={() => setShowTransmittalModal(false)} />
          <div className="dialog-content p-6 w-full max-w-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-display">Create Transmittal</h3><button onClick={() => setShowTransmittalModal(false)} className="p-2 hover:bg-slate-700 rounded"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Recipients (comma-separated)</label>
                <input type="text" placeholder="client@example.com, architect@example.com" value={transmittalForm.recipients} onChange={e => setTransmittalForm({...transmittalForm, recipients: e.target.value})} className="input w-full" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Subject</label>
                <input type="text" placeholder="Structural drawings for review" value={transmittalForm.subject} onChange={e => setTransmittalForm({...transmittalForm, subject: e.target.value})} className="input w-full" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Purpose</label>
                <select value={transmittalForm.purpose} onChange={e => setTransmittalForm({...transmittalForm, purpose: e.target.value as any})} className="input w-full">
                  <option value="For Information">For Information</option>
                  <option value="For Approval">For Approval</option>
                  <option value="For Construction">For Construction</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Select Documents</label>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-800 rounded p-3">
                  {documents.slice(0, 8).map(doc => (
                    <label key={doc.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={transmittalForm.selectedDocs.includes(doc.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setTransmittalForm({...transmittalForm, selectedDocs: [...transmittalForm.selectedDocs, doc.id]});
                          } else {
                            setTransmittalForm({...transmittalForm, selectedDocs: transmittalForm.selectedDocs.filter(id => id !== doc.id)});
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{doc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowTransmittalModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleCreateTransmittal()} disabled={!transmittalForm.recipients || !transmittalForm.subject || transmittalForm.selectedDocs.length === 0} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Send Transmittal</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default React.memo(Documents);
