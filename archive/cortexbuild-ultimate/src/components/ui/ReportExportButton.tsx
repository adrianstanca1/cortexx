import { useState } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';
import { getToken } from '../../lib/auth-storage';

interface ReportExportButtonProps {
  reportType: 'invoice' | 'rfi' | 'daily-report' | 'safety-incident' | 'project';
  reportId: string;
  fileName?: string;
  onExportStart?: () => void;
  onExportEnd?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const endpointMap = {
  invoice: '/api/reports/invoice',
  'rfi': '/api/reports/rfi',
  'daily-report': '/api/reports/daily-report',
  'safety-incident': '/api/reports/safety-incident',
  'project': '/api/reports/project',
};

const reportLabels = {
  invoice: 'Invoice PDF',
  'rfi': 'RFI Report',
  'daily-report': 'Daily Report',
  'safety-incident': 'Incident Report',
  'project': 'Project Summary',
};

export function ReportExportButton({
  reportType,
  reportId,
  fileName,
  onExportStart,
  onExportEnd,
  variant = 'secondary',
  size = 'md',
  className = '',
}: ReportExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);
    onExportStart?.();

    try {
      const token = getToken();
      const endpoint = endpointMap[reportType];
      const url = `${endpoint}/${reportId}/pdf`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.download = fileName || `${reportType}-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('[ReportExport] failed:', err);
    } finally {
      setLoading(false);
      onExportEnd?.();
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    secondary: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30',
    ghost: 'bg-transparent hover:bg-gray-800 text-gray-300 border border-gray-700',
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={`
        inline-flex items-center rounded-lg font-mono font-semibold
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      style={{
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
      }}
    >
      {loading ? (
        <>
          <Loader2 size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} className="animate-spin" />
          <span>Generating...</span>
        </>
      ) : (
        <>
          <FileText size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />
          <span>{reportLabels[reportType]}</span>
        </>
      )}
    </button>
  );
}

interface ExportDropdownProps {
  reportId: string;
  projectName?: string;
  className?: string;
}

export function ReportExportDropdown({ reportId, projectName, className }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const handleExport = async (type: ReportExportButtonProps['reportType']) => {
    setLoadingType(type);
    try {
      const token = getToken();
      const endpoint = endpointMap[type];
      const url = `${endpoint}/${reportId}/pdf`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.download = `${type}-${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('[ReportExportDropdown]', err);
    } finally {
      setLoadingType(null);
      setOpen(false);
    }
  };

  const types: { type: ReportExportButtonProps['reportType']; label: string }[] = [
    { type: 'project', label: 'Project Summary' },
    { type: 'invoice', label: 'Invoice PDF' },
    { type: 'rfi', label: 'RFI Report' },
    { type: 'daily-report', label: 'Daily Report' },
    { type: 'safety-incident', label: 'Incident Report' },
  ];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-mono font-semibold transition-all duration-200 disabled:opacity-50"
        style={{ fontFamily: "'Fira Code', 'Cascadia Code', monospace" }}
      >
        <Download size={14} />
        <span>Export</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ fontFamily: "'Fira Code', monospace" }}
        >
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Export Report</p>
            {projectName && <p className="text-sm text-white mt-0.5 truncate">{projectName}</p>}
          </div>
          {types.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleExport(type)}
              disabled={loadingType === type}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loadingType === type ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} className="text-gray-400" />
              )}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

export default ReportExportButton;
