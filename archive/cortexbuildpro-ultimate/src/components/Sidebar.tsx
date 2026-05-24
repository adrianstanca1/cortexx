import { type Module } from '../App';
import {
  LayoutDashboard, FolderOpen, FileText, Calculator, ShoppingCart,
  ShieldCheck, Receipt, Hammer, Users, FileSearch, BarChart3,
  AlertTriangle, MapPin, UserCheck, BookOpen, Clock, Wrench,
  Building2, Bot, Settings, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';

interface SidebarProps {
  activeModule: Module;
  setModule: (m: Module) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const groups = [
  { label: 'OVERVIEW', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, highlight: true },
  ]},
  { label: 'PROJECT MANAGEMENT', items: [
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'tenders', label: 'Tenders', icon: FileSearch },
    { id: 'site-operations', label: 'Site Operations', icon: Hammer },
    { id: 'field-view', label: 'Field View', icon: MapPin },
  ]},
  { label: 'FINANCE & COMPLIANCE', items: [
    { id: 'invoicing', label: 'Invoicing', icon: FileText },
    { id: 'accounting', label: 'Accounting', icon: Calculator },
    { id: 'cis', label: 'CIS Returns', icon: Receipt },
    { id: 'procurement', label: 'Procurement', icon: ShoppingCart },
  ]},
  { label: 'OPERATIONS', items: [
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'subcontractors', label: 'Subcontractors', icon: UserCheck },
    { id: 'plant', label: 'Plant & Equipment', icon: Wrench },
  ]},
  { label: 'SAFETY & COMPLIANCE', items: [
    { id: 'rams', label: 'RAMS', icon: ShieldCheck },
    { id: 'safety', label: 'Safety', icon: AlertTriangle },
    { id: 'documents', label: 'Documents', icon: BookOpen },
  ]},
  { label: 'BUSINESS', items: [
    { id: 'crm', label: 'CRM', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]}
];

export function Sidebar({ activeModule, setModule, collapsed, setCollapsed }: SidebarProps) {
  return (
    <aside className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">CortexBuild</div>
              <div className="text-xs text-gray-400">Pro Ultimate</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-4 space-y-1">
        {groups.map(group => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="px-4 mb-1 text-xs font-semibold text-gray-500 tracking-wider">{group.label}</div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setModule(item.id as Module)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 ${
                    active ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  } ${(item as any).highlight && !active ? 'text-purple-400' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${(item as any).highlight && !active ? 'text-purple-400' : ''}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && (item as any).highlight && (
                    <span className="ml-auto text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full">AI</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
