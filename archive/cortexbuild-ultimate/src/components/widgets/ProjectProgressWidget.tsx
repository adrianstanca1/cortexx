import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

/**
 * ProjectProgressWidget
 *
 * Displays project progress with progress bar, budget vs actual,
 * timeline status, and risk indicators.
 *
 * @param props - Component props
 * @returns JSX element displaying project progress
 *
 * @example
 * ```tsx
 * <ProjectProgressWidget
 *   project={project}
 *   onClick={() => navigate(`/projects/${project.id}`)}
 * />
 * ```
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TimelineStatus = 'on_track' | 'at_risk' | 'delayed' | 'ahead';
export type ProjectProgressSize = 'small' | 'medium' | 'large';

export interface ProjectProgressData {
  id: string;
  name: string;
  progress: number;
  budget: number;
  actual: number;
  startDate: string;
  endDate: string;
  timelineStatus: TimelineStatus;
  riskLevel: RiskLevel;
  tasksCompleted: number;
  tasksTotal: number;
  milestonesCompleted: number;
  milestonesTotal: number;
}

export interface ProjectProgressWidgetProps {
  /** Project data */
  project: ProjectProgressData;
  /** Click handler for navigation */
  onClick?: () => void;
  /** Size variant */
  size?: ProjectProgressSize;
  /** Show detailed budget breakdown */
  showBudgetDetail?: boolean;
  /** Show timeline info */
  showTimeline?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

const riskColors: Record<RiskLevel, {
  bg: string;
  text: string;
  border: string;
}> = {
  low: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
};

const timelineStatusConfig: Record<TimelineStatus, {
  icon: React.ReactNode;
  label: string;
  color: string;
}> = {
  on_track: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'On Track',
    color: 'text-green-600',
  },
  at_risk: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'At Risk',
    color: 'text-yellow-600',
  },
  delayed: {
    icon: <Clock className="w-4 h-4" />,
    label: 'Delayed',
    color: 'text-red-600',
  },
  ahead: {
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Ahead',
    color: 'text-blue-600',
  },
};

const sizeClasses: Record<ProjectProgressSize, {
  padding: string;
  progressHeight: string;
  textSize: string;
  labelSize: string;
}> = {
  small: {
    padding: 'p-3',
    progressHeight: 'h-1.5',
    textSize: 'text-xs',
    labelSize: 'text-xs',
  },
  medium: {
    padding: 'p-4',
    progressHeight: 'h-2',
    textSize: 'text-sm',
    labelSize: 'text-sm',
  },
  large: {
    padding: 'p-5',
    progressHeight: 'h-2.5',
    textSize: 'text-base',
    labelSize: 'text-base',
  },
};

/**
 * ProgressBar Component
 */
function _ProgressBar({
  value,
  max = 100,
  color = 'blue',
  height = 'h-2',
  showLabel = false,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: string;
  showLabel?: boolean;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Progress</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${colorClasses[color] || colorClasses.blue} h-full rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * BudgetComparison Component
 */
function BudgetComparison({
  budget,
  actual,
  size,
}: {
  budget: number;
  actual: number;
  size: ProjectProgressSize;
}) {
  const variance = actual - budget;
  const variancePercent = budget > 0 ? (variance / budget) * 100 : 0;
  const isOverBudget = variance > 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const sizes = sizeClasses[size];

  return (
    <div className={`${sizes.padding} bg-gray-50 dark:bg-gray-700/50 rounded-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 flex items-center gap-1`}>
          <DollarSign className="w-3 h-3" />
          Budget vs Actual
        </span>
        <span
          className={`${sizes.textSize} font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'} flex items-center gap-1`}
        >
          {isOverBudget ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {variancePercent > 0 ? '+' : ''}
          {variancePercent.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Budget:</span>
          <span className={`${sizes.textSize} font-medium text-gray-900 dark:text-white`}>
            {formatCurrency(budget)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Actual:</span>
          <span
            className={`${sizes.textSize} font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
          >
            {formatCurrency(actual)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * TimelineInfo Component
 */
function TimelineInfo({
  startDate,
  endDate,
  status,
  size,
}: {
  startDate: string;
  endDate: string;
  status: TimelineStatus;
  size: ProjectProgressSize;
}) {
  const config = timelineStatusConfig[status];
  const sizes = sizeClasses[size];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysRemaining = () => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className={`${sizes.padding} bg-gray-50 dark:bg-gray-700/50 rounded-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400 flex items-center gap-1`}>
          <Calendar className="w-3 h-3" />
          Timeline
        </span>
        <span className={`${sizes.textSize} font-medium ${config.color} flex items-center gap-1`}>
          {config.icon}
          {config.label}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Start:</span>
          <span className={`${sizes.textSize} text-gray-900 dark:text-white`}>
            {formatDate(startDate)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>End:</span>
          <span className={`${sizes.textSize} text-gray-900 dark:text-white`}>
            {formatDate(endDate)}
          </span>
        </div>
        {daysRemaining > 0 && (
          <div className="flex justify-between">
            <span className={`${sizes.textSize} text-gray-600 dark:text-gray-400`}>Remaining:</span>
            <span
              className={`${sizes.textSize} font-medium ${daysRemaining < 14 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
            >
              {daysRemaining} days
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ProjectProgressWidget Component
 */
export function ProjectProgressWidget({
  project,
  onClick,
  size = 'medium',
  showBudgetDetail = true,
  showTimeline = true,
  isLoading = false,
  onRefresh,
  className = '',
}: ProjectProgressWidgetProps) {
  const sizes = sizeClasses[size];

  const getProgressColor = (progress: number, riskLevel: RiskLevel): string => {
    if (riskLevel === 'critical' || riskLevel === 'high') return 'red';
    if (riskLevel === 'medium') return 'yellow';
    if (progress >= 75) return 'green';
    if (progress >= 50) return 'blue';
    return 'purple';
  };

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <div className={`${sizes.padding} space-y-3 animate-pulse`}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className={`h-2 bg-gray-200 dark:bg-gray-700 rounded ${sizes.progressHeight}`} />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-lg ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Header */}
      <div className={`${sizes.padding} border-b border-gray-100 dark:border-gray-700 flex items-center justify-between`}>
        <div className="flex-1 min-w-0">
          <h3
            className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white truncate`}
            title={project.name}
          >
            {project.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Risk Badge */}
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${riskColors[project.riskLevel].bg} ${riskColors[project.riskLevel].text}`}
          >
            {project.riskLevel.charAt(0).toUpperCase() + project.riskLevel.slice(1)} Risk
          </span>
          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {onClick && (
            <ArrowRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`${sizes.padding} space-y-4`}>
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between mb-2">
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              Overall Progress
            </span>
            <span className={`${sizes.textSize} font-semibold text-gray-900 dark:text-white`}>
              {project.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizes.progressHeight}">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-blue-500 to-${getProgressColor(project.progress, project.riskLevel)}-500`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              {project.tasksCompleted}/{project.tasksTotal} tasks
            </span>
            <span className={`${sizes.labelSize} text-gray-500 dark:text-gray-400`}>
              {project.milestonesCompleted}/{project.milestonesTotal} milestones
            </span>
          </div>
        </div>

        {/* Budget and Timeline */}
        {(showBudgetDetail || showTimeline) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {showBudgetDetail && (
              <BudgetComparison
                budget={project.budget}
                actual={project.actual}
                size={size}
              />
            )}
            {showTimeline && (
              <TimelineInfo
                startDate={project.startDate}
                endDate={project.endDate}
                status={project.timelineStatus}
                size={size}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectProgressWidget;
