/**
 * Command Palette Component
 * Quick actions and navigation with Ctrl+K / Cmd+K
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Search,
  Command,
  X,
  ArrowRight,
  FileText,
  Settings,
  Users,
  Briefcase,
  AlertTriangle,
  TrendingUp,
  LayoutDashboard,
  Calculator,
  ShoppingCart,
  ShieldCheck,
  Receipt,
  Hammer,
  MapPin,
  Layers,
  MessageSquare,
  ClipboardCheck,
  Triangle,
  FileStack,
  Building2,
  FileBarChart,
  Store,
  Bell,
  Eye,
  Mail,
  Lock,
  Construction,
  Clock,
  Bot,
  Activity,
  HardHat,
  GitPullRequest,
  CheckSquare,
  FileSearch,
  Package,
  ClipboardList,
  FolderOpen,
  Ruler,
  DollarSign,
  Coins,
  FileEdit,
  Upload,
  Box,
  GraduationCap,
  Award,
  Leaf,
  Trash2,
  Signpost,
  BarChart3,
  Brain,
  PieChart,
  BadgeCheck,
  Building,
  BookOpen,
  Webhook,
  LeafyGreen,
  UserCircle,
  CalendarDays,
  Sparkles,
  Truck,
} from 'lucide-react';
import { type Module } from '../../types';

interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  module?: Module;
  action?: () => void;
  shortcut?: string;
  category: 'navigation' | 'action' | 'settings';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: Module) => void;
}

/** Human-readable labels aligned with sidebar where possible */
const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  invoicing: 'Invoicing',
  accounting: 'Accounting',
  'financial-reports': 'Financial Reports',
  procurement: 'Procurement',
  rams: 'RAMS',
  cis: 'CIS Returns',
  'site-ops': 'Site Operations',
  teams: 'Teams & Labour',
  tenders: 'Tenders & Bids',
  analytics: 'Analytics & BI',
  safety: 'Safety & HSE',
  'field-view': 'Field View',
  crm: 'CRM & Clients',
  documents: 'Documents',
  timesheets: 'Timesheets',
  plant: 'Plant & Equipment',
  subcontractors: 'Subcontractors',
  'ai-assistant': 'AI Assistant',
  rfis: 'RFIs',
  'change-orders': 'Change Orders',
  'punch-list': 'Punch List',
  inspections: 'Inspections',
  'risk-register': 'Risk Register',
  drawings: 'Drawings & Plans',
  meetings: 'Meetings',
  materials: 'Materials',
  'daily-reports': 'Daily Reports',
  marketplace: 'AI Marketplace',
  settings: 'Settings',
  insights: 'AI Insights',
  notifications: 'Notifications',
  'executive-reports': 'Executive Reports',
  'predictive-analytics': 'Predictive Analytics',
  calendar: 'Calendar',
  search: 'Global Search',
  'audit-log': 'Audit Log',
  variations: 'Variations',
  defects: 'Defects',
  valuations: 'Valuations',
  specifications: 'Specifications',
  'temp-works': 'Temp Works',
  signage: 'Signage',
  'waste-management': 'Waste Management',
  sustainability: 'Sustainability',
  training: 'Training',
  certifications: 'Certifications',
  prequalification: 'Prequalification',
  lettings: 'Lettings',
  measuring: 'Measuring',
  'email-history': 'Email History',
  permissions: 'Permissions',
  'report-templates': 'Report Templates',
  'bim-viewer': 'BIM Viewer',
  'cost-management': 'Cost Management',
  'submittal-management': 'Submittals',
  'dev-sandbox': 'Dev Sandbox',
  'ai-vision': 'AI Vision',
  'my-desktop': 'My Desktop',
  'advanced-analytics': 'Advanced Analytics',
  'project-calendar': 'Project Calendar',
  'admin-dashboard': 'Admin Dashboard',
  'team-chat': 'Team Chat',
  'activity-feed': 'Activity Feed',
  'client-portal': 'Client Portal',
  webhooks: 'Webhooks',
  'carbon-estimating': 'Carbon Estimating',
  'site-inspections': 'Site Inspections',
  'permits': 'Permits & Licences',
  'bim-4d': 'BIM 4D',
  'billing': 'Billing',
  'maintenance-schedules': 'Maintenance Schedules',
  'project-templates': 'Project Templates',
  'settings-mfa': 'Two-Factor Auth',
  'api-keys': 'API Keys',
  'tasks': 'Tasks',
  'suppliers': 'Suppliers',
};

