import React, { useState } from 'react';
import {
  FileText,
  File,
  FileImage,
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  RefreshCw,
  Search,
  FolderOpen,
  Lock,
} from 'lucide-react';

/**
 * DocumentUpdatesWidget
 *
 * Displays recent document uploads, version changes,
 * pending approvals, and quick download actions.
 *
 * @param props - Component props
 * @returns JSX element displaying document updates
 *
 * @example
 * ```tsx
 * <DocumentUpdatesWidget
 *   projectId="proj-123"
 *   onDocumentClick={(doc) => handleNavigate(doc)}
 *   onDownload={(doc) => handleDownload(doc)}
 * />
 * ```
 */

export type DocumentType = 'pdf' | 'doc' | 'xls' | 'img' | 'dwg' | 'other';
export type DocumentStatus = 'current' | 'superseded' | 'draft' | 'pending_approval' | 'archived';
export type DocumentCategory = 'PLANS' | 'DRAWINGS' | 'PERMITS' | 'RAMS' | 'CONTRACTS' | 'REPORTS' | 'SPECS' | 'PHOTOS';
export type DocumentUpdatesSize = 'small' | 'medium' | 'large';

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  category: DocumentCategory;
  version: string;
  size: string;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedDate: string;
  projectId?: string;
  downloadCount?: number;
  requiresApproval?: boolean;
  isLocked?: boolean;
}

export interface DocumentUpdatesData {
  totalDocuments: number;
  recentUploads: number;
  pendingApprovals: number;
  superseded: number;
  documents: Document[];
}

