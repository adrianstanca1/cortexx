/**
 * CortexBuild Ultimate — Advanced Chart Components
 * Reusable chart components with consistent styling
 */
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// Chart color palette
export const CHART_COLORS = {
  primary: '#f59e0b',     // Amber
  secondary: '#3b82f6',   // Blue
  success: '#10b981',     // Emerald
  warning: '#f97316',      // Orange
  danger: '#ef4444',       // Red
  purple: '#8b5cf6',      // Purple
  cyan: '#06b6d4',        // Cyan
  pink: '#ec4899',         // Pink
};

const CHART_COLOR_ARRAY = Object.values(CHART_COLORS);

// Reusable chart wrapper with consistent styling
interface ChartWrapperProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({ title, subtitle, children, className = '' }: ChartWrapperProps) {
  return (
    <div className={`card p-5 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  prefix?: string;
  suffix?: string;
}

export function CustomTooltip({ active, payload, label, prefix = '', suffix = '' }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
      {label && <p className="text-xs text-gray-400 mb-2">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="text-white font-medium">
            {prefix}{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

// Donut chart component
interface DonutChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  width?: number | string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
}

export function DonutChart({
  data,
  width = '100%',
  height = 200,
  innerRadius = 60,
  outerRadius = 80,
  showLegend = true,
}: DonutChartProps) {
  const chartData = data.map((d, i) => ({
    ...d,
    color: d.color || CHART_COLOR_ARRAY[i % CHART_COLOR_ARRAY.length],
  }));

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={width as number | `${number}%`} height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip prefix="£" />} />
        </PieChart>
      </ResponsiveContainer>
      {showLegend && (
        <div className="flex flex-col gap-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: item.color }} />
              <span className="text-sm text-gray-400">{item.name}</span>
              <span className="text-sm text-white font-medium">£{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Animated area chart
interface AreaChartWidgetProps {
  data: Array<{ [key: string]: string | number }>;
  dataKey: string;
  xAxisKey: string;
  color?: string;
  gradientId?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export function AreaChartWidget({
  data,
  dataKey,
  xAxisKey,
  color = CHART_COLORS.primary,
  gradientId = 'areaGradient',
  height = 200,
  showGrid = true,
  showTooltip = true,
}: AreaChartWidgetProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#374151"
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#374151"
          tickLine={false}
          tickFormatter={(value) => `£${(value / 1000).toFixed(0)}K`}
        />
        {showTooltip && (
          <Tooltip content={<CustomTooltip prefix="£" />} />
        )}
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ fill: color, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Progress bar with label
interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  label,
  value,
  max,
  color = CHART_COLORS.primary,
  showPercent = true,
  size = 'md',
}: ProgressBarProps) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">{label}</span>
        {showPercent && (
          <span className="text-sm font-medium" style={{ color }}>
            {percent.toFixed(1)}%
          </span>
        )}
      </div>
      <div className={`w-full bg-gray-800 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percent, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// Sparkline mini chart
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number | string;
  height?: number;
}

export function Sparkline({
  data,
  color = CHART_COLORS.primary,
  width = 60,
  height = 24,
}: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));
  const min = Math.min(...data);
  const max = Math.max(...data);
  const _range = max - min || 1;

  return (
    <ResponsiveContainer width={width as number | `${number}%`} height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Status badge with indicator
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
  pulse?: boolean;
}

export function StatusBadge({ status, label, pulse = false }: StatusBadgeProps) {
  const colors = {
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    neutral: 'bg-gray-700/50 text-gray-400 border-gray-600/50',
  };
  const dotColors = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-blue-400',
    neutral: 'bg-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${colors[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColors[status]}`}
        style={pulse ? { animation: 'pulse 2s infinite' } : undefined}
      />
      {label}
    </span>
  );
}

export { CHART_COLOR_ARRAY };
