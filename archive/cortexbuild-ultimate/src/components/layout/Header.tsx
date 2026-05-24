/**
 * CortexBuild Ultimate — Enhanced Header
 * Steel & amber command bar — authoritative, professional, site-control-center feel
 */
import { useState, useEffect } from 'react';
import {
  Bell, Search, Menu, ChevronDown,
} from 'lucide-react';
import { type Module } from '../../types';
import { NotificationsPanel } from './NotificationsPanel';
import { useTheme } from '../../context/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { NotificationCenter } from '../ui/NotificationCenter';
import { NotificationPreferences } from '../ui/NotificationPreferences';
import { ThemeSwitcher } from '../daisyui/ThemeSwitcher';
import { useAuth } from '../../context/AuthContext';

const MODULE_LABELS: Record<Module, string> = {
  'dashboard':            'Dashboard',
  'projects':            'Projects',
  'invoicing':           'Invoicing',
  'accounting':          'Accounting',
  'financial-reports':    'Financial Reports',
  'procurement':         'Procurement',
  'rams':                'RAMS — Risk Assessment & Method Statements',
  'cis':                 'CIS Returns',
  'site-ops':            'Site Operations',
  'teams':               'Teams & Labour',
  'tenders':             'Tenders & Bids',
  'analytics':           'Analytics & Business Intelligence',
  'safety':             'Safety & HSE',
  'field-view':          'Field View / Maps',
  'crm':                'CRM & Clients',
  'documents':           'Documents',
  'timesheets':         'Timesheets',
  'plant':               'Plant & Equipment',
  'subcontractors':      'Subcontractors',
  'ai-assistant':        'AI Assistant',
  'rfis':               'RFIs — Requests for Information',
  'change-orders':       'Change Orders',
  'punch-list':         'Punch List / Snagging',
  'inspections':         'Inspections & QA',
  'risk-register':       'Risk Register',
  'drawings':           'Drawings & Plans',
  'meetings':           'Meetings',
  'materials':           'Materials Management',
  'daily-reports':       'Daily Reports',
  'marketplace':        'AI Marketplace',
  'settings':           'Settings',
  'insights':           'AI Insights Engine',
  'notifications':       'Notifications',
  'executive-reports':   'Executive Reports',
  'predictive-analytics':'Predictive Analytics',
  'calendar':           'Calendar',
  'search':             'Search',
  'audit-log':          'Audit Log',
  'variations':         'Variations',
  'defects':            'Defects Management',
  'valuations':         'Valuations & Certificates',
  'specifications':     'Specifications',
  'temp-works':         'Temporary Works',
  'signage':            'Site Signage',
  'waste-management':   'Waste Management',
  'sustainability':     'Sustainability & ESG',
  'training':           'Training & Certifications',
  'certifications':     'Certifications & Licenses',
  'prequalification':   'Prequalification',
  'lettings':          'Contract Lettings',
  'measuring':          'Site Measuring & Surveys',
  'email-history':      'Email History',
  'permissions':        'Permissions & Roles',
  'report-templates':   'Report Templates',
  'bim-viewer':         'BIM 3D Model Viewer',
  'cost-management':    'Cost Management & Budgets',
  'submittal-management': 'Submittal Management',
  'dev-sandbox':        'AI Development Sandbox',
  'ai-vision':          'AI Vision Analytics',
  'my-desktop':         'Virtual Desktop Environment',
  'advanced-analytics': 'Advanced Analytics',
  'project-calendar':   'Project Calendar',
  'admin-dashboard':    'Admin Dashboard',
  'team-chat':          'Team Chat',
  'activity-feed':      'Activity Feed',
  'client-portal':      'Client Portal',
  'webhooks':           'Webhooks',
  'carbon-estimating':   'Carbon Estimating',
  'site-inspections':   'Site Inspections',
  'permits':              'Permits & Licences',
  'bim-4d':            '4D BIM',
  'billing':            'Billing & Plans',
  'maintenance-schedules': 'Maintenance Schedules',
  'project-templates':    'Project Templates',
  'settings-mfa':       'Two-Factor Authentication',
  'api-keys':           'API Keys',
  'tasks': 'Tasks',
  'suppliers': 'Suppliers',
};

