import React, { useState } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  ClipboardCheck,
  Award,
  RefreshCw,
  ChevronRight,
  Calendar,
} from 'lucide-react';

/**
 * SafetyMetricsWidget
 *
 * Displays safety metrics including incident counts, days without incident,
 * safety score, and recent inspections.
 *
 * @param props - Component props
 * @returns JSX element displaying safety metrics
 *
 * @example
 * ```tsx
 * <SafetyMetricsWidget
 *   projectId="proj-123"
 *   onInspectionClick={(inspection) => handleNavigate(inspection)}
 * />
 * ```
 */

export type Severity = 'minor' | 'moderate' | 'serious' | 'fatal';
export type InspectionStatus = 'scheduled' | 'passed' | 'failed' | 'conditional';
export type SafetyMetricsSize = 'small' | 'medium' | 'large';

export interface SafetyInspection {
  id: string;
  type: string;
  inspector: string;
  date: string;
  status: InspectionStatus;
  score?: number;
  location?: string;
}

export interface SafetyIncident {
  id: string;
  type: 'incident' | 'near-miss' | 'hazard';
  title: string;
  severity: Severity;
  date: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
}

export interface SafetyMetricsData {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  daysSinceLastIncident: number;
  safetyScore: number;
  toolboxTalksCompleted: number;
  toolboxTalksTotal: number;
  toolChecksPassed: number;
  toolChecksTotal: number;
  activeWorkers: number;
  incidentsBySeverity: Record<Severity, number>;
  recentInspections: SafetyInspection[];
  recentIncidents: SafetyIncident[];
}