const MODULE_ICON_COMPONENTS: Partial<Record<Module, LucideIcon>> = {
  dashboard: LayoutDashboard,
  projects: FolderOpen,
  invoicing: FileText,
  accounting: Calculator,
  'financial-reports': PieChart,
  procurement: ShoppingCart,
  rams: ShieldCheck,
  cis: Receipt,
  'site-ops': Hammer,
  teams: Users,
  tenders: TrendingUp,
  analytics: BarChart3,
  safety: AlertTriangle,
  'field-view': MapPin,
  crm: Building2,
  documents: BookOpen,
  timesheets: Clock,
  plant: Hammer,
  subcontractors: UserCircle,
  'ai-assistant': Bot,
  rfis: HardHat,
  'change-orders': GitPullRequest,
  'punch-list': CheckSquare,
  inspections: ClipboardCheck,
  'risk-register': Triangle,
  drawings: Layers,
  meetings: MessageSquare,
  materials: Package,
  'daily-reports': ClipboardList,
  marketplace: Store,
  settings: Settings,
  insights: Brain,
  notifications: Bell,
  'executive-reports': FileBarChart,
  'predictive-analytics': TrendingUp,
  calendar: CalendarDays,
  search: Search,
  'audit-log': Eye,
  variations: FileEdit,
  defects: FileSearch,
  valuations: Coins,
  specifications: FileStack,
  'temp-works': Construction,
  signage: Signpost,
  'waste-management': Trash2,
  sustainability: Leaf,
  training: GraduationCap,
  certifications: Award,
  prequalification: BadgeCheck,
  lettings: Building,
  measuring: Ruler,
  'email-history': Mail,
  permissions: Lock,
  'report-templates': FileText,
  'bim-viewer': Box,
  'cost-management': DollarSign,
  'submittal-management': Upload,
  'dev-sandbox': Bot,
  'ai-vision': Eye,
  'my-desktop': LayoutDashboard,
  'advanced-analytics': BarChart3,
  'project-calendar': CalendarDays,
  'admin-dashboard': ShieldCheck,
  'team-chat': MessageSquare,
  'activity-feed': Activity,
  'client-portal': Briefcase,
  webhooks: Webhook,
  'carbon-estimating': LeafyGreen,
  'site-inspections': ClipboardCheck,
  'permits': ShieldCheck,
  'bim-4d': Layers,
  'tasks': ClipboardList,
  'suppliers': Truck,
};

const ICON_CLASS = 'w-4 h-4';

function moduleIcon(module: Module): React.ReactNode {
  const C = MODULE_ICON_COMPONENTS[module] ?? Command;
  return <C className={ICON_CLASS} />;
}