// Module accent colors for the breadcrumb bar
const MODULE_ACCENTS: Partial<Record<Module, string>> = {
  'dashboard': '#f59e0b',
  'projects': '#f59e0b',
  'safety': '#ef4444',
  'ai-assistant': '#f59e0b',
  'insights': '#f59e0b',
  'analytics': '#3b82f6',
  'financial-reports': '#10b981',
  'risk-register': '#ef4444',
  'rams': '#ef4444',
  'field-view': '#f59e0b',
  'settings': '#64748b',
  'tasks': 'Tasks',
  'suppliers': 'Suppliers',
};

// ⚡ Bolt Performance Optimization:
// Extracted high-frequency state update (setInterval clock) into a dedicated leaf component.
// This prevents the entire <Header> and its children from needlessly re-rendering every second.
function HeaderClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      {currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
      {' · '}
      {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </>
  );
}

export function Header({ activeModule, onMenuToggle }: { activeModule: Module; onMenuToggle?: () => void }) {
  const [, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const accent = MODULE_ACCENTS[activeModule] || '#f59e0b';
  useTheme?.();
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const label = MODULE_LABELS[activeModule] ?? activeModule;

  return (
    <header
      style={{
        height: '60px',
        background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '16px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Accent line under header */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${accent}60 20%, ${accent} 50%, ${accent}60 80%, transparent 100%)`,
          opacity: 0.8,
        }}
      />

      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        title="Toggle menu"
        aria-label="Toggle navigation menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer',
          color: '#64748b',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(245,158,11,0.1)';
          e.currentTarget.style.color = '#f59e0b';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = '#64748b';
        }}
      >
        <Menu style={{ width: '16px', height: '16px' }} />
      </button>

      {/* Breadcrumb / Module label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Module colored dot */}
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: accent,
            flexShrink: 0,
            boxShadow: `0 0 8px ${accent}80`,
          }}
        />

        {/* Label */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
          {/* Construction status strip */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '8px',
              fontWeight: 600,
              color: '#475569',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: '1px',
            }}
          >
            <HeaderClock />
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Search — hidden on mobile */}
        {!isMobile && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                height: '34px',
                borderRadius: '9px',
                background: searchFocused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${searchFocused ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                width: searchFocused ? '220px' : '160px',
                boxShadow: searchFocused ? '0 0 0 2px rgba(245,158,11,0.1), 0 0 16px rgba(245,158,11,0.05)' : 'none',
              }}
            >
              <Search
                style={{
                  width: '13px',
                  height: '13px',
                  color: searchFocused ? '#f59e0b' : '#475569',
                  flexShrink: 0,
                  transition: 'color 0.2s',
                }}
              />
              <input
                type="text"
                placeholder="Search..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  color: '#e2e8f0',
                  width: '100%',
                  cursor: 'text',
                }}
              />
              {!searchFocused && (
                <div
                  style={{
              fontFamily: "'Fira Code', monospace",
                    fontSize: '9px',
                    color: '#334155',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0,
                  }}
                >
                  ⌘⇧K
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification bell */}
        <NotificationButton
          isOpen={notifOpen}
          onToggle={() => { setNotifOpen(p => !p); setProfileOpen(false); }}
        />
        {/* Notification Center Button */}
        <button
          onClick={() => setShowNotificationCenter(true)}
          title="Notification Center"
          aria-label="Open notification center"
          style={{
            position: 'relative',
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            transition: 'all 0.15s',
            marginLeft: '8px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.1)';
            e.currentTarget.style.color = '#f59e0b';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <Bell style={{ width: '16px', height: '16px' }} />
          {/* Unread indicator */}
          <span style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid #0d1117',
          }} />
        </button>
        {/* Notification Preferences Button */}
        <button
          onClick={() => setShowNotificationPrefs(true)}
          title="Notification Settings"
          aria-label="Open notification settings"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            transition: 'all 0.15s',
            marginLeft: '4px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.1)';
            e.currentTarget.style.color = '#f59e0b';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.75 2.924-1.75 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.75.426 1.75 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.75-2.924 1.75-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.75-.426-1.75-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Theme Switcher */}
        {!isMobile && <ThemeSwitcher className="ml-2" />}

        {/* Profile */}
        <ProfileButton
          isOpen={profileOpen}
          isMobile={isMobile}
          onToggle={() => { setProfileOpen(p => !p); setNotifOpen(false); }}
        />
      </div>

      {/* Notifications panel */}
      {notifOpen && (
        <div
          style={{
            position: 'absolute',
            top: '58px',
            right: '16px',
            width: '360px',
            zIndex: 100,
          }}
        >
          <NotificationsPanel
            authToken={null}
            onClose={() => setNotifOpen(false)}
          />
        </div>
      )}

      {/* Notification Center Modal */}
      {showNotificationCenter && (
        <NotificationCenter onClose={() => setShowNotificationCenter(false)} />
      )}

      {/* Notification Preferences Modal */}
      {showNotificationPrefs && (
        <NotificationPreferences onClose={() => setShowNotificationPrefs(false)} />
      )}
    </header>
  );
}

