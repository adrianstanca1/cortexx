import { useState } from 'react';
import { X, Home, Briefcase, FileText, Users, Settings, ChevronDown } from 'lucide-react';
import { type Module } from '../../types';

interface MobileMenuProps {
  activeModule: Module;
  onNavigate: (module: Module) => void;
  isOpen: boolean;
  onClose: () => void;
}

const MOBILE_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MobileMenu({ activeModule, onNavigate, isOpen, onClose }: MobileMenuProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Slide-out menu */}
      <div className="fixed inset-y-0 left-0 w-72 bg-base-100 z-50 md:hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h2 className="text-lg font-bold">CortexBuild</h2>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {MOBILE_MENU_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id as Module);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeModule === item.id 
                  ? 'bg-primary text-primary-content' 
                  : 'hover:bg-base-200'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          {/* More modules accordion */}
          <button
            onClick={() => toggleSection('more')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg mb-2 hover:bg-base-200"
          >
            <span className="font-medium">More Modules</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.more ? 'rotate-180' : ''}`} />
          </button>

          {expandedSections.more && (
            <div className="ml-4 pl-4 border-l-2 border-base-300">
              {['Safety', 'RFIs', 'Invoicing', 'Analytics', 'Calendar'].map(module => (
                <button
                  key={module}
                  onClick={() => {
                    onNavigate(module.toLowerCase().replace(' ', '-') as Module);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-2 rounded hover:bg-base-200 text-sm"
                >
                  {module}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 text-xs text-gray-500 text-center">
          CortexBuild Ultimate v3.0
        </div>
      </div>
    </>
  );
}
