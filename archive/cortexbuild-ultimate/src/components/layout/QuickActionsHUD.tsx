/**
 * CortexBuild Ultimate — Quick Actions HUD
 * Floating radial action menu — press + anywhere to reveal
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, FolderPlus, FileText, AlertTriangle, ClipboardList,
  HardHat, Users, X,
} from 'lucide-react';
interface QuickAction {
  id: string;
  label: string;
  icon: React.FC<{ style?: React.CSSProperties }>;
  accent: string;
  module: string;
}

const ACTIONS: QuickAction[] = [
  { id: 'project',    label: 'New Project',           icon: FolderPlus,     accent: '#f59e0b', module: 'projects' },
  { id: 'invoice',    label: 'New Invoice',            icon: FileText,       accent: '#3b82f6', module: 'invoicing' },
  { id: 'safety',    label: 'Log Incident',          icon: AlertTriangle,  accent: '#ef4444', module: 'safety' },
  { id: 'task',      label: 'New Task',               icon: ClipboardList,  accent: '#10b981', module: 'projects' },
  { id: 'rfi',       label: 'Raise RFI',               icon: HardHat,       accent: '#f59e0b', module: 'rfis' },
  { id: 'team',      label: 'Add Team Member',         icon: Users,         accent: '#3b82f6', module: 'teams' },
];

const RADIUS = 110;

function getPosition(index: number, total: number) {
  // Arc from -135° to +135° (upper semi-circle, slightly wider)
  const startAngle = -135;
  const endAngle = 135;
  const angleDeg = startAngle + (index / Math.max(total - 1, 1)) * (endAngle - startAngle);
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.cos(angleRad) * RADIUS,
    y: Math.sin(angleRad) * RADIUS,
    angle: angleRad,
  };
}

export function QuickActionsHUD({ currentModule: _currentModule, onAction }: { currentModule: string; onAction: (module: string) => void }) {
  const [open, setOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    setOpen(true);
    setAnimating(true);
  };

  const handleClose = useCallback(() => {
    setAnimating(false);
    setTimeout(() => setOpen(false), 200);
  }, []);

  const handleAction = useCallback((action: QuickAction) => {
    handleClose();
    onAction(action.module);
  }, [handleClose, onAction]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setAnimating(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Global + key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '+' || (e.key === '=' && !e.shiftKey)) return;
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAction(ACTIONS[0]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleAction]);

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        title="Quick Actions (+)"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 200,
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(245,158,11,0.4), 0 0 0 1px rgba(245,158,11,0.3)',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s',
          transform: 'scale(1)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(245,158,11,0.5), 0 0 0 1px rgba(245,158,11,0.4)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.4), 0 0 0 1px rgba(245,158,11,0.3)';
        }}
      >
        <Plus
          style={{
            width: '22px',
            height: '22px',
            color: '#080b12',
            strokeWidth: 2.5,
          }}
        />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 199,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeInQuick 0.15s ease forwards',
        }}
      />

      {/* Radial menu */}
      <div
        style={{
          position: 'fixed',
          bottom: '50px',
          right: '50px',
          zIndex: 201,
          width: '1px',
          height: '1px',
          transformOrigin: 'bottom right',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: `${RADIUS * 2 + 120}px`,
            height: `${RADIUS + 120}px`,
          }}
        >
          {/* Centre button (close) */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(245,158,11,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              animation: animating ? 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              zIndex: 2,
            }}
          >
            <X style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
          </button>

          {/* Action items */}
          {ACTIONS.map((action, i) => {
            const { x, y, angle } = getPosition(i, ACTIONS.length);
            const posX = x + 60;
            const posY = y + 14;

            return (
              <div
                key={action.id}
                style={{
                  position: 'absolute',
                  bottom: `${-posY}px`,
                  right: `${-posX}px`,
                  animation: animating
                    ? `radialIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 35}ms both`
                    : 'none',
                  transformOrigin: 'bottom right',
                  zIndex: 1,
                }}
              >
                {/* Label pill above icon */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '52px',
                    right: '50%',
                    transform: `translateX(50%) rotate(${-angle}rad)`,
                    whiteSpace: 'nowrap',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#e2e8f0',
                    background: 'rgba(15,23,42,0.95)',
                    border: `1px solid ${action.accent}30`,
                    borderRadius: '6px',
                    padding: '3px 8px',
                    pointerEvents: 'none',
                    opacity: animating ? 1 : 0,
                    transition: `opacity 0.15s ${i * 35 + 100}ms`,
                  }}
                >
                  {action.label}
                </div>

                {/* Icon button */}
                <button
                  onClick={() => handleAction(action)}
                  title={action.label}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${action.accent}25, ${action.accent}10)`,
                    border: `1px solid ${action.accent}40`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: `0 2px 12px ${action.accent}20`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.boxShadow = `0 4px 20px ${action.accent}40`;
                    e.currentTarget.style.borderColor = `${action.accent}80`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = `0 2px 12px ${action.accent}20`;
                    e.currentTarget.style.borderColor = `${action.accent}40`;
                  }}
                >
                  <action.icon style={{ width: '18px', height: '18px', color: action.accent }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeInQuick {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes radialIn {
          from { transform: scale(0) rotate(-20deg); opacity: 0; }
          to { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </>
  );
}