// ── Notification Bell ──────────────────────────────────────────────────────────
function NotificationButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title="Notifications"
      style={{
        position: 'relative',
        width: '34px',
        height: '34px',
        borderRadius: '9px',
        background: isOpen ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isOpen ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOpen ? '#f59e0b' : '#64748b',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!isOpen) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
          e.currentTarget.style.color = '#94a3b8';
        }
      }}
      onMouseLeave={e => {
        if (!isOpen) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = '#64748b';
        }
      }}
    >
      <Bell style={{ width: '15px', height: '15px' }} />
      {/* Red dot indicator */}
      <div
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#ef4444',
          border: '1px solid #0d1117',
        }}
      />
    </button>
  );
}

// ── Profile Button ──────────────────────────────────────────────────────────────
function ProfileButton({ isOpen, isMobile, onToggle }: {
  isOpen: boolean; isMobile?: boolean; onToggle: () => void;
}) {
  const { user, signOut } = useAuth();

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        title="Profile"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0' : '8px',
          padding: isMobile ? '0 6px' : '0 10px',
          height: '34px',
          borderRadius: '9px',
          background: isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isOpen ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)'}`,
          cursor: 'pointer',
          color: isOpen ? '#f59e0b' : '#64748b',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
            e.currentTarget.style.color = '#e2e8f0';
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#64748b';
          }
        }}
      >
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Syne', sans-serif",
            fontSize: '9px',
            fontWeight: 800,
            color: '#1e1b16',
            flexShrink: 0,
            boxShadow: '0 0 8px rgba(245,158,11,0.3)',
          }}
        >
          {initials}
        </div>
        {!isMobile && (
          <>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: 500,
                color: '#cbd5e1',
              }}
            >
              {user?.name || 'User'}
            </span>
            <ChevronDown
              style={{
                width: '12px',
                height: '12px',
                color: '#475569',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '240px',
            background: '#1a1f2e',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '12px',
            padding: '8px',
            zIndex: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>
              {user?.email || ''}
            </div>
            {user?.role && (
              <div style={{
                display: 'inline-block',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                fontWeight: 600,
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '4px',
                padding: '1px 6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {user.role}
              </div>
            )}
          </div>

          <button
            onClick={async () => { await signOut(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ef4444',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              transition: 'background 0.15s',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg style={{ width: '15px', height: '15px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