export interface DocumentUpdatesWidgetProps {
  /** Optional project ID to filter documents */
  projectId?: string;
  /** Click handler for documents */
  onDocumentClick?: (document: Document) => void;
  /** Download handler */
  onDownload?: (document: Document) => void;
  /** Size variant */
  size?: DocumentUpdatesSize;
  /** Show search */
  showSearch?: boolean;
  /** Show filter controls */
  showFilter?: boolean;
  /** Show pending approvals section */
  showPendingApprovals?: boolean;
  /** Show recent uploads section */
  showRecentUploads?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const documentTypeConfig: Record<DocumentType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = {
  pdf: {
    label: 'PDF',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  doc: {
    label: 'DOC',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  xls: {
    label: 'XLS',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  img: {
    label: 'Image',
    icon: <FileImage className="w-4 h-4" />,
    color: 'text-purple-600',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  dwg: {
    label: 'DWG',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
  },
  other: {
    label: 'Other',
    icon: <File className="w-4 h-4" />,
    color: 'text-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-700',
  },
};

const statusConfig: Record<DocumentStatus, {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}> = {
  current: {
    label: 'Current',
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  superseded: {
    label: 'Superseded',
    color: 'text-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: <Clock className="w-3 h-3" />,
  },
  draft: {
    label: 'Draft',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: <FileText className="w-3 h-3" />,
  },
  pending_approval: {
    label: 'Pending',
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: <FolderOpen className="w-3 h-3" />,
  },
};

const categoryColors: Record<DocumentCategory, string> = {
  PLANS: 'text-blue-600',
  DRAWINGS: 'text-purple-600',
  PERMITS: 'text-green-600',
  RAMS: 'text-orange-600',
  CONTRACTS: 'text-red-600',
  REPORTS: 'text-blue-600',
  SPECS: 'text-teal-600',
  PHOTOS: 'text-pink-600',
};

const sizeClasses: Record<DocumentUpdatesSize, {
  padding: string;
  textSize: string;
  labelSize: string;
  valueSize: string;
  itemPadding: string;
  iconSize: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    itemPadding: 'p-2',
    iconSize: 'w-4 h-4',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    itemPadding: 'p-2.5',
    iconSize: 'w-5 h-5',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    valueSize: 'text-3xl',
    itemPadding: 'p-3',
    iconSize: 'w-6 h-6',
  },
};

/**
 * DocumentIcon Component
 */
function DocumentIcon({ type, size }: { type: DocumentType; size: DocumentUpdatesSize }) {
  const config = documentTypeConfig[type];
  const sizes = sizeClasses[size];

  return (
    <div className={`p-2 rounded-lg ${config.bg}`}>
      <div className={`${sizes.iconSize} ${config.color}`}>{config.icon}</div>
    </div>
  );
}

/**
 * DocumentItem Component
 */
function DocumentItem({
  document,
  size,
  onClick,
  onDownload,
}: {
  document: Document;
  size: DocumentUpdatesSize;
  onClick?: () => void;
  onDownload?: (document: Document) => void;
}) {
  const sizes = sizeClasses[size];
  const _typeConfig = documentTypeConfig[document.type];
  const _status = statusConfig[document.status];

  const getTimeAgo = (timestamp: string): string => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-3">
        {/* Document Icon */}
        <DocumentIcon type={document.type} size={size} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`${sizes.textSize} font-medium text-gray-900 dark:text-white truncate`}>
              {document.name}
            </p>
            {document.isLocked && (
              <Lock className="w-3 h-3 text-gray-400" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`${sizes.labelSize} ${categoryColors[document.category]}`}>
              {document.category}
            </span>
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              v{document.version}
            </span>
            <span className={`${sizes.labelSize} text-gray-400`}>•</span>
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              {document.size}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={document.status} size={size} />
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              {getTimeAgo(document.uploadedDate)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!document.isLocked && (
            <button
              onClick={() => onDownload?.(document)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * StatusBadge Component
 */
function StatusBadge({ status, size: _size }: { status: DocumentStatus; size: DocumentUpdatesSize }) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * PendingApprovalItem Component
 */
function PendingApprovalItem({
  document,
  size,
  onApprove,
  onReject,
}: {
  document: Document;
  size: DocumentUpdatesSize;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const sizes = sizeClasses[size];

  return (
    <div className={`${sizes.itemPadding} rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800`}>
      <div className="flex items-start gap-3">
        <DocumentIcon type={document.type} size={size} />
        <div className="flex-1 min-w-0">
          <p className={`${sizes.textSize} font-medium text-gray-900 dark:text-white`}>
            {document.name}
          </p>
          <p className={`${sizes.labelSize} text-gray-600 dark:text-gray-400 mt-1`}>
            Uploaded by {document.uploadedBy} • {document.size}
          </p>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onApprove}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <CheckCircle className="w-3 h-3" />
            Approve
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DocumentUpdatesWidget Component
 */
export function DocumentUpdatesWidget({
  projectId,
  onDocumentClick,
  onDownload,
  size = 'medium',
  showSearch = true,
  showFilter = true,
  showPendingApprovals = true,
  showRecentUploads = true,
  isLoading = false,
  onRefresh,
  className = '',
}: DocumentUpdatesWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | 'all'>('all');
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [docData] = useState<DocumentUpdatesData>({
    totalDocuments: 234,
    recentUploads: 12,
    pendingApprovals: 5,
    superseded: 18,
    documents: [
      {
        id: '1',
        name: 'Site Safety Plan v3.2.pdf',
        type: 'pdf',
        category: 'RAMS',
        version: '3.2',
        size: '2.4 MB',
        status: 'pending_approval',
        uploadedBy: 'John Smith',
        uploadedDate: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        requiresApproval: true,
      },
      {
        id: '2',
        name: 'Foundation Drawings A3-01.dwg',
        type: 'dwg',
        category: 'DRAWINGS',
        version: '1.0',
        size: '8.1 MB',
        status: 'current',
        uploadedBy: 'Sarah Chen',
        uploadedDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        downloadCount: 24,
      },
      {
        id: '3',
        name: 'Weekly Progress Report W42.pdf',
        type: 'pdf',
        category: 'REPORTS',
        version: '1.0',
        size: '1.2 MB',
        status: 'current',
        uploadedBy: 'Mike Johnson',
        uploadedDate: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        downloadCount: 18,
      },
      {
        id: '4',
        name: 'Material Specs - Concrete.xlsx',
        type: 'xls',
        category: 'SPECS',
        version: '2.1',
        size: '456 KB',
        status: 'superseded',
        uploadedBy: 'Emma Wilson',
        uploadedDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      },
      {
        id: '5',
        name: 'Site Photos - Block A.jpg',
        type: 'img',
        category: 'PHOTOS',
        version: '1.0',
        size: '3.8 MB',
        status: 'current',
        uploadedBy: 'David Lee',
        uploadedDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        downloadCount: 7,
      },
      {
        id: '6',
        name: 'Building Permit 2024-042.pdf',
        type: 'pdf',
        category: 'PERMITS',
        version: '1.0',
        size: '892 KB',
        status: 'current',
        uploadedBy: 'Patricia Watson',
        uploadedDate: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        isLocked: true,
      },
    ],
  });

  const pendingDocuments = docData.documents.filter((d) => d.status === 'pending_approval');
  const recentDocuments = docData.documents.filter((d) => d.status !== 'pending_approval' && d.status !== 'archived');

  const filteredDocuments = recentDocuments.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || doc.type === filterType;
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesProject = !projectId || doc.projectId === projectId;
    return matchesSearch && matchesType && matchesStatus && matchesProject;
  });

  const stats = [
    { label: 'Total', value: docData.totalDocuments, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Recent', value: docData.recentUploads, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Pending', value: docData.pendingApprovals, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    { label: 'Superseded', value: docData.superseded, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700' },
  ];

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white flex items-center gap-2`}>
            <FileText className="w-5 h-5 text-blue-600" />
            Document Updates
          </h3>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-lg p-2 text-center`}>
              <div className={`${sizes.valueSize} font-bold ${stat.color}`}>{stat.value}</div>
              <div className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        {(showSearch || showFilter) && (
          <div className="flex gap-2">
            {showSearch && (
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary`}
                />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
            {showFilter && (
              <>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as DocumentType | 'all')}
                  className={`px-3 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer`}
                >
                  <option value="all">All Types</option>
                  {Object.keys(documentTypeConfig).map((type) => (
                    <option key={type} value={type}>
                      {documentTypeConfig[type as DocumentType].label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as DocumentStatus | 'all')}
                  className={`px-3 py-2 ${sizes.textSize} bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer`}
                >
                  <option value="all">All Status</option>
                  {Object.keys(statusConfig).map((status) => (
                    <option key={status} value={status}>
                      {statusConfig[status as DocumentStatus].label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${sizes.padding} space-y-4 max-h-[600px] overflow-y-auto`}>
        {/* Pending Approvals */}
        {showPendingApprovals && pendingDocuments.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-orange-600 mb-3 flex items-center gap-2`}>
              <AlertCircle className="w-4 h-4" />
              Pending Approval ({pendingDocuments.length})
            </h4>
            <div className="space-y-2">
              {pendingDocuments.map((doc) => (
                <PendingApprovalItem
                  key={doc.id}
                  document={doc}
                  size={size}
                  onApprove={() => onDocumentClick?.(doc)}
                  onReject={() => onDocumentClick?.(doc)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent Uploads */}
        {showRecentUploads && filteredDocuments.length > 0 && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
              Recent Documents
            </h4>
            <div className="space-y-2">
              {filteredDocuments.slice(0, 8).map((doc) => (
                <DocumentItem
                  key={doc.id}
                  document={doc}
                  size={size}
                  onClick={() => onDocumentClick?.(doc)}
                  onDownload={() => onDownload?.(doc)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredDocuments.length === 0 && pendingDocuments.length === 0 && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className={`${sizes.textSize} text-gray-500 dark:text-gray-400`}>
              No documents found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentUpdatesWidget;
