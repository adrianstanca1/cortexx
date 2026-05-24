// Safety Command Panel — Dramatic animated statistics dashboard
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Shield, AlertTriangle, Eye, HardHat, ClipboardCheck, FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Animated Counter ───────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!startRef.current) startRef.current = ts;
        const elapsed = ts - startRef.current;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, delay]);

  return value;
}

// ─── Sparkline Chart ────────────────────────────────────────────────────────
function Sparkline({ data, color = '#f59e0b', width = 80, height = 28 }: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + ((max - v) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  // Area fill
  const areaPoints = [
    `${pad},${height - pad}`,
    ...points,
    `${width - pad},${height - pad}`,
  ].join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#sparkGrad-${color.replace('#', '')})`}
      />
      <polyline
        points={points.join(' ')}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const x = pad + (width - pad * 2);
        const y = pad + ((max - last) / range) * (height - pad * 2);
        return <circle cx={x} cy={y} r="2" fill={color} />;
      })()}
    </svg>
  );
}

// ─── Trend Arrow ────────────────────────────────────────────────────────────
function TrendArrow({ value, invert = false }: { value: number; invert?: boolean }) {
  const isPositive = invert ? value < 0 : value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? 'text-gray-400' : isPositive ? 'text-emerald-400' : 'text-red-400';
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${color}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value)}%
    </span>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  unit?: string;
  icon: ReactNode;
  color: 'green' | 'amber' | 'red' | 'blue';
  trend?: number;
  sparkData?: number[];
  invertTrend?: boolean;
  delay?: number;
  isPercentage?: boolean;
}

const colorMap = {
  green: {
    border: 'border-emerald-800/50',
    bg: 'bg-gradient-to-br from-emerald-500/12 to-emerald-600/5',
    accent: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    glow: 'shadow-emerald-500/10',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
  },
  amber: {
    border: 'border-amber-800/50',
    bg: 'bg-gradient-to-br from-amber-500/12 to-amber-600/5',
    accent: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    glow: 'shadow-amber-500/10',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
  },
  red: {
    border: 'border-red-800/50',
    bg: 'bg-gradient-to-br from-red-500/12 to-red-600/5',
    accent: 'text-red-400',
    iconBg: 'bg-red-500/15',
    glow: 'shadow-red-500/10',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
  },
  blue: {
    border: 'border-blue-800/50',
    bg: 'bg-gradient-to-br from-blue-500/12 to-blue-600/5',
    accent: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    glow: 'shadow-blue-500/10',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
  },
};