export interface SafetyMetricsWidgetProps {
  /** Optional project ID to filter data */
  projectId?: string;
  /** Click handler for inspections */
  onInspectionClick?: (inspection: SafetyInspection) => void;
  /** Click handler for incidents */
  onIncidentClick?: (incident: SafetyIncident) => void;
  /** Size variant */
  size?: SafetyMetricsSize;
  /** Show incident breakdown */
  showIncidentBreakdown?: boolean;
  /** Show recent inspections */
  showInspections?: boolean;
  /** Show recent incidents */
  showIncidents?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const severityConfig: Record<Severity, {
  label: string;
  color: string;
  bg: string;
}> = {
  minor: {
    label: 'Minor',
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  serious: {
    label: 'Serious',
    color: 'text-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
  },
  fatal: {
    label: 'Fatal',
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
};

const inspectionStatusConfig: Record<InspectionStatus, {
  label: string;
  icon: React.ReactNode;
  color: string;
}> = {
  scheduled: {
    label: 'Scheduled',
    icon: <Calendar className="w-3 h-3" />,
    color: 'text-gray-500',
  },
  passed: {
    label: 'Passed',
    icon: <CheckCircle className="w-3 h-3" />,
    color: 'text-green-600',
  },
  failed: {
    label: 'Failed',
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'text-red-600',
  },
  conditional: {
    label: 'Conditional',
    icon: <ClipboardCheck className="w-3 h-3" />,
    color: 'text-yellow-600',
  },
};

const sizeClasses: Record<SafetyMetricsSize, {
  padding: string;
  textSize: string;
  labelSize: string;
  valueSize: string;
  itemPadding: string;
}> = {
  small: {
    padding: 'p-3',
    textSize: 'text-xs',
    labelSize: 'text-xs',
    valueSize: 'text-lg',
    itemPadding: 'p-2',
  },
  medium: {
    padding: 'p-4',
    textSize: 'text-sm',
    labelSize: 'text-sm',
    valueSize: 'text-2xl',
    itemPadding: 'p-2.5',
  },
  large: {
    padding: 'p-5',
    textSize: 'text-base',
    labelSize: 'text-base',
    valueSize: 'text-3xl',
    itemPadding: 'p-3',
  },
};

/**
 * MetricCard Component
 */
function MetricCard({
  icon,
  label,
  value,
  subtext,
  trend,
  color = 'blue',
  size,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: number; isPositive: boolean };
  color?: string;
  size: SafetyMetricsSize;
}) {
  const sizes = sizeClasses[size];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className={`${sizes.itemPadding} rounded-lg bg-gray-50 dark:bg-gray-700/50`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>{label}</span>
      </div>
      <div className={`${sizes.valueSize} font-bold text-gray-900 dark:text-white`}>{value}</div>
      {subtext && (
        <p className={`${sizes.textSize} text-gray-500 dark:text-gray-400 mt-1`}>{subtext}</p>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          <TrendingUp className={`w-3 h-3 ${!trend.isPositive && 'rotate-180'}`} />
          <span className={`${sizes.textSize} font-medium`}>{trend.value}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * SafetyScoreGauge Component
 */
function SafetyScoreGauge({
  score,
  size,
}: {
  score: number;
  size: SafetyMetricsSize;
}) {
  const sizes = sizeClasses[size];
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-500';
    if (score >= 75) return 'text-blue-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${getScoreColor(score)} transition-all duration-500 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`${sizes.valueSize} font-bold text-gray-900 dark:text-white`}>
              {score}%
            </div>
          </div>
        </div>
      </div>
      <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 mt-2`}>
        {getScoreLabel(score)}
      </span>
    </div>
  );
}

/**
 * InspectionItem Component
 */
function InspectionItem({
  inspection,
  size,
  onClick,
}: {
  inspection: SafetyInspection;
  size: SafetyMetricsSize;
  onClick?: () => void;
}) {
  const sizes = sizeClasses[size];
  const config = inspectionStatusConfig[inspection.status];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `in ${diffDays}d`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      className={`${sizes.itemPadding} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex items-center gap-3`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className={`p-2 rounded-lg ${config.color.replace('text-', 'bg-').replace('600', '100')} dark:bg-gray-700`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`${sizes.textSize} font-medium text-gray-900 dark:text-white truncate`}>
          {inspection.type}
        </p>
        <p className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
          {inspection.inspector}
        </p>
      </div>
      <div className="text-right">
        <span className={`${sizes.labelSize} font-medium ${config.color}`}>{config.label}</span>
        <p className={`${sizes.labelSize} text-gray-400`}>{formatDate(inspection.date)}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </div>
  );
}

/**
 * SafetyMetricsWidget Component
 */
export function SafetyMetricsWidget({
  projectId: _projectId,
  onInspectionClick,
  onIncidentClick,
  size = 'medium',
  showIncidentBreakdown = true,
  showInspections = true,
  showIncidents = true,
  isLoading = false,
  onRefresh,
  className = '',
}: SafetyMetricsWidgetProps) {
  const sizes = sizeClasses[size];

  // Mock data - replace with actual API call
  const [metrics] = useState<SafetyMetricsData>({
    totalIncidents: 12,
    openIncidents: 3,
    resolvedIncidents: 9,
    daysSinceLastIncident: 28,
    safetyScore: 87,
    toolboxTalksCompleted: 42,
    toolboxTalksTotal: 48,
    toolChecksPassed: 156,
    toolChecksTotal: 162,
    activeWorkers: 47,
    incidentsBySeverity: {
      minor: 6,
      moderate: 4,
      serious: 2,
      fatal: 0,
    },
    recentInspections: [
      {
        id: '1',
        type: 'Weekly Site Inspection',
        inspector: 'John Smith',
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        status: 'scheduled',
        location: 'Block A',
      },
      {
        id: '2',
        type: 'Scaffolding Check',
        inspector: 'Mike Johnson',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        status: 'passed',
        score: 95,
        location: 'North Wing',
      },
      {
        id: '3',
        type: 'Equipment Safety Audit',
        inspector: 'Sarah Chen',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        status: 'conditional',
        score: 78,
        location: 'Main Site',
      },
    ],
    recentIncidents: [
      {
        id: '1',
        type: 'near-miss',
        title: 'Falling object near miss',
        severity: 'moderate',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        status: 'resolved',
      },
      {
        id: '2',
        type: 'hazard',
        title: 'Exposed wiring',
        severity: 'minor',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        status: 'open',
      },
    ],
  });

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
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
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700 flex items-center justify-between`}>
        <h3 className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white flex items-center gap-2`}>
          <Shield className="w-5 h-5 text-blue-600" />
          Safety Metrics
        </h3>
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

      {/* Content */}
      <div className={`${sizes.padding} space-y-6`}>
        {/* Top Row - Safety Score + Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Safety Score Gauge */}
          <div className="md:col-span-1 flex items-center justify-center">
            <SafetyScoreGauge score={metrics.safetyScore} size={size} />
          </div>

          {/* Key Metrics */}
          <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Days Without Incident"
              value={metrics.daysSinceLastIncident}
              subtext="Great safety record!"
              color="green"
              size={size}
            />
            <MetricCard
              icon={<Users className="w-4 h-4" />}
              label="Active Workers"
              value={metrics.activeWorkers}
              subtext="On site today"
              color="blue"
              size={size}
            />
            <MetricCard
              icon={<ClipboardCheck className="w-4 h-4" />}
              label="Tool Checks"
              value={`${metrics.toolChecksPassed}/${metrics.toolChecksTotal}`}
              subtext={`${((metrics.toolChecksPassed / metrics.toolChecksTotal) * 100).toFixed(0)}% pass rate`}
              color="purple"
              size={size}
            />
            <MetricCard
              icon={<Award className="w-4 h-4" />}
              label="Toolbox Talks"
              value={`${metrics.toolboxTalksCompleted}/${metrics.toolboxTalksTotal}`}
              subtext={`${((metrics.toolboxTalksCompleted / metrics.toolboxTalksTotal) * 100).toFixed(0)}% completed`}
              color="yellow"
              size={size}
            />
            <MetricCard
              icon={<CheckCircle className="w-4 h-4" />}
              label="Resolved Incidents"
              value={metrics.resolvedIncidents}
              subtext={`of ${metrics.totalIncidents} total`}
              trend={{ value: 15, isPositive: true }}
              color="green"
              size={size}
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Open Incidents"
              value={metrics.openIncidents}
              subtext="Requires attention"
              color="red"
              size={size}
            />
          </div>
        </div>

        {/* Incident Breakdown */}
        {showIncidentBreakdown && (
          <div>
            <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
              Incidents by Severity
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {(Object.keys(severityConfig) as Severity[]).map((severity) => (
                <div
                  key={severity}
                  className={`${sizes.itemPadding} rounded-lg ${severityConfig[severity].bg} text-center`}
                >
                  <div className={`${sizes.valueSize} font-bold ${severityConfig[severity].color}`}>
                    {metrics.incidentsBySeverity[severity]}
                  </div>
                  <div className={`${sizes.labelSize} text-gray-600 dark:text-gray-400`}>
                    {severityConfig[severity].label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Inspections & Incidents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Inspections */}
          {showInspections && metrics.recentInspections.length > 0 && (
            <div>
              <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
                Recent Inspections
              </h4>
              <div className="space-y-2">
                {metrics.recentInspections.slice(0, 3).map((inspection: SafetyInspection) => (
                  <InspectionItem
                    key={inspection.id}
                    inspection={inspection}
                    size={size}
                    onClick={() => onInspectionClick?.(inspection)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Incidents */}
          {showIncidents && metrics.recentIncidents.length > 0 && (
            <div>
              <h4 className={`${sizes.labelSize} font-semibold text-gray-700 dark:text-gray-300 mb-3`}>
                Recent Incidents
              </h4>
              <div className="space-y-2">
                {metrics.recentIncidents.slice(0, 3).map((incident: SafetyIncident) => (
                  <InspectionItem
                    key={incident.id}
                    inspection={{
                      id: incident.id,
                      type: incident.title,
                      inspector: incident.severity,
                      date: incident.date,
                      status: incident.status === 'open' ? 'failed' : 'passed',
                    }}
                    size={size}
                    onClick={() => onIncidentClick?.(incident)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SafetyMetricsWidget;
