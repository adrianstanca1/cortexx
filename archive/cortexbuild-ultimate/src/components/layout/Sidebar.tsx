/**
 * CortexBuild Ultimate — Enhanced Sidebar
 * Professional construction aesthetic: blueprint grid, amber accents, steel undertones
 */
import { useState } from 'react';
import { type Module } from '../../types';
import { AnimatedLogo } from './AnimatedLogo';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FolderOpen, FileText, Calculator, ShoppingCart,
  ShieldCheck, Receipt, Hammer, Users, FileSearch, BarChart3,
  AlertTriangle, MapPin, UserCheck, BookOpen, Clock, Wrench,
  Building2, Bot, Settings, ChevronLeft, ChevronRight,
  MessageSquare, GitPullRequest, CheckSquare, ClipboardCheck,
  Triangle, Layers, Package, ClipboardList, Store,
  HardHat, TrendingUp, Brain, Bell, FileBarChart, TrendingUp as TrendingUpIcon,
  PieChart, FileEdit, Coins, FileStack, Construction,
  Signpost, Trash2, Leaf, GraduationCap, Award, BadgeCheck,
  Building, Ruler, Eye, ChevronDown, Mail, Lock, FileEdit as FileTemplate,
  Box, DollarSign, Upload, Activity, LayoutTemplate, Key,
} from 'lucide-react';