function StatCard({ label, value, unit, icon, color, trend, sparkData, invertTrend, delay = 0, isPercentage: _isPercentage }: StatCardProps) {
  const c = colorMap[color];
  const animatedValue = useCountUp(value, 1400, delay);

  return (
    <div
      className={`relative rounded-2xl border ${c.border} ${c.bg} p-5 overflow-hidden
        transition-all duration-300 hover:scale-[1.02] hover:border-opacity-80
        shadow-lg ${c.glow}`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Corner accent */}
      <div
        className={`absolute top-0 right-0 w-16 h-16 opacity-5 rounded-bl-full ${c.accent.replace('text-', 'bg-')}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Label */}
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 leading-none">
            {label}
          </p>

          {/* Value */}
          <div className="flex items-baseline gap-1 mb-3">
            <span
              className={`text-4xl font-black ${c.accent} leading-none`}
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {animatedValue}
            </span>
            {unit && (
              <span className="text-sm font-bold text-gray-500 ml-0.5">{unit}</span>
            )}
          </div>

          {/* Trend + Sparkline row */}
          <div className="flex items-center justify-between">
            {trend !== undefined ? (
              <TrendArrow value={trend} invert={invertTrend} />
            ) : (
              <span className="text-xs text-gray-600">—</span>
            )}
          </div>
        </div>

        {/* Icon */}
        <div className={`shrink-0 p-2.5 rounded-xl ${c.iconBg}`}>
          <div className={`w-6 h-6 ${c.accent}`}>{icon}</div>
        </div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <Sparkline data={sparkData} color={c.accent.replace('text-', '#').replace('amber', 'f59e0b').replace('emerald', '10b981').replace('red', 'ef4444').replace('blue', '3b82f6')} />
        </div>
      )}
    </div>
  );
}

// ─── Pulsing Dot Component ───────────────────────────────────────────────────
// ⚡ Bolt Performance Optimization:
// Extracted high-frequency state update (setInterval pulse) into a dedicated leaf component.
// This prevents the entire <SafetyStatusBanner> from needlessly re-rendering every 1.2s.
function PulsingDot({ dotColor }: { dotColor: string }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <div
        className={`absolute w-4 h-4 rounded-full ${dotColor} ${pulse ? 'opacity-100' : 'opacity-30'}`}
        style={{
          animation: pulse ? 'ping 1.2s cubic-bezier(0,0,0.2,1)' : 'none',
          boxShadow: `0 0 0 0 ${dotColor.replace('bg-', 'rgba(').replace('400)', ',0.5)')}`,
        }}
      />
      <div className={`relative w-3 h-3 rounded-full ${dotColor}`} />
    </div>
  );
}

// ─── Safety Status Banner ────────────────────────────────────────────────────
function SafetyStatusBanner({ status = 'GREEN', lastCheck = '02:29 GMT' }: { status?: 'GREEN' | 'AMBER' | 'RED'; lastCheck?: string }) {
  const statusConfig = {
    GREEN: {
      label: 'SITE STATUS: SAFE',
      color: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      stripeColor: 'rgba(16, 185, 129, 0.15)',
      glow: 'shadow-emerald-500/20',
    },
    AMBER: {
      label: 'SITE STATUS: AMBER ALERT',
      color: 'text-amber-400',
      dotColor: 'bg-amber-400',
      stripeColor: 'rgba(245, 158, 11, 0.15)',
      glow: 'shadow-amber-500/20',
    },
    RED: {
      label: 'SITE STATUS: RED ALERT',
      color: 'text-red-400',
      dotColor: 'bg-red-400',
      stripeColor: 'rgba(239, 68, 68, 0.15)',
      glow: 'shadow-red-500/20',
    },
  };

  const cfg = statusConfig[status];

  return (
    <div
      className={`relative rounded-2xl border border-gray-800 overflow-hidden ${cfg.glow}`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Hazard stripe background */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            ${cfg.stripeColor},
            ${cfg.stripeColor} 10px,
            transparent 10px,
            transparent 20px
          )`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/95 to-gray-900/80" />

      {/* Content */}
      <div className="relative flex items-center justify-between px-6 py-4 md:px-8">
        {/* Left: Status */}
        <div className="flex items-center gap-4">
          {/* Pulsing indicator */}
          <PulsingDot dotColor={cfg.dotColor} />

          <h2
            className={`text-lg md:text-xl font-black tracking-widest ${cfg.color}`}
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {cfg.label}
          </h2>
        </div>

        {/* Right: Last check */}
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Last Safety Check</p>
          <p className="text-sm font-bold text-gray-300">{lastCheck}</p>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── 7-Day Incident Trend Chart ──────────────────────────────────────────────
interface DayData { day: string; incidents: number; observations: number; }

function IncidentTrendChart({ data }: { data: DayData[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; day: string } | null>(null);

  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.incidents)) || 5;
  const width = 560;
  const height = 120;
  const barWidth = Math.floor((width - 60) / data.length) - 8;
  const chartWidth = width - 60;
  const chartHeight = height - 30;
  const avg = data.reduce((s, d) => s + d.incidents, 0) / data.length;
  const avgY = chartHeight - (avg / max) * chartHeight + 10;

  return (
    <div className="relative" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <svg
        viewBox={`0 0 ${width} ${height + 10}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Average line */}
        <line
          x1="30" y1={avgY} x2={width - 10} y2={avgY}
          stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
        />
        <text x={width - 8} y={avgY - 3} fill="#f59e0b" fontSize="8" textAnchor="end" opacity="0.6">
          AVG {avg.toFixed(1)}
        </text>

        {/* Bars */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.incidents / max) * chartHeight);
          const x = 30 + i * (chartWidth / data.length) + 4;
          const y = chartHeight - barH + 10;
          const isHovered = tooltip?.day === d.day;

          return (
            <g key={d.day}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="3"
                fill={isHovered ? '#fbbf24' : '#f59e0b'}
                opacity={isHovered ? 1 : 0.75}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={(e) => {
                  const _rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ day: d.day, value: d.incidents, x: x + barWidth / 2, y: y - 5 });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Day label */}
              <text
                x={x + barWidth / 2}
                y={height}
                fill="#6b7280"
                fontSize="9"
                textAnchor="middle"
              >
                {d.day}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 20}
              y={tooltip.y - 22}
              width="40"
              height="18"
              rx="4"
              fill="#1f2937"
              stroke="#374151"
              strokeWidth="1"
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 9}
              fill="#f59e0b"
              fontSize="10"
              textAnchor="middle"
              fontWeight="bold"
            >
              {tooltip.value}
            </text>
          </g>
        )}
      </svg>

      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[9px] text-gray-600 uppercase tracking-wider">7-Day Incident Trend</span>
        <span className="text-[9px] text-amber-500/60 font-bold">▲ Incidents · Avg {avg.toFixed(1)}/day</span>
      </div>
    </div>
  );
}

// ─── Compliance Gauge ────────────────────────────────────────────────────────
function ComplianceGauge({ value, label }: { value: number; label: string }) {
  const [animated, setAnimated] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;
    const start = performance.now();
    const dur = 1600;
    const target = value;

    const step = (ts: number) => {
      const elapsed = ts - start;
      const progress = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setHasAnimated(true);
      }
    };

    const timer = setTimeout(() => requestAnimationFrame(step), 200);
    return () => clearTimeout(timer);
  }, [value, hasAnimated]);

  // Arc math
  const size = 160;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = 60;
  const startAngle = 200; // degrees
  const endAngle = 340;
  const totalAngle = endAngle - startAngle;
  const valueAngle = startAngle + (animated / 100) * totalAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (start: number, end: number, radius: number) => {
    const x1 = cx + radius * Math.cos(toRad(start));
    const y1 = cy + radius * Math.sin(toRad(start));
    const x2 = cx + radius * Math.cos(toRad(end));
    const y2 = cy + radius * Math.sin(toRad(end));
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const dotPath = (angle: number, radius: number) => {
    const x = cx + radius * Math.cos(toRad(angle));
    const y = cy + radius * Math.sin(toRad(angle));
    return { x, y };
  };

  const dot = dotPath(valueAngle, r);

  const zoneColor = value >= 90 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444';
  const zoneLabel = value >= 90 ? 'Good' : value >= 70 ? 'Caution' : 'Critical';

  return (
    <div className="flex flex-col items-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.7}`}>
        {/* Background track */}
        <path
          d={arcPath(startAngle, endAngle, r)}
          fill="none"
          stroke="#1f2937"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Colored zones */}
        <path d={arcPath(startAngle, startAngle + 0.3 * totalAngle, r)} fill="none" stroke="#10b981" strokeWidth="10" strokeLinecap="round" opacity="0.3" />
        <path d={arcPath(startAngle + 0.3 * totalAngle, startAngle + 0.7 * totalAngle, r)} fill="none" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" opacity="0.3" />
        <path d={arcPath(startAngle + 0.7 * totalAngle, endAngle, r)} fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.3" />

        {/* Value arc */}
        <path
          d={arcPath(startAngle, valueAngle, r)}
          fill="none"
          stroke={zoneColor}
          strokeWidth="10"
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 4px ${zoneColor}60)`,
          }}
        />

        {/* Needle dot */}
        <circle cx={dot.x} cy={dot.y} r="5" fill={zoneColor} style={{ filter: `drop-shadow(0 0 6px ${zoneColor})` }} />
        <circle cx={dot.x} cy={dot.y} r="2.5" fill="#0d1117" />

        {/* Center value */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#f59e0b" fontSize="24" fontWeight="900" style={{ fontFamily: "'Syne', sans-serif" }}>
          {animated}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#6b7280" fontSize="9" fontWeight="bold">
          {label}
        </text>
      </svg>

      {/* Status below gauge */}
      <div className="flex items-center gap-2 mt-1">
        <div className={`w-2 h-2 rounded-full ${value >= 90 ? 'bg-emerald-400' : value >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ boxShadow: `0 0 6px ${zoneColor}` }} />
        <span className={`text-xs font-bold ${value >= 90 ? 'text-emerald-400' : value >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
          {zoneLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export interface SafetyStatsData {
  daysSinceIncident: number;
  activeRAMS: number;
  openObservations: number;
  nearMissReports: number;
  ppeCompliance: number;
  inspectionsPassed: number;
  siteStatus: 'GREEN' | 'AMBER' | 'RED';
  lastCheck: string;
  incidentTrend: DayData[];
  daysSinceSpark: number[];
  ramsSpark: number[];
  observationsSpark: number[];
  nearMissSpark: number[];
  ppeSpark: number[];
  inspectionsSpark: number[];
}

export function SafetyStatsPanel({ data }: { data: SafetyStatsData }) {
  const cards: StatCardProps[] = [
    {
      label: 'Days Since Last Incident',
      value: data.daysSinceIncident,
      icon: <Shield className="w-6 h-6" />,
      color: 'green',
      trend: 12,
      sparkData: data.daysSinceSpark,
      delay: 0,
    },
    {
      label: 'Active RAMS Documents',
      value: data.activeRAMS,
      icon: <FileText className="w-6 h-6" />,
      color: 'blue',
      trend: 3,
      sparkData: data.ramsSpark,
      delay: 100,
    },
    {
      label: 'Open Safety Observations',
      value: data.openObservations,
      icon: <Eye className="w-6 h-6" />,
      color: 'amber',
      trend: -8,
      sparkData: data.observationsSpark,
      invertTrend: true,
      delay: 200,
    },
    {
      label: 'Near-Miss Reports',
      value: data.nearMissReports,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'red',
      trend: -15,
      sparkData: data.nearMissSpark,
      invertTrend: true,
      delay: 300,
    },
    {
      label: 'PPE Compliance',
      value: data.ppeCompliance,
      unit: '%',
      icon: <HardHat className="w-6 h-6" />,
      color: 'green',
      trend: 2,
      sparkData: data.ppeSpark,
      delay: 400,
      isPercentage: true,
    },
    {
      label: 'Inspections Passed',
      value: data.inspectionsPassed,
      unit: '%',
      icon: <ClipboardCheck className="w-6 h-6" />,
      color: 'green',
      trend: 5,
      sparkData: data.inspectionsSpark,
      delay: 500,
      isPercentage: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <SafetyStatusBanner status={data.siteStatus} lastCheck={data.lastCheck} />

      {/* 2-Column Layout: Stats + Gauge/Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stat Cards (2 columns) */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {cards.map(card => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        {/* Right: Gauge + Mini Chart */}
        <div className="flex flex-col gap-4">
          {/* PPE Compliance Gauge */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 flex flex-col items-center">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">PPE Compliance</p>
            <ComplianceGauge value={data.ppeCompliance} label="PPF" />
          </div>

          {/* 7-Day Trend */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">7-Day Overview</p>
            <IncidentTrendChart data={data.incidentTrend} />
          </div>
        </div>
      </div>
    </div>
  );
}
