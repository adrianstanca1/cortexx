/**
 * Breadcrumbs Component
 * Navigation breadcrumb trail for context and quick navigation
 */
import { ChevronRight, Home } from 'lucide-react';
import { type Module } from '../../types';
import { useModuleNavigation } from '../../context/ModuleNavigationContext';

interface BreadcrumbItem {
  label: string;
  href?: string;
  module?: Module;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (module: Module) => void;
}

const MODULE_LABELS: Record<Module, string> = {
  'dashboard': 'Dashboard',
  'projects': 'Projects',
  'invoicing': 'Invoicing',
  'accounting': 'Accounting',
  'financial-reports': 'Financial Reports',
  'procurement': 'Procurement',
  'rams': 'RAMS',
  'cis': 'CIS Returns',
  'site-ops': 'Site Operations',
  'teams': 'Teams',
  'tenders': 'Tenders',
  'analytics': 'Analytics',
  'safety': 'Safety',
  'field-view': 'Field View',
  'crm': 'CRM',
  'documents': 'Documents',
  'timesheets': 'Timesheets',
  'plant': 'Plant & Equipment',
  'subcontractors': 'Subcontractors',
  'ai-assistant': 'AI Assistant',
  'rfis': 'RFIs',
  'change-orders': 'Change Orders',
  'punch-list': 'Punch List',
  'inspections': 'Inspections',
  'risk-register': 'Risk Register',
  'drawings': 'Drawings',
  'meetings': 'Meetings',
  'materials': 'Materials',
  'daily-reports': 'Daily Reports',
  'marketplace': 'Marketplace',
  'settings': 'Settings',
  'insights': 'Insights',
  'notifications': 'Notifications',
  'executive-reports': 'Executive Reports',
  'predictive-analytics': 'Predictive Analytics',
  'calendar': 'Calendar',
  'search': 'Search',
  'audit-log': 'Audit Log',
  'variations': 'Variations',
  'defects': 'Defects',
  'valuations': 'Valuations',
  'specifications': 'Specifications',
  'temp-works': 'Temp Works',
  'signage': 'Signage',
  'waste-management': 'Waste Management',
  'sustainability': 'Sustainability',
  'training': 'Training',
  'certifications': 'Certifications',
  'prequalification': 'Prequalification',
  'lettings': 'Lettings',
  'measuring': 'Measuring',
  'email-history': 'Email History',
  'permissions': 'Permissions',
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
  'webhooks': 'Webhooks',
  'carbon-estimating': 'Carbon Estimating',
  'site-inspections':   'Site Inspections',
  'permits':            'Permits & Licences',
  'bim-4d':            '4D BIM',
  'billing': 'Billing',
  'maintenance-schedules': 'Maintenance Schedules',
  'project-templates': 'Project Templates',
  'settings-mfa': 'Two-Factor Auth',
  'api-keys': 'API Keys',
  'tasks': 'Tasks',
  'suppliers': 'Suppliers',
};

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <div
      className="module-bc-shell mb-6 rounded-2xl border border-white/[0.08] bg-[rgba(13,17,23,0.45)] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.22)] backdrop-blur-md"
      data-module-chrome="breadcrumbs"
    >
      <nav className="flex items-center text-sm text-slate-400" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        {/* Home link */}
        <li>
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
            aria-label="Go to dashboard"
          >
            <Home className="w-4 h-4" />
          </button>
        </li>

        {/* Breadcrumb items */}
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-slate-600" aria-hidden="true" />
            {index === items.length - 1 ? (
              // Current page (not clickable)
              <span className="text-slate-200 font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              // Clickable link
              <button
                onClick={() => item.module && onNavigate?.(item.module)}
                className="hover:text-amber-400 transition-colors"
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
      </nav>
    </div>
  );
}

/**
 * ModuleBreadcrumbs - Pre-configured for module navigation
 */
interface ModuleBreadcrumbsProps {
  currentModule: Module;
  /** When omitted, uses {@link useModuleNavigation} from the nearest {@link ModuleNavigationProvider}. */
  onNavigate?: (module: Module) => void;
  extraItems?: { label: string; href?: string }[];
}

export function ModuleBreadcrumbs({ currentModule, onNavigate, extraItems = [] }: ModuleBreadcrumbsProps) {
  const fromContext = useModuleNavigation();
  const navigate = onNavigate ?? fromContext;
  const items = [
    { label: MODULE_LABELS[currentModule] || currentModule, module: currentModule },
    ...extraItems,
  ];

  return <Breadcrumbs items={items} onNavigate={navigate} />;
}
