'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  ShieldAlert,
  AlertTriangle,
  ClipboardCheck,
  PenTool,
  Receipt,
  Wrench,
  HelpCircle,
  Clock,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/safety', label: 'Safety', icon: ShieldAlert },
  { href: '/defects', label: 'Defects', icon: AlertTriangle },
  { href: '/inspections', label: 'Inspections', icon: ClipboardCheck },
  { href: '/drawings', label: 'Drawings', icon: PenTool },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/equipment', label: 'Equipment', icon: Wrench },
  { href: '/rfi', label: 'RFI', icon: HelpCircle },
  { href: '/timesheets', label: 'Timesheets', icon: Clock },
  { href: '/daily-reports', label: 'Daily Reports', icon: FileText },
  { href: '/admin', label: 'Admin', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        {!collapsed && <span className="font-bold text-lg">CortexBuild</span>}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex-1 overflow-auto py-4">
        <ul className="space-y-1 px-2">
          {nav.map((item) => {
            const active = pathname ? pathname === item.href || pathname.startsWith(item.href + '/') : false;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
