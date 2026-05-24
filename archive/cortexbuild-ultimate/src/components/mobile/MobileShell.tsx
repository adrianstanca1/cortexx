import { lazy, Suspense, useEffect } from 'react';
import { type Module } from '../../types';
import { ModuleNavigationProvider } from '../../context/ModuleNavigationContext';
import { MobileTopBar } from './MobileTopBar';
import { OfflineBanner } from './OfflineBanner';
import { MobileHome } from './MobileHome';
import { initSync } from '../../services/syncService';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

const MobileBottomNav = lazy(() =>
  import('../layout/MobileBottomNav').then(m => ({ default: m.MobileBottomNav }))
);

const MobileDailyReport    = lazy(() => import('./MobileDailyReport'));
const MobileSafetyIncident = lazy(() => import('./MobileSafetyIncident'));
const MobilePunchList      = lazy(() => import('./MobilePunchList'));
const MobileTimesheet      = lazy(() => import('./MobileTimesheet'));
const MobileToolboxTalk    = lazy(() => import('./MobileToolboxTalk'));
const Documents            = lazy(() => import('../modules/Documents'));
const AIAssistant          = lazy(() => import('../modules/AIAssistant'));
const Settings             = lazy(() => import('../modules/Settings'));

interface MobileShellProps {
  activeModule: Module;
  setModule: (m: Module) => void;
}

function ModuleLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function renderMobileModule(module: Module, setModule: (m: Module) => void) {
  switch (module) {
    case 'daily-reports': return <MobileDailyReport />;
    case 'safety':        return <MobileSafetyIncident />;
    case 'punch-list':    return <MobilePunchList />;
    case 'timesheets':    return <MobileTimesheet />;
    case 'field-view':    return <MobileToolboxTalk />;
    case 'documents':     return <Documents />;
    case 'settings':      return <Settings />;
    case 'ai-assistant':  return <AIAssistant />;
    default:              return <MobileHome onNavigate={setModule} />;
  }
}

export function MobileShell({ activeModule, setModule }: MobileShellProps) {
  useEffect(() => initSync(), []);
  const { showBanner, isIos, install, dismiss } = useInstallPrompt();

  return (
    <div className="flex min-h-0 flex-col h-dvh bg-slate-900 text-white overflow-hidden">
      <MobileTopBar />
      <OfflineBanner />
      {showBanner && (
        <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">🏗️</div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-100 text-xs font-semibold">Install CortexBuild</div>
            <div className="text-slate-400 text-[10px]">
              {isIos ? 'Tap Share → Add to Home Screen' : 'Add to home screen for offline access'}
            </div>
          </div>
          {!isIos && (
            <button type="button" onClick={install} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">
              Install
            </button>
          )}
          <button type="button" onClick={dismiss} className="text-slate-500 text-lg leading-none">×</button>
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ModuleNavigationProvider navigate={setModule}>
          <Suspense fallback={<ModuleLoader />}>
            {activeModule === 'dashboard'
              ? <MobileHome onNavigate={setModule} />
              : renderMobileModule(activeModule, setModule)}
          </Suspense>
        </ModuleNavigationProvider>
      </main>
      <Suspense fallback={null}>
        <MobileBottomNav
          activeModule={activeModule}
          onModuleChange={setModule}
        />
      </Suspense>
    </div>
  );
}
