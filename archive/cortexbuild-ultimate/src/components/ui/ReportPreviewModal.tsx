import { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2, Eye } from 'lucide-react';
import { getToken } from '../../lib/auth-storage';

interface ReportPreviewModalProps {
  reportType: 'invoice' | 'rfi' | 'daily-report' | 'safety-incident' | 'project';
  reportId: string;
  reportLabel: string;
  onClose: () => void;
}

const endpointMap = {
  invoice: '/api/reports/invoice',
  'rfi': '/api/reports/rfi',
  'daily-report': '/api/reports/daily-report',
  'safety-incident': '/api/reports/safety-incident',
  'project': '/api/reports/project',
};

interface PreviewData {
  loading: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export function ReportPreviewModal({ reportType, reportId, reportLabel, onClose }: ReportPreviewModalProps) {
  const [preview, setPreview] = useState<PreviewData>({ loading: true });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const token = getToken();
        const endpoint = endpointMap[reportType];
        const response = await fetch(`${endpoint}/${reportId}/pdf`, {
          credentials: 'include',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        setPreview({ loading: false, data: { pdfUrl: url } });
      } catch (err) {
        setPreview({ loading: false, error: String(err) });
      }
    }
    fetchPreview();
  }, [reportType, reportId]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = getToken();
      const endpoint = endpointMap[reportType];
      const response = await fetch(`${endpoint}/${reportId}/pdf`, {
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.download = `${reportType}-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('[ReportPreviewModal] download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ fontFamily: "'Fira Code', 'Cascadia Code', monospace" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-amber-400" />
              <h2 className="text-lg font-bold text-white">Preview: {reportLabel}</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Review before downloading</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {preview.loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 size={32} className="animate-spin mb-3" />
              <span className="text-sm">Loading preview...</span>
            </div>
          )}

          {preview.error && (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
              <FileText size={32} className="mb-3 opacity-50" />
              <span className="text-sm">Failed to load preview</span>
              <span className="text-xs text-gray-500 mt-1">{preview.error}</span>
            </div>
          )}

          {typeof preview.data?.pdfUrl === 'string' && (
            <iframe
              src={preview.data.pdfUrl}
              className="w-full h-[60vh] border border-gray-700 rounded-xl bg-white"
              title="PDF Preview"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || preview.loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportPreviewModal;
