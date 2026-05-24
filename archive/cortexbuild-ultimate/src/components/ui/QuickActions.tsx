import { useState } from 'react';
import {
  Plus,
  FileText,
  Briefcase,
  Users,
  AlertTriangle,
  ClipboardList,
  DollarSign,
  Upload,
  Download,
  Search,
  Bell,
  Settings,
  Zap,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  category?: 'create' | 'navigate' | 'action';
  color?: string;
}

interface QuickActionsToolbarProps {
  onNavigate?: (module: string) => void;
  className?: string;
}

export function QuickActionsToolbar({ onNavigate, className }: QuickActionsToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const createActions: QuickAction[] = [
    {
      id: 'new-project',
      label: 'New Project',
      icon: Briefcase,
      shortcut: 'Ctrl+N',
      action: () => { toast.success('New Project modal would open'); },
      category: 'create',
      color: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
    },
    {
      id: 'new-invoice',
      label: 'New Invoice',
      icon: DollarSign,
      shortcut: 'Ctrl+I',
      action: () => { toast.success('New Invoice modal would open'); },
      category: 'create',
      color: 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
    },
    {
      id: 'new-rfi',
      label: 'New RFI',
      icon: ClipboardList,
      action: () => { toast.success('New RFI modal would open'); },
      category: 'create',
      color: 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
    },
    {
      id: 'new-safety',
      label: 'Report Incident',
      icon: AlertTriangle,
      action: () => { toast.success('Safety incident form would open'); },
      category: 'create',
      color: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    },
    {
      id: 'new-team',
      label: 'Add Team Member',
      icon: Users,
      action: () => { toast.success('Add team member form would open'); },
      category: 'create',
      color: 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
    },
  ];

  const navigateActions: QuickAction[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: Zap,
      shortcut: 'Ctrl+1',
      action: () => onNavigate?.('dashboard'),
      category: 'navigate',
    },
    {
      id: 'nav-projects',
      label: 'Projects',
      icon: Briefcase,
      shortcut: 'Ctrl+2',
      action: () => onNavigate?.('projects'),
      category: 'navigate',
    },
    {
      id: 'nav-invoices',
      label: 'Invoices',
      icon: FileText,
      shortcut: 'Ctrl+3',
      action: () => onNavigate?.('invoicing'),
      category: 'navigate',
    },
    {
      id: 'nav-safety',
      label: 'Safety',
      icon: AlertTriangle,
      shortcut: 'Ctrl+4',
      action: () => onNavigate?.('safety'),
      category: 'navigate',
    },
    {
      id: 'nav-team',
      label: 'Team',
      icon: Users,
      action: () => onNavigate?.('teams'),
      category: 'navigate',
    },
  ];

  const utilityActions: QuickAction[] = [
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      shortcut: 'Ctrl+Shift+K',
      action: () => { toast.info('Global search would open'); },
      category: 'action',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      action: () => { toast.info('Notifications panel would open'); },
      category: 'action',
    },
    {
      id: 'export',
      label: 'Export Data',
      icon: Download,
      action: () => { toast.success('Export options would show'); },
      category: 'action',
    },
    {
      id: 'import',
      label: 'Import Data',
      icon: Upload,
      action: () => { toast.success('Import wizard would open'); },
      category: 'action',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: () => onNavigate?.('settings'),
      category: 'action',
    },
  ];

  const _allActions = [...createActions, ...navigateActions, ...utilityActions];

  const QuickActionButton = ({ action }: { action: QuickAction }) => {
    const Icon = action.icon;
    return (
      <button
        onClick={action.action}
        className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left',
          action.category === 'create'
            ? action.color || 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            : 'hover:bg-gray-800 text-gray-300'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{action.label}</p>
          {action.shortcut && (
            <p className="text-xs text-gray-500">{action.shortcut}</p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Quick Actions
        </h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          {showAll ? 'Show Less' : 'Show All'}
          <ChevronDown className={clsx('h-3 w-3 transition-transform', showAll && 'rotate-180')} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {createActions.slice(0, showAll ? 5 : 3).map(action => (
          <QuickActionButton key={action.id} action={action} />
        ))}
      </div>

      {showAll && (
        <>
          <div className="border-t border-gray-800 pt-4 mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Navigate
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {navigateActions.map(action => (
                <QuickActionButton key={action.id} action={action} />
              ))}
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4 mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Utilities
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {utilityActions.map(action => (
                <QuickActionButton key={action.id} action={action} />
              ))}
            </div>
          </div>
        </>
      )}

      {!showAll && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-400 flex items-center justify-center gap-2"
        >
          <Clock className="h-4 w-4" />
          Recent & More
          <ChevronDown className={clsx('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  );
}

export function QuickActionsFAB() {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: Briefcase, label: 'Project', color: 'bg-blue-500', action: () => toast.success('New Project') },
    { icon: DollarSign, label: 'Invoice', color: 'bg-emerald-500', action: () => toast.success('New Invoice') },
    { icon: ClipboardList, label: 'RFI', color: 'bg-amber-500', action: () => toast.success('New RFI') },
    { icon: AlertTriangle, label: 'Safety', color: 'bg-red-500', action: () => toast.success('Report Incident') },
  ];

  return (
    <div className="fixed bottom-24 right-6 z-40">
      {open && (
        <div className="absolute bottom-16 right-0 space-y-2 mb-2">
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                onClick={() => { action.action(); setOpen(false); }}
                className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-2"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`p-1.5 rounded ${action.color}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all',
          open ? 'bg-red-500 rotate-45' : 'bg-blue-600 hover:bg-blue-500'
        )}
      >
        <Plus className="h-6 w-6 text-white" />
      </button>
    </div>
  );
}
