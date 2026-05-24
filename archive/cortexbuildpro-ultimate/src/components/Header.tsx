import { useState } from 'react';
import { type Module } from '../App';
import { Bell, Search, User, Menu, ChevronDown } from 'lucide-react';

const moduleLabels: Record<Module, string> = {
  'dashboard': 'Dashboard', 'projects': 'Projects', 'invoicing': 'Invoicing',
  'accounting': 'Accounting', 'procurement': 'Procurement', 'rams': 'RAMS',
  'cis': 'CIS Returns', 'site-operations': 'Site Operations', 'teams': 'Teams',
  'tenders': 'Tenders', 'analytics': 'Analytics', 'safety': 'Safety',
  'field-view': 'Field View', 'crm': 'CRM', 'documents': 'Documents',
  'timesheets': 'Timesheets', 'plant': 'Plant & Equipment',
  'subcontractors': 'Subcontractors', 'ai-assistant': 'AI Assistant', 'settings': 'Settings',
};
interface HeaderProps { activeModule: Module; sidebarCollapsed: boolean; setSidebarCollapsed: (v: boolean) => void; }

export function Header({ activeModule, sidebarCollapsed, setSidebarCollapsed }: HeaderProps) {
  const [notifications] = useState(5);
  const now = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-gray-400 hover:text-white"><Menu className="w-5 h-5" /></button>
        <div><h1 className="text-lg font-semibold text-white">{moduleLabels[activeModule]}</h1><p className="text-xs text-gray-500">{now}</p></div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search anything..." className="bg-gray-800 text-sm text-white pl-9 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 w-64" />
        </div>
        <button className="relative text-gray-400 hover:text-white">
          <Bell className="w-5 h-5" />
          {notifications > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{notifications}</span>}
        </button>
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-700">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
          <div className="hidden md:block text-left"><div className="text-xs font-medium text-white">AS Cladding Ltd</div><div className="text-xs text-gray-400">Admin</div></div>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </div>
      </div>
    </header>
  );
}
