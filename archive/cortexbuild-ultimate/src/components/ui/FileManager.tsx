import React from "react";
import { useState, useRef, useCallback } from 'react';
import {
  Upload, X, File, Image, FileText, Trash2, Edit2, Grid, List, Search, FolderOpen, CheckSquare, Square
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  category: string;
  file_path?: string;
  uploaded_by: string;
  created_at: string;
  project?: string;
  status: string;
}

interface FileManagerProps {
  files: FileItem[];
  onUpload: (file: File, category: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onCategoryChange: (id: string, category: string) => Promise<void>;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

const CATEGORIES = ['PLANS', 'DRAWINGS', 'PERMITS', 'RAMS', 'CONTRACTS', 'REPORTS', 'SPECS', 'PHOTOS', 'OTHER'];

const FILE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  PDF: FileText,
  DOC: FileText,
  DOCX: FileText,
  XLS: FileText,
  XLSX: FileText,
  JPG: Image,
  JPEG: Image,
  PNG: Image,
  GIF: Image,
  WEBP: Image,
  DWG: File,
  DXF: File,
  ZIP: File,
  RAR: File,
  CSV: FileText,
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function FileManager({
  files,
  onUpload,
  onDelete,
  onRename,
  onCategoryChange,
  viewMode = 'grid',
  onViewModeChange,
}: FileManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('REPORTS');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<FileItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || file.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setUploading(true);
      try {
        await onUpload(droppedFile, selectedCategory);
        toast.success(`Uploaded ${droppedFile.name}`);
      } catch {
        toast.error('Upload failed');
      } finally {
        setUploading(false);
      }
    }
  }, [onUpload, selectedCategory]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setUploading(true);
      try {
        await onUpload(selectedFile, selectedCategory);
        toast.success(`Uploaded ${selectedFile.name}`);
      } catch {
        toast.error('Upload failed');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = async (file: FileItem) => {
    setSelectedForDelete(file);
  };

  const confirmDelete = async () => {
    if (selectedForDelete) {
      try {
        await onDelete(selectedForDelete.id);
        toast.success('File deleted');
        setSelectedForDelete(null);
      } catch {
        toast.error('Delete failed');
      }
    }
  };

  const startEditing = (file: FileItem) => {
    setEditingId(file.id);
    setEditingName(file.name);
  };

  const saveEditing = async () => {
    if (editingId && editingName.trim()) {
      try {
        await onRename(editingId, editingName.trim());
        toast.success('File renamed');
        setEditingId(null);
      } catch {
        toast.error('Rename failed');
      }
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const selectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const getFileIcon = (type: string) => {
    const IconComponent = FILE_ICONS[type.toUpperCase()] || File;
    return IconComponent;
  };

  const isImage = (type: string) => ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(type.toUpperCase());

  return (
    <div className="file-manager">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewModeChange?.('grid')}
            className={clsx('btn-secondary p-2', viewMode === 'grid' && 'bg-slate-600')}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange?.('list')}
            className={clsx('btn-secondary p-2', viewMode === 'list' && 'bg-slate-600')}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4',
          dragging ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 hover:border-slate-600'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload className={clsx('w-10 h-10 mx-auto mb-3', dragging ? 'text-amber-500' : 'text-slate-500')} />
        <p className="text-slate-300 mb-2">
          {uploading ? 'Uploading...' : 'Drag and drop files here, or click to browse'}
        </p>
        <p className="text-sm text-slate-500">
          PDF, DOC, XLS, PNG, JPG, DWG, ZIP up to 100MB
        </p>

        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-sm text-slate-400">Category:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="input py-1 px-2 text-sm"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-800 rounded-lg">
          <span className="text-sm text-slate-300">{selectedFiles.size} selected</span>
          <button onClick={selectAll} className="btn-secondary text-sm py-1">
            {selectedFiles.size === filteredFiles.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={() => selectedFiles.forEach(id => onDelete(id))}
            className="btn-secondary text-sm py-1 text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </button>
        </div>
      )}

      {/* File List/Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredFiles.map(file => {
            const FileIcon = getFileIcon(file.type);
            return (
              <div
                key={file.id}
                className={clsx(
                  'card p-4 cursor-pointer transition-all hover:border-amber-500/50',
                  selectedFiles.has(file.id) && 'border-amber-500 bg-amber-500/10'
                )}
                onClick={() => isImage(file.type) ? setPreviewFile(file) : null}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-lg flex items-center justify-center',
                      file.type === 'PDF' ? 'bg-red-500/20 text-red-400' :
                      file.type === 'XLS' || file.type === 'XLSX' ? 'bg-green-500/20 text-green-400' :
                      file.type === 'DOC' || file.type === 'DOCX' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700 text-slate-400'
                    )}
                  >
                    <FileIcon className="w-6 h-6" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                    className="p-1 hover:bg-slate-700 rounded"
                  >
                    {selectedFiles.has(file.id) ? (
                      <CheckSquare className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>

                <h4 className="font-medium text-slate-200 text-sm mb-1 truncate" title={file.name}>
                  {file.name}
                </h4>
                <p className="text-xs text-slate-500 mb-2">{file.type} • {file.size}</p>

                <div className="flex items-center justify-between">
                  <span className="badge bg-slate-700 text-slate-300 text-xs">{file.category}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditing(file); }}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                      className="p-1.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button onClick={selectAll} className="p-1">
                    {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </th>
                <th>Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map(file => (
                <tr
                  key={file.id}
                  className={selectedFiles.has(file.id) ? 'selected' : ''}
                  onClick={() => isImage(file.type) ? setPreviewFile(file) : null}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleSelect(file.id)}>
                      {selectedFiles.has(file.id) ? (
                        <CheckSquare className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {React.createElement(getFileIcon(file.type), { className: 'w-4 h-4 text-slate-400' })}
                      <span className="truncate max-w-xs">{file.name}</span>
                    </div>
                  </td>
                  <td>{file.type}</td>
                  <td>
                    <select
                      value={file.category}
                      onChange={e => { e.stopPropagation(); onCategoryChange(file.id, e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent border-none text-xs cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>
                  <td>{file.size}</td>
                  <td>{formatDate(file.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); startEditing(file); }} className="p-1.5 hover:bg-slate-700 rounded" title="Rename">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(file); }} className="p-1.5 hover:bg-red-500/20 rounded text-red-400" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredFiles.length === 0 && (
        <div className="empty-state">
          <FolderOpen className="w-16 h-16" />
          <h3>No files found</h3>
          <p>Upload your first file or try a different search</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-overlay absolute inset-0" onClick={() => setEditingId(null)} />
          <div className="dialog-content p-6 w-full max-w-md relative z-10">
            <h3 className="text-lg font-semibold mb-4">Rename File</h3>
            <input
              type="text"
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              className="input w-full mb-4"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveEditing()}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveEditing} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {selectedForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-overlay absolute inset-0" onClick={() => setSelectedForDelete(null)} />
          <div className="dialog-content p-6 w-full max-w-md relative z-10">
            <h3 className="text-lg font-semibold mb-2">Delete File?</h3>
            <p className="text-slate-400 mb-4">
              Are you sure you want to delete {selectedForDelete.name}? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSelectedForDelete(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmDelete} className="btn-primary bg-red-600 hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <button
            onClick={() => setPreviewFile(null)}
            className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[90vh] flex items-center justify-center">
            {previewFile.file_path ? (
              <img
                src={previewFile.file_path}
                alt={previewFile.name}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            ) : (
              <div className="text-center p-8">
                <Image className="w-24 h-24 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">Preview not available</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 px-4 py-2 rounded-lg">
            <p className="text-sm text-slate-300">{previewFile.name}</p>
            <p className="text-xs text-slate-500">{previewFile.size}</p>
          </div>
        </div>
      )}
    </div>
  );
}
