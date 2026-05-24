/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useMemo, useCallback } from 'react';
import {
  FileText, Plus, Search, Download,
  FileCheck, Eye, Edit, X, CreditCard, Receipt, Trash2,
  CheckSquare, Square, PenLine
} from 'lucide-react';
import { uploadFile, signaturesApi } from '../../services/api';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { toast } from 'sonner';
import { useValuations } from '../../hooks/useData';
import { useQueryClient } from '@tanstack/react-query';
import { SignatureCapture, SignatureDisplay } from '../ui/SignatureCapture';
import { useAuth } from '../../context/AuthContext';
import type { Signature } from '../../services/api';

interface Valuation {
  id: string;
  ref: string;
  project: string;
  contractor: string;
  applicationNo: number;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'submitted' | 'valued' | 'certified' | 'paid' | 'rejected';
  grossValue: number;
  retention: number;
  retentionPercent: number;
  previousValue: number;
  thisApplication: number;
  certifiedValue: number;
  certifiedDate?: string;
  paidDate?: string;
  lineItems: { description: string; originalValue: number; variation: number; remeasurement: number; workDone: number; percentage: number }[];
  documents: { name: string; type: string }[];
  notes: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  valued: { label: 'Valued', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  certified: { label: 'Certified', color: 'text-green-400', bg: 'bg-green-500/10' },
  paid: { label: 'Paid', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10' },
};


// ─── PDF Generation ─────────────────────────────────────────────────────────
async function generateValuationPDF(val: Valuation) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const GREEN = [34, 197, 94] as [number, number, number];
  const ORANGE = [249, 115, 22] as [number, number, number];
  const GRAY = [100, 100, 100] as [number, number, number];
  const LIGHTGRAY = [220, 220, 220] as [number, number, number];
  const BLACK = [30, 30, 30] as [number, number, number];

  // Header bar
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('INTERIM VALUATION', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CortexBuild Ultimate', 14, 21);

  // Ref + Status top right
  doc.setFontSize(9);
  doc.text('Ref: ' + (val.ref || val.id), 196, 10, { align: 'right' });
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.roundedRect(162, 13, 34, 7, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(val.status.toUpperCase(), 179, 18, { align: 'center' });

  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

  // Project info block
  let y = 38;
  doc.setFillColor(248, 248, 248);
  doc.rect(14, y, 182, 30, 'F');
  doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
  doc.line(14, y + 10, 196, y + 10);
  doc.line(105, y, 105, y + 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('PROJECT', 16, y + 6);
  doc.text('CONTRACTOR', 107, y + 6);

  doc.setFontSize(10);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(val.project || '—', 16, y + 15);
  doc.text(val.contractor || '—', 107, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('PERIOD', 16, y + 25);
  doc.text('APPLICATION NO.', 107, y + 25);

  doc.setFontSize(10);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text((val.periodStart || '') + ' – ' + (val.periodEnd || ''), 16, y + 30);
  doc.text('#' + String(val.applicationNo || 1), 107, y + 30);

  // Values summary - 2 columns of 3 metrics
  y = 78;
  const fmt = (n: number) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pairs = [
    ['Gross Value', fmt(val.grossValue || 0), 'Retention', fmt(val.retention || 0) + ' (' + (val.retentionPercent || 0) + '%)'],
    ['Previous Certified', fmt(val.previousValue || 0), 'This Application', fmt(val.thisApplication || 0)],
    ['Certified Value', fmt(val.certifiedValue || 0), 'Amount Due', fmt((val.certifiedValue || 0) - (val.retention || 0))],
  ];
  pairs.forEach(([k1, v1, k2, v2], row) => {
    const ly = y + row * 16;
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(k1, 14, ly);
    doc.text(k2, 108, ly);
    doc.setFontSize(13);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(v1, 14, ly + 7);
    doc.text(v2, 108, ly + 7);
    doc.setFont('helvetica', 'normal');
  });

  // Divider
  y = 126;
  doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
  doc.line(14, y, 196, y);

  // Line items table header
  y += 6;
  doc.setFillColor(40, 40, 40);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Description', 16, y + 5.5);
  doc.text('Original', 105, y + 5.5);
  doc.text('Variation', 127, y + 5.5);
  doc.text('Work Done', 150, y + 5.5);
  doc.text('Total', 174, y + 5.5);
  doc.text('%', 194, y + 5.5);

  // Line items rows
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setFont('helvetica', 'normal');
  const items = val.lineItems || [];
  items.slice(0, 15).forEach((item, i) => {
    y += 9;
    if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(14, y - 5, 182, 9, 'F'); }
    doc.setFontSize(8.5);
    const total = (item.originalValue || 0) + (item.variation || 0);
    doc.text(item.description || '—', 16, y + 1);
    doc.text(fmt(item.originalValue || 0), 105, y + 1);
    doc.text(fmt(item.variation || 0), 127, y + 1);
    doc.text(fmt(item.workDone || 0), 150, y + 1);
    doc.text(fmt(total), 174, y + 1);
    doc.text(String(item.percentage || 0) + '%', 194, y + 1);
  });

  // Notes section
  if (val.notes) {
    y += 10;
    doc.setDrawColor(LIGHTGRAY[0], LIGHTGRAY[1], LIGHTGRAY[2]);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('NOTES', 16, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(val.notes, 168);
    doc.text(noteLines.slice(0, 5), 16, y);
  }

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('Generated by CortexBuild Ultimate — AI Construction Management', 105, 290, { align: 'center' });

  doc.save('Valuation-' + (val.ref || val.id) + '.pdf');
}

export default function Valuations() {
  const _fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: rawValuations = [], isLoading: _isLoading } = useValuations.useList();
  const valuations = rawValuations as unknown as Valuation[];
  const createMutation = useValuations.useCreate();
  const updateMutation = useValuations.useUpdate();
  const deleteMutation = useValuations.useDelete();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedValId, setSelectedValId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState({ project: '', contractor: '', grossValue: '', retention: '', periodStart: '', periodEnd: '' });
  const [showSignModal, setShowSignModal] = useState(false);
  const [signingVal, setSigningVal] = useState<Valuation | null>(null);
  const [existingSignatures, setExistingSignatures] = useState<Signature[]>([]);

  const { user } = useAuth();

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      clearSelection();
      toast.success(`Deleted ${ids.length} item(s)`);
    } catch {
      toast.error('Bulk delete failed');
    }
  }, [deleteMutation, clearSelection]);

  const handleCreate = useCallback(async () => {
    if (!form.project) return;
    try {
      const ref = `VAL-${String(Date.now()).slice(-6)}`;
      await createMutation.mutateAsync({
        reference: ref,
        project: form.project,
        contractor_name: form.contractor || 'CortexBuild Ltd',
        application_number: 1,
        period_start: form.periodStart || new Date().toISOString().split('T')[0],
        period_end: form.periodEnd || new Date().toISOString().split('T')[0],
        status: 'draft',
        original_value: parseFloat(form.grossValue) || 0,
        variations: 0,
        total_value: parseFloat(form.grossValue) || 0,
        retention: parseFloat(form.retention) || 0,
        amount_due: parseFloat(form.grossValue) || 0,
      });
      setShowCreateModal(false);
      setForm({ project: '', contractor: '', grossValue: '', retention: '', periodStart: '', periodEnd: '' });
    } catch {
      toast.error('Failed to create valuation');
    }
  }, [form, createMutation]);

  const handleUpdate = useCallback(async () => {
    if (!editItem?.id) return;
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          project: editItem.project,
          contractor_name: editItem.contractorName || 'CortexBuild Ltd',
          period_start: editItem.periodStart || new Date().toISOString().split('T')[0],
          period_end: editItem.periodEnd || new Date().toISOString().split('T')[0],
          original_value: parseFloat(editItem.originalValue) || 0,
          variations: parseFloat(editItem.variations) || 0,
          total_value: parseFloat(editItem.totalValue) || 0,
          retention: parseFloat(editItem.retention) || 0,
          amount_due: parseFloat(editItem.amountDue) || 0,
          status: editItem.status,
        },
      });
      setEditItem(null);
    } catch {
      toast.error('Failed to update valuation');
    }
  }, [editItem, updateMutation]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this valuation?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      toast.error('Failed to delete valuation');
    }
  }, [deleteMutation]);

  const openSignModal = useCallback(async (val: Valuation) => {
    setSigningVal(val);
    setShowSignModal(true);
    try {
      const res = await signaturesApi.getByDocument('valuation', String(val.id));
      setExistingSignatures(Array.isArray(res.data) ? res.data : []);
    } catch {
      setExistingSignatures([]);
    }
  }, []);

  const handleSignature = useCallback(async (signatureData: string) => {
    if (!signingVal || !user) return;
    try {
      await signaturesApi.create({
        document_type: 'valuation',
        document_id: String(signingVal.id),
        signer_name: user.name || user.email || 'Unknown',
        signer_role: user.role || 'Contractor',
        signer_email: user.email,
        signature_data: signatureData,
      });
      toast.success('Valuation signed successfully');
      setShowSignModal(false);
      setSigningVal(null);
    } catch {
      toast.error('Failed to save signature');
    }
  }, [signingVal, user]);

  const handleUploadDoc = useCallback(async (valId: string, file: File) => {
    setUploading(true);
    setSelectedValId(valId);
    try {
      await uploadFile(file, 'REPORTS');
      queryClient.invalidateQueries({ queryKey: ['valuations'] });
      toast.success(`Uploaded: ${file.name}`);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setSelectedValId(null);
    }
  }, [queryClient]);

  const filteredValuations = useMemo(() => valuations.filter((v: Valuation) => {
    const matchesSearch = (v.ref || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.project || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.contractor || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  }), [valuations, searchTerm, filterStatus]);

  const totalSubmitted = useMemo(() => valuations.filter((v: Valuation) => v.status === 'submitted' || v.status === 'valued').reduce((sum: number, v: Valuation) => sum + v.thisApplication, 0), [valuations]);
  const totalCertified = useMemo(() => valuations.filter((v: Valuation) => v.status === 'certified' || v.status === 'paid').reduce((sum: number, v: Valuation) => sum + v.certifiedValue, 0), [valuations]);
  const totalPaid = useMemo(() => valuations.filter((v: Valuation) => v.status === 'paid').reduce((sum: number, v: Valuation) => sum + v.certifiedValue, 0), [valuations]);

  return (
    <>
      <ModuleBreadcrumbs currentModule="valuations" />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Valuations & Certificates
          </h2>
          <p className="text-gray-400 text-sm mt-1">Manage payment applications, interim certificates and valuations</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
        >
          <Plus size={18} />
          New Valuation
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Submitted</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">£{totalSubmitted.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="text-blue-400" size={20} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Certified</p>
              <p className="text-2xl font-bold text-green-400 mt-1">£{totalCertified.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <FileCheck className="text-green-400" size={20} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Paid</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">£{totalPaid.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="text-emerald-400" size={20} />
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider">Total Applications</p>
              <p className="text-2xl font-bold text-white mt-1">{valuations.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Receipt className="text-orange-400" size={20} />
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
                placeholder="Search valuations..."
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
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="valued">Valued</option>
            <option value="certified">Certified</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="cb-table-scroll touch-pan-x">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                <th className="pb-3 w-10"></th>
                <th className="pb-3">Ref</th>
                <th className="pb-3">Project</th>
                <th className="pb-3">Contractor</th>
                <th className="pb-3">Period</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">This App.</th>
                <th className="pb-3 text-right">Certified</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {filteredValuations.map((val: Valuation) => {
                const status = statusConfig[val.status];
                const isSelected = selectedIds.has(String(val.id));
                return (
                  <tr key={val.id} className={`border-b border-gray-700/50 hover:bg-gray-800/50 ${isSelected ? 'bg-blue-900/20' : ''}`}>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => toggle(String(val.id))}
                        className="text-gray-400 hover:text-white"
                      >
                        {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                      </button>
                    </td>
                    <td className="py-3 font-mono text-orange-400">{val.ref}</td>
                    <td className="py-3">{val.project}</td>
                    <td className="py-3 text-gray-300">{val.contractor}</td>
                    <td className="py-3 text-gray-400 text-sm">{val.periodStart} - {val.periodEnd}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${status.bg} ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="py-3 text-right font-medium">£{val.thisApplication.toLocaleString()}</td>
                    <td className="py-3 text-right">
                      {val.certifiedValue > 0 ? (
                        <span className="text-green-400">£{val.certifiedValue.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                          <Eye size={16} />
                        </button>
                        <button type="button" onClick={() => generateValuationPDF(val)} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Download PDF">
                          <Download size={16} />
                        </button>
                        <input
                          type="file"
                          id={`upload-val-${val.id}`}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await handleUploadDoc(String(val.id), file);
                              e.target.value = '';
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`upload-val-${val.id}`)?.click()}
                          disabled={uploading && selectedValId === String(val.id)}
                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50"
                          title="Upload document"
                        >
                          <FileCheck size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditItem({ ...val, contractorName: val.contractor || '', periodStart: val.periodStart || '', periodEnd: val.periodEnd || '', originalValue: String(val.grossValue || ''), variations: String(0), totalValue: String(val.grossValue || ''), retention: String(val.retention || ''), amountDue: String(val.thisApplication || ''), status: val.status })}
                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openSignModal(val)}
                          className="p-1.5 hover:bg-blue-700/30 rounded text-gray-400 hover:text-blue-400"
                          title="Sign valuation"
                        >
                          <PenLine size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(String(val.id))}
                          className="p-1.5 hover:bg-red-900/30 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={[
            { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger' as const, onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
          ]}
          onClearSelection={clearSelection}
        />
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Create Valuation</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
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
                <label className="block text-gray-400 text-xs mb-1">Contractor</label>
                <input type="text" value={form.contractor} onChange={e => setForm(f => ({ ...f, contractor: e.target.value }))} placeholder="Contractor name..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Gross Value (£)</label>
                  <input type="number" value={form.grossValue} onChange={e => setForm(f => ({ ...f, grossValue: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Retention (£)</label>
                  <input type="number" value={form.retention} onChange={e => setForm(f => ({ ...f, retention: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Period Start</label>
                  <input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Period End</label>
                  <input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={createMutation.isPending || !form.project} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Create Valuation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Valuation</h3>
              <button type="button" onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Project</label>
                <select value={editItem.project} onChange={e => setEditItem(f => ({ ...f, project: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                  <option value="">Select project...</option>
                  <option>Canary Wharf Office Complex</option>
                  <option>Manchester City Apartments</option>
                  <option>Birmingham Road Bridge</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Contractor</label>
                <input type="text" value={editItem.contractorName || ''} onChange={e => setEditItem(f => ({ ...f, contractorName: e.target.value }))} placeholder="Contractor name..." className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Original Value (£)</label>
                  <input type="number" value={editItem.originalValue || ''} onChange={e => setEditItem(f => ({ ...f, originalValue: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Variations (£)</label>
                  <input type="number" value={editItem.variations || ''} onChange={e => setEditItem(f => ({ ...f, variations: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Total Value (£)</label>
                  <input type="number" value={editItem.totalValue || ''} onChange={e => setEditItem(f => ({ ...f, totalValue: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Retention (£)</label>
                  <input type="number" value={editItem.retention || ''} onChange={e => setEditItem(f => ({ ...f, retention: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Amount Due (£)</label>
                <input type="number" value={editItem.amountDue || ''} onChange={e => setEditItem(f => ({ ...f, amountDue: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Period Start</label>
                  <input type="date" value={editItem.periodStart || ''} onChange={e => setEditItem(f => ({ ...f, periodStart: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Period End</label>
                  <input type="date" value={editItem.periodEnd || ''} onChange={e => setEditItem(f => ({ ...f, periodEnd: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Status</label>
                <select value={editItem.status || 'draft'} onChange={e => setEditItem(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="valued">Valued</option>
                  <option value="certified">Certified</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button type="button" onClick={handleUpdate} disabled={updateMutation.isPending} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignModal && signingVal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-white">Sign Valuation</h2>
                <p className="text-sm text-gray-400 mt-0.5">{signingVal.ref} — {signingVal.project}</p>
              </div>
              <button type="button" onClick={() => { setShowSignModal(false); setSigningVal(null); }} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <SignatureCapture
                onSign={handleSignature}
                onCancel={() => { setShowSignModal(false); setSigningVal(null); }}
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
    </div>
    </>
  );
}
