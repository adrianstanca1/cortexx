/**
 * CortexBuild Ultimate — Mobile Navigation Bar
 * Amber-accented bottom nav with construction feel
 */
import {
  LayoutDashboard, FolderOpen, FileText, AlertTriangle, HardHat,
} from 'lucide-react';
import { type Module } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

interface MobileNavProps {
  activeModule: Module;
  setModule: (m: Module) => void;
}

const MOBILE_NAV_ITEMS: {
  module: Module;
  icon: React.FC<{ style?: React.CSSProperties }>;
  label: string;
  accent: string;
}[] = [
  { module: 'dashboard', icon: LayoutDashboard, label: 'Home',    accent: '#f59e0b' },
  { module: 'projects',  icon: FolderOpen,     label: 'Projects', accent: '#f59e0b' },
  { module: 'invoicing', icon: FileText,       label: 'Finance',  accent: '#3b82f6' },
  { module: 'safety',    icon: AlertTriangle,   label: 'Safety',   accent: '#ef4444' },
  { module: 'ai-assistant', icon: HardHat,      label: 'AI',      accent: '#f59e0b' },
];

export function MobileNav({ activeModule, setModule }: MobileNavProps) {
  const isMobile = useIsMobile(768);
  if (!isMobile) return null;
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'linear-gradient(180deg, rgba(13,17,23,0.95) 0%, rgba(8,11,18,0.98) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.3) 50%, transparent 100%)',
          marginBottom: '0',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          minHeight: '56px',
          paddingTop: '4px',
        }}
      >
        {MOBILE_NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeModule === item.module;
          return (
            <button
              key={item.module}
              onClick={() => setModule(item.module)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '8px 14px',
                minHeight: '48px',
                minWidth: '48px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s',
              }}
            >
              {/* Active dot indicator */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '20px',
                    height: '2px',
                    borderRadius: '0 0 2px 2px',
                    background: item.accent,
                    boxShadow: `0 0 6px ${item.accent}`,
                  }}
                />
              )}
              <Icon
                style={{
                  width: '20px',
                  height: '20px',
                  color: isActive ? item.accent : '#475569',
                  transition: 'color 0.2s',
                  filter: isActive ? `drop-shadow(0 0 4px ${item.accent}80)` : 'none',
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? item.accent : '#475569',
                  letterSpacing: '0.02em',
                  transition: 'color 0.2s',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