/** Stable order: overview → projects → finance → ops → safety → business → AI → collab */
const MODULE_NAV_ORDER: Module[] = [
  'dashboard',
  'analytics',
  'advanced-analytics',
  'project-calendar',
  'ai-assistant',
  'insights',
  'predictive-analytics',
  'projects',
  'site-ops',
  'daily-reports',
  'field-view',
  'drawings',
  'meetings',
  'tenders',
  'invoicing',
  'accounting',
  'financial-reports',
  'cis',
  'procurement',
  'change-orders',
  'variations',
  'valuations',
  'cost-management',
  'prequalification',
  'lettings',
  'teams',
  'timesheets',
  'subcontractors',
  'plant',
  'materials',
  'rfis',
  'bim-viewer',
  'submittal-management',
  'temp-works',
  'measuring',
  'safety',
  'site-inspections',
  'rams',
  'inspections',
  'punch-list',
  'risk-register',
  'documents',
  'defects',
  'specifications',
  'crm',
  'executive-reports',
  'marketplace',
  'calendar',
  'search',
  'audit-log',
  'email-history',
  'permissions',
  'report-templates',
  'admin-dashboard',
  'settings',
  'signage',
  'waste-management',
  'sustainability',
  'training',
  'certifications',
  'ai-vision',
  'dev-sandbox',
  'my-desktop',
  'team-chat',
  'activity-feed',
  'notifications',
  'client-portal',
  'webhooks',
  'carbon-estimating',
  'bim-4d',
];

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const commandItems: CommandItem[] = useMemo(
    () => [
      {
        id: 'ai-dash-brief',
        label: 'AI: Site brief (dashboard)',
        icon: <Sparkles className={ICON_CLASS} />,
        module: 'dashboard' as const,
        category: 'navigation' as const,
      },
      {
        id: 'ai-assistant-quick',
        label: 'AI Assistant — construction Q&A',
        icon: <Bot className={ICON_CLASS} />,
        module: 'ai-assistant' as const,
        category: 'navigation' as const,
      },
      {
        id: 'ai-insights-quick',
        label: 'AI Insights — trends & anomalies',
        icon: <Brain className={ICON_CLASS} />,
        module: 'insights' as const,
        category: 'navigation' as const,
      },
      {
        id: 'ai-predictive-quick',
        label: 'Predictive analytics — lookahead',
        icon: <TrendingUp className={ICON_CLASS} />,
        module: 'predictive-analytics' as const,
        category: 'navigation' as const,
      },
      {
        id: 'ai-marketplace-quick',
        label: 'AI Marketplace — connectors',
        icon: <Store className={ICON_CLASS} />,
        module: 'marketplace' as const,
        category: 'navigation' as const,
      },
      ...MODULE_NAV_ORDER.map(module => ({
        id: `nav-${module}`,
        label: MODULE_LABELS[module],
        icon: moduleIcon(module),
        module,
        category: 'navigation' as const,
      })),
      {
        id: 'action-new-project',
        label: 'Create New Project',
        icon: <Briefcase className={ICON_CLASS} />,
        action: () => onNavigate('projects'),
        category: 'action' as const,
      },
      {
        id: 'action-upload-doc',
        label: 'Upload Document',
        icon: <FileText className={ICON_CLASS} />,
        action: () => onNavigate('documents'),
        category: 'action' as const,
      },
      {
        id: 'settings-theme',
        label: 'Theme Settings',
        icon: <Settings className={ICON_CLASS} />,
        action: () => onNavigate('settings'),
        category: 'settings' as const,
        shortcut: 'T',
      },
    ],
    [onNavigate]
  );

  const filteredItems = commandItems.filter(
    item =>
      query === '' ||
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.id.toLowerCase().includes(query.toLowerCase())
  );

  const safeLen = Math.max(filteredItems.length, 1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % safeLen);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + safeLen) % safeLen);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = filteredItems[selectedIndex];
        if (selectedItem) {
          if (selectedItem.module) {
            onNavigate(selectedItem.module);
          } else if (selectedItem.action) {
            selectedItem.action();
          }
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onNavigate, onClose, safeLen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(i => (filteredItems.length === 0 ? 0 : Math.min(i, filteredItems.length - 1)));
  }, [query, filteredItems.length]);

  const handleItemClick = (item: CommandItem) => {
    if (item.module) {
      onNavigate(item.module);
    } else if (item.action) {
      item.action();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        background: 'rgba(9,11,15,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'fade-in 0.15s ease-out',
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Command palette"
    >
      {/* ── Blueprint panel ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%', maxWidth: '680px',
          margin: '0 16px',
          background: '#0e1117',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.06), inset 0 1px 0 rgba(245,158,11,0.1)',
          animation: 'scale-in 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
        data-allow-chrome-shortcuts
        onClick={e => e.stopPropagation()}
      >
        {/* Blueprint micro-grid bg */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: `linear-gradient(rgba(245,158,11,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.025) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />

        {/* Animated top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6) 30%, rgba(245,158,11,0.9) 50%, rgba(245,158,11,0.6) 70%, transparent)',
          animation: 'pulse-glow 3s ease-in-out infinite',
        }} />

        {/* Corner brackets */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}>
          <path d="M 0 14 L 0 0 L 14 0" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d="M 0 7 L 0 0 L 7 0" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
        </svg>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, pointerEvents: 'none' }}>
          <path d="M 28 14 L 28 0 L 14 0" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d="M 28 7 L 28 0 L 21 0" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
        </svg>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(245,158,11,0.08)',
          position: 'relative', zIndex: 1,
        }}>
          {/* Search icon with glow */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Search style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
            <div style={{
              position: 'absolute', inset: '-4px', borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)', filter: 'blur(4px)',
            }} />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to module or run action..."
            aria-label="Search commands"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: '15px', fontWeight: 400,
              color: '#e2e8f0',
              caretColor: '#f59e0b',
            }}
          />

          {query ? (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                width: '24px', height: '24px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#64748b', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; e.currentTarget.style.color = '#f59e0b'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X style={{ width: '13px', height: '13px' }} />
            </button>
          ) : (
            <div style={{
              fontFamily: "'Fira Code', monospace", fontSize: '10px',
              color: '#334155', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px', padding: '3px 8px', letterSpacing: '0.05em',
            }}>
              ESC
            </div>
          )}
        </div>

        {/* Results list */}
        <ul
          ref={listRef}
          style={{
            maxHeight: '420px', overflowY: 'auto', overflowX: 'hidden',
            padding: '8px 12px',
            position: 'relative', zIndex: 1,
          }}
          role="listbox"
          aria-label="Command suggestions"
        >
          {filteredItems.length === 0 ? (
            <li style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px',
                color: '#1e2738', letterSpacing: '0.1em', lineHeight: 1,
                marginBottom: '8px',
              }}>
                NO RESULTS
              </div>
              <div style={{ fontFamily: "'Fira Code', monospace", fontSize: '11px', color: '#334155' }}>
                No commands matching &quot;{query}&quot;
              </div>
            </li>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isNav = item.category === 'navigation';
              return (
                <li key={item.id} style={{ animation: `fade-in-up 0.2s ease-out ${index * 20}ms both` }}>
                  <button
                    onClick={() => handleItemClick(item)}
                    role="option"
                    aria-selected={isSelected}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                      padding: isSelected ? '10px 12px' : '9px 12px',
                      borderRadius: '10px', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                      background: isSelected
                        ? 'linear-gradient(90deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.06) 100%)'
                        : 'transparent',
                      color: isSelected ? '#f59e0b' : '#64748b',
                      transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.color = '#94a3b8';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#64748b';
                      }
                    }}
                  >
                    {/* Left indicator */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: '3px', height: '60%', borderRadius: '0 3px 3px 0',
                        background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.5)',
                      }} />
                    )}

                    {/* Icon */}
                    <span style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      background: isSelected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isSelected ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`,
                      color: isSelected ? '#f59e0b' : '#475569',
                      transition: 'all 0.15s',
                    }}>
                      {item.icon || <Command style={{ width: '14px', height: '14px' }} />}
                    </span>

                    {/* Label */}
                    <span style={{
                      flex: 1,
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontSize: '13px', fontWeight: isSelected ? 600 : 400,
                      letterSpacing: isSelected ? '0.02em' : '0',
                    }}>
                      {item.label}
                    </span>

                    {/* Category badge */}
                    <span style={{
                      fontFamily: "'Fira Code', monospace",
                      fontSize: '9px', fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: '4px',
                      background: isNav ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                      border: `1px solid ${isNav ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'}`,
                      color: isNav ? '#60a5fa' : '#34d399',
                      flexShrink: 0,
                    }}>
                      {item.category}
                    </span>

                    {/* Arrow indicator */}
                    {isSelected && (
                      <ArrowRight style={{ width: '14px', height: '14px', color: '#f59e0b', flexShrink: 0 }} />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid rgba(245,158,11,0.08)',
          background: 'rgba(0,0,0,0.2)',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {[
              { keys: '↑↓', label: 'navigate' },
              { keys: '↵', label: 'select' },
              { keys: 'ESC', label: 'close' },
            ].map(({ keys, label }) => (
              <span key={keys} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Fira Code', monospace", fontSize: '10px', color: '#334155' }}>
                <span style={{
                  padding: '2px 6px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#475569',
                }}>{keys}</span>
                <span>{label}</span>
              </span>
            ))}
          </div>
          <span style={{ fontFamily: "'Fira Code', monospace", fontSize: '10px', color: '#1e2738', letterSpacing: '0.05em' }}>
            {filteredItems.length} results
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
