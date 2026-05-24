// Documents Tab - Document management, upload, edit, filter

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Search, Edit2, Trash2, Eye, Download } from 'lucide-react';
import { useDocuments } from '../../../hooks/useData';
import { DOC_CATEGORIES, formatDate } from './types';
import { getDocIcon } from './shared';
import type { AnyRow } from './types';
import { toast } from 'sonner';
import { EmptyState } from '../../ui/EmptyState';
import { API_BASE } from '../../../lib/auth-storage';

interface DocumentsTabProps {
  projectId: string;
  projectName: string;
}

export function DocumentsTab({ projectId, projectName }: DocumentsTabProps) {
  const { data: allDocs = [], isLoading, refetch } = useDocuments.useList();
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'REPORTS', discipline: '', date_issued: '', author: '' });
  const [_selectedDoc, _setSelectedDoc] = useState<AnyRow | null>(null);
  const [editDoc, setEditDoc] = useState<AnyRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', discipline: '', author: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const docs = (allDocs as AnyRow[]).filter((d: AnyRow) => {
    const matchProject = !projectId || String(d.project_id ?? '') === projectId || String(d.project ?? '').toLowerCase().includes(projectName.toLowerCase().split(' ')[0]);
    const matchCat = filterCat === 'all' || String(d.category ?? '') === filterCat;
    const matchSearch = !search || String(d.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchProject && matchCat && matchSearch;
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', uploadForm.name || file.name);
      formData.append('category', uploadForm.category);
      formData.append('project_id', projectId);
      formData.append('discipline', uploadForm.discipline);
      formData.append('date_issued', uploadForm.date_issued);
      formData.append('author', uploadForm.author);
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message);
      }
      toast.success('Document uploaded');
      setUploadForm({ name: '', category: 'REPORTS', discipline: '', date_issued: '', author: '' });
      setShowUpload(false);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [uploadForm, projectId, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const res = await fetch(`${API_BASE}/files/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Delete failed' }));
        throw new Error(err.message);
      }
      toast.success('Document deleted');
      _setSelectedDoc(null);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Delete failed');
    }
  }, [refetch]);

  const handleEdit = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/files/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Document updated');
      setEditDoc(null);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Update failed');
    }
  }, [editForm, refetch]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-gray-800 border border-gray-700 btn btn-sm text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="all">All Categories</option>
            {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..."
              className="pl-8 pr-3 py-1.5 input input-bordered text-sm text-white focus:outline-none focus:border-blue-500 w-48" />
          </div>
          <span className="text-xs text-gray-400">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-3 py-1.5 btn btn-primary text-sm rounded-lg transition-colors">
          <Upload className="w-3.5 h-3.5" /> Upload Document
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white">Upload Document</h3>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category</label>
                <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500">
                  {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Document Name</label>
                <input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} placeholder="Leave blank to use filename"
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Discipline</label>
                  <input value={uploadForm.discipline} onChange={e => setUploadForm(f => ({ ...f, discipline: e.target.value }))} placeholder="e.g. Structural"
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date Issued</label>
                  <input type="date" value={uploadForm.date_issued} onChange={e => setUploadForm(f => ({ ...f, date_issued: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Author</label>
                <input value={uploadForm.author} onChange={e => setUploadForm(f => ({ ...f, author: e.target.value }))} placeholder="Author name"
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to select file</p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, XLS, DWG, PNG, JPG — max 100MB</p>
                <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documents table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
      ) : docs.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 py-16 text-center">
          <EmptyState title="No documents found" description="Upload documents to keep project records organized" variant="documents" />
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-300 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 border-b border-gray-700">
              <tr>
                {['Name', 'Type', 'Category', 'Version', 'Size', 'Author', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {docs.map((doc: AnyRow) => (
                <tr key={String(doc.id)} className="hover:bg-gray-800/40 group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getDocIcon(String(doc.type ?? ''))}
                      <span className="text-white font-medium text-xs max-w-[200px] truncate">{String(doc.name ?? '—')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{String(doc.type ?? '—')}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{String(doc.category ?? '—')}</span></td>
                  <td className="px-4 py-3 text-orange-400 text-xs font-mono">v{String(doc.version ?? '1.0')}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{String(doc.size ?? '—')}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{String(doc.author ?? doc.uploadedBy ?? '—')}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(String(doc.dateIssued ?? doc.createdAt ?? ''))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP'].includes(String(doc.type ?? '').toUpperCase()) ? (
                        <button onClick={() => window.open(`/api/files/${doc.id}/preview`, '_blank')}
                          className="p-1 text-gray-400 hover:text-white rounded"><Eye className="w-3.5 h-3.5" /></button>
                      ) : (
                        <button onClick={() => window.open(`/api/files/${doc.id}/download`, '_blank')}
                          className="p-1 text-gray-400 hover:text-white rounded"><Download className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => { setEditDoc(doc); setEditForm({ name: String(doc.name ?? ''), category: String(doc.category ?? ''), discipline: String(doc.discipline ?? ''), author: String(doc.author ?? '') }); }}
                        className="p-1 text-gray-400 hover:text-white rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(String(doc.id))}
                        className="p-1 text-gray-400 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white">Edit Document</h3>
              <button onClick={() => setEditDoc(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500">
                    {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Author</label>
                  <input value={editForm.author} onChange={e => setEditForm(f => ({ ...f, author: e.target.value }))}
                    className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Discipline</label>
                <input value={editForm.discipline} onChange={e => setEditForm(f => ({ ...f, discipline: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleEdit(String(editDoc.id))}
                  className="flex-1 btn btn-primary rounded-lg py-2 text-sm font-semibold transition-colors">
                  Save Changes
                </button>
                <button onClick={() => setEditDoc(null)}
                  className="flex-1 btn btn-ghost rounded-lg py-2 text-sm font-semibold transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
