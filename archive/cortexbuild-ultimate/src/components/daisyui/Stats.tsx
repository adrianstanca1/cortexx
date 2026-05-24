import React from 'react';

interface StatItem {
  title: string;
  value: string | number;
  desc?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  progress?: number;
  color?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'info' | 'success' | 'warning' | 'error';
}

interface StatsProps {
  stats: StatItem[];
  direction?: 'row' | 'col';
  className?: string;
}

export const Stats: React.FC<StatsProps> = ({
  stats,
  direction = 'row',
  className = '',
}) => {
  return (
    <div className={`stats shadow ${direction === 'col' ? 'stats-vertical' : 'stats-horizontal'} ${className}`}>
      {stats.map((stat, index) => (
        <div key={index} className="stat">
          {stat.icon && <div className={`stat-figure text-${stat.color || 'primary'}`}>{stat.icon}</div>}
          <div className="stat-title">{stat.title}</div>
          <div className={`stat-value text-${stat.color || 'primary'}`}>{stat.value}</div>
          {stat.desc && <div className="stat-desc">{stat.desc}</div>}
          {stat.progress !== undefined && (
            <progress className="progress progress-primary w-full" value={stat.progress} max="100"></progress>
          )}
          {stat.actions && <div className="stat-actions">{stat.actions}</div>}
        </div>
      ))}
    </div>
  );
};
