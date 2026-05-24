import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Projects } from './components/modules/Projects';
import { Invoicing } from './components/modules/Invoicing';
import { Accounting } from './components/modules/Accounting';
import { Procurement } from './components/modules/Procurement';
import { RAMS } from './components/modules/RAMS';
import { CIS } from './components/modules/CIS';
import { SiteOperations } from './components/modules/SiteOperations';
import { Teams } from './components/modules/Teams';
import { Tenders } from './components/modules/Tenders';
import { Analytics } from './components/modules/Analytics';
import { Safety } from './components/modules/Safety';
import { FieldView } from './components/modules/FieldView';
import { CRM } from './components/modules/CRM';
import { Documents } from './components/modules/Documents';
import { Timesheets } from './components/modules/Timesheets';
import { PlantEquipment } from './components/modules/PlantEquipment';
import { Subcontractors } from './components/modules/Subcontractors';
import { AIAssistant } from './components/modules/AIAssistant';
import { Settings } from './components/modules/Settings';

export type Module = 'dashboard' | 'projects' | 'invoicing' | 'accounting' | 'procurement' | 'rams' | 'cis' | 'site-operations' | 'teams' | 'tenders' | 'analytics' | 'safety' | 'field-view' | 'crm' | 'documents' | 'timesheets' | 'plant' | 'subcontractors' | 'ai-assistant' | 'settings';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <Dashboard setModule={setActiveModule} />;
      case 'projects': return <Projects />;
      case 'invoicing': return <Invoicing />;
      case 'accounting': return <Accounting />;
      case 'procurement': return <Procurement />;
      case 'rams': return <RAMS />;
      case 'cis': return <CIS />;
      case 'site-operations': return <SiteOperations />;
      case 'teams': return <Teams />;
      case 'tenders': return <Tenders />;
      case 'analytics': return <Analytics />;
      case 'safety': return <Safety />;
      case 'field-view': return <FieldView />;
      case 'crm': return <CRM />;
      case 'documents': return <Documents />;
      case 'timesheets': return <Timesheets />;
      case 'plant': return <PlantEquipment />;
      case 'subcontractors': return <Subcontractors />;
      case 'ai-assistant': return <AIAssistant />;
      case 'settings': return <Settings />;
      default: return <Dashboard setModule={setActiveModule} />;
    }
  };
  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar activeModule={activeModule} setModule={setActiveModule} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header activeModule={activeModule} sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />
        <main className="flex-1 overflow-auto p-6 bg-gray-950">{renderModule()}</main>
      </div>
    </div>
  );
}