interface SidebarProps {
  activeModule: Module;
  setModule: (m: Module) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

// ── Group definitions ─────────────────────────────────────────────────────────
type NavItem = {
  id: Module;
  label: string;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  badge?: string | null;
};

const NAV_GROUPS: { id: string; label: string; accent: string; items: NavItem[] }[] = [
  {
    id: 'overview',
    label: 'Overview',
    accent: '#f59e0b', // amber
    items: [
      { id: 'dashboard',             label: 'Dashboard',           icon: LayoutDashboard,   badge: null },
      { id: 'analytics',             label: 'Analytics & BI',      icon: BarChart3,         badge: null },
      { id: 'advanced-analytics',    label: 'Advanced Analytics',  icon: TrendingUp,        badge: 'NEW' },
      { id: 'project-calendar',      label: 'Project Calendar',    icon: Clock,             badge: 'NEW' },
      { id: 'ai-assistant',          label: 'AI Assistant',        icon: Bot,               badge: 'AI' },
      { id: 'insights',              label: 'AI Insights',         icon: Brain,             badge: 'NEW' },
      { id: 'predictive-analytics',  label: 'Predictive Analytics', icon: TrendingUpIcon,   badge: 'NEW' },
      { id: 'team-chat',               label: 'Team Chat',            icon: MessageSquare,    badge: 'NEW' },
      { id: 'activity-feed',          label: 'Activity Feed',        icon: Activity,         badge: 'NEW' },
    ],
  },
  {
    id: 'projects',
    label: 'Project Management',
    accent: '#f59e0b',
    items: [
      { id: 'projects',       label: 'Projects',        icon: FolderOpen,     badge: null },
      { id: 'site-ops',       label: 'Site Operations', icon: Hammer,         badge: null },
      { id: 'daily-reports',  label: 'Daily Reports',  icon: ClipboardList,  badge: null },
      { id: 'field-view',     label: 'Field View',      icon: MapPin,         badge: null },
      { id: 'drawings',       label: 'Drawings & Plans',icon: Layers,         badge: null },
      { id: 'meetings',       label: 'Meetings',        icon: MessageSquare,  badge: null },
      { id: 'project-templates', label: 'Project Templates', icon: LayoutTemplate, badge: 'NEW' },
      { id: 'tasks',          label: 'Tasks',            icon: CheckSquare,      badge: 'NEW' },
    ],
  },
  {
    id: 'finance',
    label: 'Commercial & Finance',
    accent: '#3b82f6', // blue
    items: [
      { id: 'tenders',              label: 'Tenders & Bids',        icon: TrendingUp,       badge: null },
      { id: 'invoicing',            label: 'Invoicing',             icon: FileText,         badge: null },
      { id: 'accounting',           label: 'Accounting',            icon: Calculator,       badge: null },
      { id: 'financial-reports',    label: 'Financial Reports',     icon: PieChart,         badge: 'NEW' },
      { id: 'cis',                 label: 'CIS Returns',            icon: Receipt,          badge: 'UK' },
      { id: 'procurement',         label: 'Procurement',            icon: ShoppingCart,     badge: null },
      { id: 'change-orders',       label: 'Change Orders',          icon: GitPullRequest,   badge: null },
      { id: 'variations',          label: 'Variations',             icon: FileEdit,         badge: null },
      { id: 'valuations',          label: 'Valuations',             icon: Coins,            badge: null },
      { id: 'cost-management',     label: 'Cost Management',        icon: DollarSign,       badge: 'NEW' },
      { id: 'prequalification',    label: 'Prequalification',       icon: BadgeCheck,       badge: null },
      { id: 'lettings',            label: 'Lettings',               icon: Building,         badge: null },
    ],
  },
  {
    id: 'operations',
    label: 'Site & Operations',
    accent: '#f59e0b',
    items: [
      { id: 'teams',           label: 'Teams & Labour',     icon: Users,         badge: null },
      { id: 'timesheets',      label: 'Timesheets',          icon: Clock,         badge: null },
      { id: 'subcontractors',  label: 'Subcontractors',     icon: UserCheck,      badge: null },
      { id: 'plant',           label: 'Plant & Equipment',   icon: Wrench,        badge: null },
      { id: 'materials',       label: 'Materials',          icon: Package,       badge: null },
      { id: 'suppliers',       label: 'Suppliers',          icon: Building2,     badge: 'NEW' },
      { id: 'rfis',            label: 'RFIs',               icon: HardHat,       badge: null },
      { id: 'bim-viewer',      label: 'BIM Viewer',         icon: Box,           badge: 'NEW' },
      { id: 'submittal-management', label: 'Submittals',     icon: Upload,        badge: 'NEW' },
      { id: 'temp-works',      label: 'Temp Works',          icon: Construction,   badge: null },
      { id: 'measuring',       label: 'Measuring',           icon: Ruler,         badge: null },
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Compliance',
    accent: '#ef4444', // red
    items: [
      { id: 'safety',          label: 'Safety & HSE',         icon: AlertTriangle,  badge: null },
      { id: 'site-inspections',label: 'Site Inspections',      icon: ClipboardCheck, badge: 'NEW' },
      { id: 'permits',          label: 'Permits & Licences',      icon: ShieldCheck,    badge: 'NEW' },
      { id: 'rams',            label: 'RAMS',                   icon: ShieldCheck,    badge: 'UK' },
      { id: 'inspections',     label: 'Inspections',            icon: ClipboardCheck, badge: null },
      { id: 'punch-list',      label: 'Punch List',             icon: CheckSquare,    badge: null },
      { id: 'risk-register',   label: 'Risk Register',          icon: Triangle,       badge: null },
      { id: 'documents',       label: 'Documents',               icon: BookOpen,      badge: null },
      { id: 'defects',         label: 'Defects',                icon: FileSearch,    badge: null },
      { id: 'specifications',  label: 'Specifications',         icon: FileStack,     badge: null },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    accent: '#3b82f6',
    items: [
      { id: 'crm',                label: 'CRM & Clients',         icon: Building2,      badge: null },
      { id: 'executive-reports',  label: 'Executive Reports',      icon: FileBarChart,   badge: 'NEW' },
      { id: 'marketplace',        label: 'AI Marketplace',         icon: Store,          badge: 'NEW' },
      { id: 'calendar',           label: 'Calendar',               icon: Bell,           badge: null },
      { id: 'audit-log',          label: 'Audit Log',              icon: Eye,            badge: null },
      { id: 'email-history',      label: 'Email History',          icon: Mail,           badge: null },
      { id: 'permissions',        label: 'Permissions',            icon: Lock,           badge: null },
      { id: 'report-templates',   label: 'Report Templates',       icon: FileTemplate,   badge: null },
      { id: 'api-keys',           label: 'API Keys',               icon: Key,            badge: null },
      { id: 'billing',            label: 'Billing',                icon: DollarSign,     badge: null },
      { id: 'admin-dashboard',    label: 'Admin Dashboard',        icon: ShieldCheck,    badge: 'ADMIN' },
      { id: 'settings',           label: 'Settings',               icon: Settings,       badge: null },
      { id: 'settings-mfa',       label: 'Two-Factor Auth',        icon: Lock,           badge: null },
      { id: 'signage',            label: 'Signage',                icon: Signpost,       badge: null },
      { id: 'waste-management',    label: 'Waste Management',       icon: Trash2,         badge: null },
      { id: 'sustainability',     label: 'Sustainability',          icon: Leaf,           badge: null },
      { id: 'training',           label: 'Training',               icon: GraduationCap,  badge: null },
      { id: 'certifications',     label: 'Certifications',          icon: Award,          badge: null },
    ],
  },
  {
    id: 'ai-desktop',
    label: 'AI & Desktop',
    accent: '#8b5cf6', // purple
    items: [
      { id: 'ai-vision',      label: 'AI Vision',      icon: Eye,            badge: 'NEW' },
      { id: 'dev-sandbox',    label: 'Dev Sandbox',   icon: Bot,            badge: 'DEV' },
      { id: 'my-desktop',     label: 'My Desktop',    icon: LayoutDashboard, badge: 'BETA' },
    ],
  },
];

// ── Deduplication ─────────────────────────────────────────────────────────────
const seen = new Set<string>();
const DEDUPED_GROUPS = NAV_GROUPS.map(g => ({
  ...g,
  items: g.items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }),
})).filter(g => g.items.length > 0);

// ── Sub-components ─────────────────────────────────────────────────────────────

function NavItem({
  item,
  active,
  collapsed,
  accent,
  onClick,
}: {
  item: { id: Module; label: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }>; badge?: string | null };
  active: boolean;
  collapsed: boolean;
  accent: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`nav-item ${active ? 'nav-item-active' : ''}`}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: collapsed ? '9px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active
          ? `linear-gradient(90deg, ${accent}18 0%, ${accent}08 100%)`
          : hovered
          ? 'rgba(255,255,255,0.05)'
          : 'transparent',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        color: active ? accent : hovered ? '#e2e8f0' : '#64748b',
        position: 'relative',
        marginBottom: '2px',
        transform: hovered && !active ? 'translateX(2px)' : 'none',
        boxShadow: hovered && !active ? `0 0 12px ${accent}12` : 'none',
      }}
    >
      {/* Active indicator bar */}
      {active && (
        <div
          style={{
            position: 'absolute',
            left: collapsed ? '-1px' : '-1px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '3px',
            height: '60%',
            borderRadius: '0 3px 3px 0',
            background: `linear-gradient(180deg, ${accent}, ${accent}80)`,
            boxShadow: `0 0 8px ${accent}60`,
          }}
        />
      )}

      {/* Icon */}
      <span
        style={{
          width: '18px',
          height: '18px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: active ? 1 : hovered ? 0.9 : 0.6,
          transition: 'all 0.15s',
          filter: active ? `drop-shadow(0 0 4px ${accent}80)` : hovered ? `drop-shadow(0 0 3px ${accent}40)` : 'none',
          transform: hovered && !active ? 'scale(1.1)' : 'none',
        }}
      >
        <Icon style={{ width: '16px', height: '16px' }} />
      </span>

      {/* Label + badge */}
      {!collapsed && (
        <span
          style={{
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '13px',
            fontWeight: active ? 600 : 500,
            flex: 1,
            textAlign: 'left',
            letterSpacing: active ? '0.01em' : '0',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </span>
      )}

      {!collapsed && item.badge && (
        <span
          style={{
            flexShrink: 0,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '2px 5px',
            borderRadius: '4px',
            background: `${accent}20`,
            color: accent,
            border: `1px solid ${accent}30`,
            fontFamily: "'Fira Code', monospace",
          }}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

function NavGroup({
  group,
  collapsed,
  activeModule,
  setModule,
}: {
  group: (typeof DEDUPED_GROUPS)[number];
  collapsed: boolean;
  activeModule: Module;
  setModule: (m: Module) => void;
}) {
  const [expanded, setExpanded] = useState(!collapsed);

  return (
    <div style={{ marginBottom: collapsed ? '6px' : '2px' }}>
      {!collapsed && (
        <button
          onClick={() => setExpanded(p => !p)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px 4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#475569',
            fontFamily: "'Fira Code', monospace",
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          {/* Accent line */}
          <div
            style={{
              width: '14px',
              height: '2px',
              borderRadius: '1px',
              background: group.accent,
              flexShrink: 0,
              opacity: 0.7,
            }}
          />
          <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
          <ChevronDown
            style={{
              width: '12px',
              height: '12px',
              opacity: 0.5,
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
            }}
          />
        </button>
      )}
      {collapsed && (
        <div
          style={{
            padding: '8px 0 2px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '4px',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '2px',
              borderRadius: '1px',
              background: group.accent,
              margin: '0 auto',
              opacity: 0.5,
            }}
          />
        </div>
      )}

      {(!collapsed ? expanded : true) &&
        group.items.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={activeModule === item.id}
            collapsed={collapsed}
            accent={group.accent}
            onClick={() => setModule(item.id)}
          />
        ))}
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────
export function Sidebar({ activeModule, setModule, collapsed, setCollapsed }: SidebarProps) {
  const { user } = useAuth();
  const displayName = user?.name || 'User';
  const displayRole = user?.role || 'Team Member';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        width: collapsed ? '68px' : '248px',
        background: 'linear-gradient(180deg, #0c1220 0%, #0d1117 100%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Blueprint micro-grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Animated corner bracket decorations */}
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}>
        <path d="M 0 16 L 0 0 L 16 0" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M 0 8 L 0 0 L 8 0" stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeLinecap="round" fill="none"/>
      </svg>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, pointerEvents: 'none' }}>
        <path d="M 40 16 L 40 0 L 24 0" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M 40 8 L 40 0 L 32 0" stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeLinecap="round" fill="none"/>
      </svg>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ position: 'absolute', bottom: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}>
        <path d="M 0 24 L 0 40 L 16 40" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M 0 32 L 0 40 L 8 40" stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeLinecap="round" fill="none"/>
      </svg>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 2, pointerEvents: 'none' }}>
        <path d="M 40 24 L 40 40 L 24 40" stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M 40 32 L 40 40 L 32 40" stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeLinecap="round" fill="none"/>
      </svg>

      {/* Content above footer */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── Logo ──────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0 0' : '0 14px',
            height: '62px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
<AnimatedLogo size={34} showText={false} />

            {!collapsed && (
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#f1f5f9',
                    lineHeight: 1.1,
                    letterSpacing: '0.04em',
                  }}
                >
                  CortexBuild
                </div>
                <div
                  style={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: '9px',
                    fontWeight: 600,
                    color: '#f59e0b',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    marginTop: '1px',
                  }}
                >
                  Ultimate
                </div>
              </div>
            )}
          </div>

          {/* Collapse toggle */}
          {!collapsed ? (
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(245,158,11,0.12)';
                e.currentTarget.style.color = '#f59e0b';
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <ChevronLeft style={{ width: '13px', height: '13px' }} />
            </button>
          ) : null}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              color: '#475569',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
          >
            <ChevronRight style={{ width: '14px', height: '14px' }} />
          </button>
        )}

        {/* ── Nav scroll area ───────────────────────────────────────────────── */}
        <nav
          className="nav-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: collapsed ? '10px 8px' : '10px 8px',
            paddingRight: collapsed ? '4px' : '8px',
          }}
        >
          {DEDUPED_GROUPS.map(group => (
            <NavGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              activeModule={activeModule}
              setModule={setModule}
            />
          ))}
        </nav>
      </div>

      {/* ── User footer ─────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: collapsed ? '12px 0' : '14px 14px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.3))',
        }}
      >
        {/* Divider glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)',
          }}
        />

        {!collapsed ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Syne', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                color: '#1e1b16',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(245,158,11,0.3)',
              }}
            >
              {initials}
            </div>

            {/* User info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontFamily: "'Fira Code', monospace",
                  fontSize: '9px',
                  color: '#475569',
                  letterSpacing: '0.05em',
                }}
              >
                {displayRole}
              </div>
            </div>

            {/* Online indicator */}
            <div
              title="Online"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                flexShrink: 0,
                boxShadow: '0 0 6px rgba(16,185,129,0.6)',
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              title={`${displayName} — Online`}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Syne', sans-serif",
                fontSize: '11px',
                fontWeight: 800,
                color: '#1e1b16',
                boxShadow: '0 0 10px rgba(245,158,11,0.3)',
              }}
            >
              {initials}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
