// Gallery Tab - Project images, upload, filter by category

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, RefreshCw, Eye, Download, Trash2, Image } from 'lucide-react';
import { useProjectImages } from '../../../hooks/useData';
import { projectImagesApi } from '../../../services/api';
import { IMAGE_CATEGORIES, formatDate } from './types';
import type { AnyRow } from './types';
import { toast } from 'sonner';

interface GalleryTabProps {
  projectId: string;
  projectName: string;
}

export function GalleryTab({ projectId, projectName }: GalleryTabProps) {
  const { data: images = [], isLoading, refetch } = useProjectImages.useList();
  const filteredImages = (images as AnyRow[]).filter((img: AnyRow) => String(img.project_id) === projectId);
  const [selectedImage, setSelectedImage] = useState<AnyRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [imgCategory, setImgCategory] = useState('general');
  const [filterCat, setFilterCat] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const displayed = filterCat === 'all' ? filteredImages : filteredImages.filter((img: AnyRow) => img.category === filterCat);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      toast.error('Only image files (PNG, JPG, GIF, WebP) are allowed');
      return;
    }
    setUploading(true);
    try {
      await projectImagesApi.uploadImage(file, projectId, caption, imgCategory);
      toast.success('Image uploaded successfully');
      setCaption('');
      setImgCategory('general');
      setShowUpload(false);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [projectId, caption, imgCategory, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this image?')) return;
    try {
      await projectImagesApi.delete(id);
      toast.success('Image deleted');
      setSelectedImage(null);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || 'Delete failed');
    }
  }, [refetch]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="bg-gray-800 border border-gray-700 btn btn-sm text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {IMAGE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <span className="text-xs text-gray-400">{displayed.length} image{displayed.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-3 py-1.5 btn btn-primary text-sm rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Add Photos
          </button>
        </div>
      </div>

      {/* Upload dropzone */}
      {showUpload && (
        <div className="bg-gray-900 border-2 border-dashed border-blue-600/50 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Upload Photos to {projectName}</h3>
            <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select value={imgCategory} onChange={e => setImgCategory(e.target.value)}
                className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500">
                {IMAGE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Caption (optional)</label>
              <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Steel frame completion"
                className="w-full input input-bordered w-full focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <Image className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Click to select image</p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF, WebP — max 50MB</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
            </div>
          )}
        </div>
      )}

      {/* Gallery grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
      ) : displayed.length === 0 ? (
        <div className="card bg-base-100 border border-base-300 py-16 text-center">
          <Image className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No photos yet</p>
          <p className="text-gray-500 text-sm mt-1">Upload site photos to track progress visually</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayed.map((img: AnyRow) => (
            <div key={String(img.id)} className="group relative card bg-base-100 border border-base-300 overflow-hidden cursor-pointer hover:border-blue-600/50 transition-all"
              onClick={() => setSelectedImage(img)}>
              <div className="aspect-[4/3] bg-gray-800">
                <img
                  src={`https://www.cortexbuildpro.com${String(img.file_path ?? '')}`}
                  alt={String(img.caption ?? '')}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div className="p-2">
                <p className="text-xs text-white truncate">{String(img.caption || 'No caption')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{String(img.category ?? 'general').replace(/_/g, ' ')} · {formatDate(String(img.created_at ?? ''))}</p>
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"><Eye className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://www.cortexbuildpro.com${img.file_path}`, '_blank'); }}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"><Download className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-1 text-sm">
              <X className="w-4 h-4" /> Close
            </button>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="max-h-[70vh] overflow-hidden">
                <img
                  src={`https://www.cortexbuildpro.com${String(selectedImage.file_path ?? '')}`}
                  alt={String(selectedImage.caption ?? '')}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{String(selectedImage.caption || 'No caption')}</p>
                    <p className="text-gray-400 text-sm mt-0.5">
                      {String(selectedImage.category ?? 'general').replace(/_/g, ' ')} · Uploaded by {String(selectedImage.uploaded_by ?? 'Unknown')} · {formatDate(String(selectedImage.created_at ?? ''))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => window.open(`https://www.cortexbuildpro.com${selectedImage.file_path}`, '_blank')}
                      className="flex items-center gap-1.5 px-3 py-1.5 btn btn-primary text-sm rounded-lg transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                    <button onClick={() => handleDelete(String(selectedImage.id))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
