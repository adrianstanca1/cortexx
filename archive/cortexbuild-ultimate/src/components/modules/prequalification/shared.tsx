import { CheckCircle, Clock, AlertTriangle, Building2, Award, Star, X } from 'lucide-react';
import type { Subcontractor, Stats } from './types';

export { TRADES } from './types';

interface KPICardProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  valueColor: string;
}

export function KPICard({ icon: Icon, iconColor, iconBg, label, value, valueColor }: KPICardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={iconColor} size={20} />
        </div>
        <div>
          <p className="text-gray-400 text-xs font-semibold">{label}</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export function QuickStats({ stats, expiringCount }: { stats: Stats; expiringCount: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KPICard
        icon={CheckCircle}
        iconColor="text-green-400"
        iconBg="bg-green-500/10"
        label="Approved"
        value={stats.approved}
        valueColor="text-green-400"
      />
      <KPICard
        icon={Clock}
        iconColor="text-blue-400"
        iconBg="bg-blue-500/10"
        label="Under Review"
        value={stats.statusCounts.under_review}
        valueColor="text-blue-400"
      />
      <KPICard
        icon={AlertTriangle}
        iconColor="text-amber-400"
        iconBg="bg-amber-500/10"
        label="Expiring Soon"
        value={expiringCount}
        valueColor="text-amber-400"
      />
      <KPICard
        icon={Building2}
        iconColor="text-purple-400"
        iconBg="bg-purple-500/10"
        label="Total"
        value={stats.approved + stats.statusCounts.pending + stats.statusCounts.under_review + stats.statusCounts.rejected}
        valueColor="text-purple-400"
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: Subcontractor['status'] }) {
  const colorMap = {
    approved: 'bg-green-500/10 text-green-400',
    under_review: 'bg-blue-500/10 text-blue-400',
    pending: 'bg-amber-500/10 text-amber-400',
    rejected: 'bg-red-500/10 text-red-400',
  };

  const labelMap = {
    approved: 'Approved',
    under_review: 'Under Review',
    pending: 'Pending',
    rejected: 'Rejected',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colorMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

export function TierBadge({ tier }: { tier: NonNullable<Subcontractor['tier']> }) {
  const config = {
    gold: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Award },
    silver: { bg: 'bg-gray-400/20', text: 'text-gray-300', icon: Star },
    bronze: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: Star },
  };

  const { bg, text, icon: Icon } = config[tier];

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${bg} ${text}`}>
      {tier === 'gold' && <Icon className="w-3 h-3" />}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </div>
  );
}

export function ModalWrapper({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 border border-gray-700 rounded-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function getDaysUntilExpiry(expiryDate: string): number {
  return Math.ceil(
    (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getExpiryColor(days: number): string {
  if (days <= 30) return 'text-red-400 bg-red-500/10';
  if (days <= 60) return 'text-amber-400 bg-amber-500/10';
  return 'text-green-400 bg-green-500/10';
}
