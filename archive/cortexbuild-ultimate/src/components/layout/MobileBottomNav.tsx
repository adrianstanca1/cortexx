/**
 * CortexBuild Ultimate — Mobile-Optimized Bottom Navigation
 * Full-featured PWA navigation with gestures, quick actions, and responsive behavior
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  AlertTriangle,
  MoreHorizontal,
  Plus,
  FileText,
  MessageSquare,
  Camera,
  X,
  Bell,
  Menu,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { type Module } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { hapticImpact } from '../../lib/native/haptics';

// ── Types ──────────────────────────────────────────────────────────────────────
interface NavItem {
  module: Module;
  icon: LucideIcon;
  label: string;
  accent: string;
  badge?: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  onClick: () => void;
}

interface MobileBottomNavProps {
  activeModule: Module;
  onModuleChange: (module: Module) => void;
  onMenuToggle?: () => void;
  notificationCount?: number;
  userInitials?: string;
  onRefresh?: () => Promise<void>;
}

// ── Navigation Items ───────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { module: 'dashboard', icon: LayoutDashboard, label: 'Home', accent: '#f59e0b' },
  { module: 'projects', icon: FolderOpen, label: 'Projects', accent: '#f59e0b' },
  { module: 'safety', icon: AlertTriangle, label: 'Safety', accent: '#ef4444' },
  { module: 'documents', icon: FileText, label: 'Docs', accent: '#3b82f6' },
  { module: 'settings', icon: MoreHorizontal, label: 'More', accent: '#64748b' },
];

// ── Module Accent Colors ───────────────────────────────────────────────────────
const MODULE_ACCENTS: Partial<Record<Module, string>> = {
  dashboard: '#f59e0b',
  projects: '#f59e0b',
  safety: '#ef4444',
  documents: '#3b82f6',
  settings: '#64748b',
  invoicing: '#10b981',
  accounting: '#10b981',
  'financial-reports': '#10b981',
  'ai-assistant': '#f59e0b',
  analytics: '#3b82f6',
  'risk-register': '#ef4444',
  rams: '#ef4444',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function MobileBottomNav({
  activeModule,
  onModuleChange,
  onMenuToggle,
  notificationCount = 0,
  userInitials = 'AS',
  onRefresh,
}: MobileBottomNavProps) {
  const isMobile = useIsMobile(768);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const headerVisibleRef = useRef(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    module?: Module;
  }>({ visible: false, x: 0, y: 0 });
  const [touchStartY, setTouchStartY] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get accent color for active module
  const accentColor = MODULE_ACCENTS[activeModule] || '#f59e0b';

  // ── Scroll-based header visibility ───────────────────────────────────────────
  // ⚡ Bolt Performance Optimization:
  // Replaced lastScrollY useState with useRef.
  // Storing high-frequency scroll positions in React state causes layout-wide
  // re-renders on every scroll tick. Using useRef prevents this while still
  // allowing us to calculate scroll direction. headerVisible state is only
  // updated when it actually needs to toggle, saving ~60 renders per second during scroll.
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Determine if header should be hidden
      const shouldHide = currentScrollY > lastScrollY.current && currentScrollY > 100;

      // Only trigger a React state update if the visibility actually changes
      if (shouldHide && headerVisibleRef.current) {
        headerVisibleRef.current = false;
        setHeaderVisible(false);
      } else if (!shouldHide && !headerVisibleRef.current) {
        headerVisibleRef.current = true;
        setHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Pull to refresh handlers ─────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartY > 0 && window.scrollY === 0) {
      const deltaY = e.touches[0].clientY - touchStartY;
      if (deltaY > 0) {
        setPullDistance(Math.min(deltaY, 150));
      }
    }
  }, [touchStartY]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 100 && onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    setTouchStartY(0);
  }, [pullDistance, onRefresh]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ── Swipe gesture support ────────────────────────────────────────────────────
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    setSwipeStartX(e.touches[0].clientX);
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const swipeEndX = e.changedTouches[0].clientX;
    const diff = swipeEndX - swipeStartX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      const currentIndex = NAV_ITEMS.findIndex(item => item.module === activeModule);
      if (diff > 0 && currentIndex > 0) {
        // Swipe right - go to previous
        onModuleChange(NAV_ITEMS[currentIndex - 1].module);
      } else if (diff < 0 && currentIndex < NAV_ITEMS.length - 1) {
        // Swipe left - go to next
        onModuleChange(NAV_ITEMS[currentIndex + 1].module);
      }
    }
  }, [swipeStartX, activeModule, onModuleChange]);

  // ── Long press for context menu ──────────────────────────────────────────────
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = useCallback((e: React.TouchEvent | React.MouseEvent, module: Module) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        module,
      });
      void hapticImpact('medium');
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // ── Quick Actions ────────────────────────────────────────────────────────────
  const quickActions: QuickAction[] = [
    {
      id: 'task',
      label: 'Task',
      icon: CheckSquare,
      accent: '#3b82f6',
      onClick: () => {
        setQuickActionsOpen(false);
        void hapticImpact('light');
      },
    },
    {
      id: 'rfi',
      label: 'RFI',
      icon: MessageSquare,
      accent: '#f59e0b',
      onClick: () => {
        setQuickActionsOpen(false);
        void hapticImpact('light');
      },
    },
    {
      id: 'incident',
      label: 'Incident',
      icon: AlertTriangle,
      accent: '#ef4444',
      onClick: () => {
        setQuickActionsOpen(false);
        void hapticImpact('light');
      },
    },
    {
      id: 'document',
      label: 'Document',
      icon: FileText,
      accent: '#10b981',
      onClick: () => {
        setQuickActionsOpen(false);
        void hapticImpact('light');
      },
    },
    {
      id: 'photo',
      label: 'Photo',
      icon: Camera,
      accent: '#8b5cf6',
      onClick: () => {
        setQuickActionsOpen(false);
        void hapticImpact('light');
      },
    },
  ];

  // ── Close context menu on outside click ──────────────────────────────────────
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      document.addEventListener('touchstart', handleClick);
    }
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [contextMenu.visible]);

  // ── Hide on desktop ──────────────────────────────────────────────────────────
  if (!isMobile) {
    return null;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={contentRef}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
      style={{
        position: 'relative',
        /* In MobileShell this sits after <main> in a flex column; min-height 100vh
           forced the scrollable main area to collapse to zero (fixed chrome only). */
        flexShrink: 0,
        minHeight: 0,
        height: 0,
        overflow: 'visible',
      }}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div
          style={{
            position: 'fixed',
            top: -60 + pullDistance,
            left: 0,
            right: 0,
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            transition: 'top 0.2s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: accentColor,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {isRefreshing ? (
              <>
                <svg
                  style={{
                    width: '18px',
                    height: '18px',
                    animation: 'spin 1s linear infinite',
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <ChevronUp size={18} />
                Release to refresh
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(180deg, rgba(17,24,39,0.98) 0%, rgba(13,17,23,0.95) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          zIndex: 40,
          transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: `calc(56px + env(safe-area-inset-top, 0px))`,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent 0%, ${accentColor}60 20%, ${accentColor} 50%, ${accentColor}60 80%, transparent 100%)`,
            opacity: 0.8,
          }}
        />

        {/* Hamburger menu */}
        <button
          onClick={onMenuToggle}
          aria-label="Open menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            color: '#64748b',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onTouchStart={() => handleLongPressStart({ currentTarget: { getBoundingClientRect: () => ({ left: 16, top: 56, width: 36, height: 36 }) } } as React.TouchEvent, 'dashboard')}
          onTouchEnd={handleLongPressEnd}
        >
          <Menu size={18} />
        </button>

        {/* Module label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '15px',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeModule.charAt(0).toUpperCase() + activeModule.slice(1).replace(/-/g, ' ')}
          </div>
        </div>

        {/* Notification bell */}
        <button
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                background: '#ef4444',
                border: '2px solid #0d1117',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '9px',
                fontWeight: 700,
                color: '#fff',
                padding: '0 4px',
              }}
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Syne', sans-serif",
            fontSize: '10px',
            fontWeight: 800,
            color: '#1e1b16',
            flexShrink: 0,
            boxShadow: `0 0 8px ${accentColor}50`,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {userInitials}
        </div>
      </header>

      {/* Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'linear-gradient(180deg, rgba(13,17,23,0.98) 0%, rgba(8,11,18,0.99) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.05) inset',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Top accent line */}
        <div
          style={{
            height: '1px',
            background: `linear-gradient(90deg, transparent 0%, ${accentColor}40 50%, transparent 100%)`,
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
            paddingTop: '8px',
            paddingBottom: '8px',
          }}
        >
          {NAV_ITEMS.map((item, _index) => {
            const Icon = item.icon;
            const isActive = activeModule === item.module;
            return (
              <button
                key={item.module}
                onClick={() => {
                  onModuleChange(item.module);
                  void hapticImpact('light');
                }}
                onTouchStart={(e) => handleLongPressStart(e, item.module)}
                onTouchEnd={handleLongPressEnd}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  minWidth: '60px',
                  touchAction: 'manipulation',
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '24px',
                      height: '2px',
                      borderRadius: '0 0 2px 2px',
                      background: item.accent,
                      boxShadow: `0 0 8px ${item.accent}80`,
                      transition: 'all 0.2s',
                    }}
                  />
                )}

                {/* Icon */}
                <Icon
                  size={22}
                  style={{
                    color: isActive ? item.accent : '#475569',
                    transition: 'all 0.2s',
                    filter: isActive ? `drop-shadow(0 0 6px ${item.accent}60)` : 'none',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  }}
                />

                {/* Label */}
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '10px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? item.accent : '#475569',
                    letterSpacing: '0.02em',
                    transition: 'color 0.2s',
                  }}
                >
                  {item.label}
                </span>

                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '12px',
                      minWidth: '14px',
                      height: '14px',
                      borderRadius: '7px',
                      background: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '8px',
                      fontWeight: 700,
                      color: '#fff',
                      border: '2px solid #0d1117',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button (FAB) */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
          right: '16px',
          zIndex: 45,
        }}
      >
        {/* Quick Actions Menu */}
        {quickActionsOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              right: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'slideInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {quickActions.map((action, index) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  aria-label={`Quick action: ${action.label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: 'rgba(13,17,23,0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    border: `1px solid ${action.accent}40`,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    transition: 'all 0.15s',
                    animation: `fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`,
                  }}
                  onTouchStart={() => {
                    void hapticImpact('light');
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: `${action.accent}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ActionIcon size={18} style={{ color: action.accent }} />
                  </div>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#f1f5f9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* FAB Button */}
        <button
          onClick={() => {
            setQuickActionsOpen(prev => !prev);
            void hapticImpact('light');
          }}
          aria-label="Quick actions"
          aria-expanded={quickActionsOpen}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '26px',
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 20px ${accentColor}60, 0 0 0 2px rgba(255,255,255,0.1)`,
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: quickActionsOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          <Plus size={24} strokeWidth={2.5} style={{ color: '#1e1b16' }} />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            transform: 'translate(-50%, -100%)',
            zIndex: 100,
            background: 'rgba(13,17,23,0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '8px',
            minWidth: '160px',
            animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (contextMenu.module) {
                onModuleChange(contextMenu.module);
              }
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              width: '100%',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <LayoutDashboard size={16} style={{ color: '#64748b' }} />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                color: '#f1f5f9',
              }}
            >
              Go to module
            </span>
          </button>
          <button
            onClick={() => {
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              width: '100%',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <X size={16} style={{ color: '#64748b' }} />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                color: '#f1f5f9',
              }}
            >
              Cancel
            </span>
          </button>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) scale(1);
          }
        }
        
      `}</style>
    </div>
  );
}
