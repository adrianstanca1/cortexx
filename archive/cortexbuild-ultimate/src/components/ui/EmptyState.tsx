import { LucideIcon, Construction, Search, FileX, AlertTriangle, FolderOpen, Users, Shield } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'projects' | 'search' | 'documents' | 'safety' | 'team' | 'error';
}

function EmptyIllustration({ variant }: { variant: EmptyStateProps['variant'] }) {
  const iconMap = {
    default: Construction,
    projects: FolderOpen,
    search: Search,
    documents: FileX,
    safety: Shield,
    team: Users,
    error: AlertTriangle,
  };
  const Icon = iconMap[variant || 'default'];

  return (
    <div className="relative mb-6">
      {/* Outer ring */}
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
          border: '1px solid rgba(245,158,11,0.15)',
        }}
      >
        {/* Middle ring - spinning slowly */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            border: '1px dashed rgba(245,158,11,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'spin 20s linear infinite',
          }}
        >
          {/* Inner circle */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(30,41,59,0.6)',
              border: '1px solid rgba(245,158,11,0.25)',
              boxShadow: '0 0 20px rgba(245,158,11,0.08)',
            }}
          >
            <Icon
              className="w-9 h-9"
              style={{ color: 'rgba(245,158,11,0.5)' }}
            />
          </div>
        </div>
      </div>

      {/* Decorative corner brackets */}
      {[
        { top: '-4px', left: '-4px', rotate: '0deg' },
        { top: '-4px', right: '-4px', rotate: '90deg' },
        { bottom: '-4px', left: '-4px', rotate: '-90deg' },
        { bottom: '-4px', right: '-4px', rotate: '180deg' },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: '12px',
            height: '12px',
            borderTop: '2px solid rgba(245,158,11,0.4)',
            borderLeft: '2px solid rgba(245,158,11,0.4)',
            borderRadius: '2px 0 0 0',
            transform: `rotate(${pos.rotate})`,
          }}
        />
      ))}

      {/* Floating particles */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'rgba(245,158,11,0.3)',
            top: `${20 + i * 25}%`,
            left: i % 2 === 0 ? '-12px' : 'calc(100% + 8px)',
            animation: `emptyPulse ${2 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: _icon,
  title,
  description,
  action,
  className = '',
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
      style={{
        animation: 'fadeScaleIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
      }}
    >
      <EmptyIllustration variant={variant} />

      <h3
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: '16px',
          fontWeight: 700,
          color: '#e2e8f0',
          marginBottom: '6px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: '#64748b',
            maxWidth: '320px',
            lineHeight: 1.5,
            marginBottom: '16px',
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn btn-press mt-1 px-5 py-2.5 text-sm font-medium rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            fontFamily: "'DM Sans', sans-serif",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.15))';
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))';
            e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
