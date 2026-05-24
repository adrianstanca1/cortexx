import React from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

/**
 * StatsCard Widget
 *
 * Displays KPI metrics with icon, title, value, and trend indicator.
 * Supports multiple color variants and click navigation.
 *
 * @param props - Component props
 * @returns JSX element displaying stat card
 *
 * @example
 * ```tsx
 * <StatsCard
 *   icon={FolderOpen}
 *   title="Active Projects"
 *   value={24}
 *   trend={{ value: 12, direction: 'up' }}
 *   color="blue"
 *   onClick={() => navigate('/projects')}
 * />
 * ```
 */

export type StatsCardColor = 'blue' | 'green' | 'red' | 'orange' | 'purple';
export type StatsCardSize = 'small' | 'medium' | 'large';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface StatsCardProps {
  /** Icon component to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Value to display (number or string) */
  value: number | string;
  /** Trend indicator */
  trend?: {
    value: number;
    direction: TrendDirection;
  };
  /** Color variant */
  color?: StatsCardColor;
  /** Size variant */
  size?: StatsCardSize;
  /** Click handler for navigation */
  onClick?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Optional subtitle */
  subtitle?: string;
  /** Custom className */
  className?: string;
}

const colorClasses: Record<StatsCardColor, {
  bg: string;
  bgDark: string;
  text: string;
  iconBg: string;
  iconBgDark: string;
}> = {
  blue: {
    bg: 'bg-blue-50',
    bgDark: 'dark:bg-blue-900/20',
    text: 'text-blue-600',
    iconBg: 'bg-blue-100',
    iconBgDark: 'dark:bg-blue-900/40',
  },
  green: {
    bg: 'bg-green-50',
    bgDark: 'dark:bg-green-900/20',
    text: 'text-green-600',
    iconBg: 'bg-green-100',
    iconBgDark: 'dark:bg-green-900/40',
  },
  red: {
    bg: 'bg-red-50',
    bgDark: 'dark:bg-red-900/20',
    text: 'text-red-600',
    iconBg: 'bg-red-100',
    iconBgDark: 'dark:bg-red-900/40',
  },
  orange: {
    bg: 'bg-orange-50',
    bgDark: 'dark:bg-orange-900/20',
    text: 'text-orange-600',
    iconBg: 'bg-orange-100',
    iconBgDark: 'dark:bg-orange-900/40',
  },
  purple: {
    bg: 'bg-purple-50',
    bgDark: 'dark:bg-purple-900/20',
    text: 'text-purple-600',
    iconBg: 'bg-purple-100',
    iconBgDark: 'dark:bg-purple-900/40',
  },
};

const sizeClasses: Record<StatsCardSize, {
  padding: string;
  valueSize: string;
  titleSize: string;
  iconSize: string;
}> = {
  small: {
    padding: 'p-3',
    valueSize: 'text-xl',
    titleSize: 'text-xs',
    iconSize: 'w-4 h-4',
  },
  medium: {
    padding: 'p-4',
    valueSize: 'text-2xl',
    titleSize: 'text-sm',
    iconSize: 'w-5 h-5',
  },
  large: {
    padding: 'p-6',
    valueSize: 'text-3xl',
    titleSize: 'text-base',
    iconSize: 'w-6 h-6',
  },
};

/**
 * TrendIndicator Component
 * Displays trend direction with color-coded icon
 */
function TrendIndicator({ trend }: { trend: NonNullable<StatsCardProps['trend']> }) {
  const { value, direction } = trend;

  const isPositive = direction === 'up';
  const isNeutral = direction === 'stable';

  const colorClass = isNeutral
    ? 'text-gray-500'
    : isPositive
    ? 'text-green-600'
    : 'text-red-600';

  const bgColorClass = isNeutral
    ? 'bg-gray-100 dark:bg-gray-800'
    : isPositive
    ? 'bg-green-100 dark:bg-green-900/30'
    : 'bg-red-100 dark:bg-red-900/30';

  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColorClass} ${colorClass}`}>
      <Icon className="w-3 h-3" />
      <span>{value}%</span>
    </div>
  );
}

/**
 * StatsCard Component
 */
export function StatsCard({
  icon: Icon,
  title,
  value,
  trend,
  color = 'blue',
  size = 'medium',
  onClick,
  isLoading = false,
  subtitle,
  className = '',
}: StatsCardProps) {
  const colors = colorClasses[color];
  const sizes = sizeClasses[size];

  const baseClasses = `
    relative overflow-hidden
    rounded-xl border border-gray-200 dark:border-gray-700
    bg-white dark:bg-gray-800
    transition-all duration-200
    ${sizes.padding}
    ${className}
  `;

  const clickableClasses = onClick
    ? 'cursor-pointer hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 active:scale-[0.98]'
    : 'shadow-sm';

  if (isLoading) {
    return (
      <div className={baseClasses}>
        <div className="animate-pulse space-y-3">
          <div className={`rounded-lg ${colors.iconBg} ${colors.iconBgDark} w-10 h-10`} />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${clickableClasses}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Icon */}
          <div
            className={`inline-flex p-2 rounded-lg ${colors.iconBg} ${colors.iconBgDark} ${colors.text} mb-3`}
          >
            <Icon className={sizes.iconSize} />
          </div>

          {/* Title */}
          <p className={`${sizes.titleSize} font-medium text-gray-500 dark:text-gray-400 truncate`}>
            {title}
          </p>

          {/* Value */}
          <p className={`${sizes.valueSize} font-bold text-gray-900 dark:text-white mt-1 truncate`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}

          {/* Trend */}
          {trend && (
            <div className="mt-2">
              <TrendIndicator trend={trend} />
            </div>
          )}
        </div>
      </div>

      {/* Decorative background element */}
      <div
        className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${colors.bg} ${colors.bgDark} opacity-50 pointer-events-none`}
      />
    </div>
  );
}

export default StatsCard;
