import {
  useState,
  lazy,
  Suspense,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { MobileShell } from "./components/mobile/MobileShell";
import { useIsMobile } from "./hooks/useIsMobile";
import { Toaster } from "sonner";
import { Sidebar } from "./components/layout/Sidebar";
import { BlueprintBackground } from "./components/layout/BlueprintBackground";
import { Header } from "./components/layout/Header";
import { ThemeProvider } from "./context/ThemeContext";
import { ModuleNavigationProvider } from "./context/ModuleNavigationContext";
import { type Module } from "./types";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import {
  useKeyboardShortcuts,
  DEFAULT_SHORTCUTS,
} from "./hooks/useKeyboardShortcuts";
import LoginPage from "./components/auth/LoginPage";
import { OAuthCallback } from "./components/auth/OAuthCallback";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { agentDebugLog } from "@/lib/agentDebugLog";
import { CommandPalette } from "./components/ui/CommandPalette";

// Layout components kept eager — always rendered
import { NotificationsPanel } from "./components/layout/NotificationsPanel";
import { ShortcutsHelp } from "./components/layout/ShortcutsHelp";
import { MobileNav } from "./components/layout/MobileNav";
import { QuickActionsHUD } from "./components/layout/QuickActionsHUD";

// ── All modules now have default exports ──────────────────────────────────
const Dashboard = lazy(() => import("./components/modules/Dashboard"));
const Projects = lazy(() => import("./components/modules/projects"));
const Invoicing = lazy(() => import("./components/modules/Invoicing"));
const Accounting = lazy(() => import("./components/modules/Accounting"));
const FinancialReports = lazy(
  () => import("./components/modules/FinancialReports"),
);
const Procurement = lazy(() => import("./components/modules/Procurement"));
const RAMS = lazy(() => import("./components/modules/RAMS"));
const CIS = lazy(() => import("./components/modules/CIS"));
const SiteOperations = lazy(
  () => import("./components/modules/SiteOperations"),
);
const Teams = lazy(() => import("./components/modules/Teams"));
const Tenders = lazy(() => import("./components/modules/Tenders"));
const Analytics = lazy(() => import("./components/modules/Analytics"));
const Safety = lazy(() => import("./components/modules/Safety"));
const FieldView = lazy(() => import("./components/modules/FieldView"));
const CRM = lazy(() => import("./components/modules/CRM"));
const Documents = lazy(() => import("./components/modules/Documents"));
const Timesheets = lazy(() => import("./components/modules/Timesheets"));
const PlantEquipment = lazy(
  () => import("./components/modules/PlantEquipment"),
);
const Subcontractors = lazy(
  () => import("./components/modules/Subcontractors"),
);
const AIAssistant = lazy(() => import("./components/modules/AIAssistant"));
const RFIs = lazy(() => import("./components/modules/RFIs"));
const ChangeOrders = lazy(() => import("./components/modules/ChangeOrders"));
const PunchList = lazy(() => import("./components/modules/PunchList"));
const Inspections = lazy(() => import("./components/modules/Inspections"));
const RiskRegister = lazy(() => import("./components/modules/RiskRegister"));
const Drawings = lazy(() => import("./components/modules/Drawings"));
const Meetings = lazy(() => import("./components/modules/Meetings"));
const Materials = lazy(() => import("./components/modules/Materials"));
const DailyReports = lazy(() => import("./components/modules/DailyReports"));
const Marketplace = lazy(() => import("./components/modules/Marketplace"));
const Settings = lazy(() => import("./components/modules/Settings"));
const Insights = lazy(() => import("./components/modules/Insights"));
const ExecutiveReports = lazy(
  () => import("./components/modules/ExecutiveReports"),
);
const PredictiveAnalytics = lazy(
  () => import("./components/modules/PredictiveAnalytics"),
);
const Calendar = lazy(() => import("./components/modules/Calendar"));
const GlobalSearch = lazy(() => import("./components/modules/GlobalSearch"));
const AuditLog = lazy(() => import("./components/modules/AuditLog"));
const Variations = lazy(() => import("./components/modules/Variations"));
const Defects = lazy(() => import("./components/modules/Defects"));
const Valuations = lazy(() => import("./components/modules/Valuations"));
const Specifications = lazy(
  () => import("./components/modules/Specifications"),
);
const TempWorks = lazy(() => import("./components/modules/TempWorks"));
const Signage = lazy(() => import("./components/modules/Signage"));
const WasteManagement = lazy(
  () => import("./components/modules/WasteManagement"),
);
const Sustainability = lazy(
  () => import("./components/modules/Sustainability"),
);
const Training = lazy(() => import("./components/modules/Training"));
const Certifications = lazy(
  () => import("./components/modules/Certifications"),
);
const Prequalification = lazy(
  () => import("./components/modules/prequalification"),
);
const Lettings = lazy(() => import("./components/modules/Lettings"));
const Measuring = lazy(() => import("./components/modules/Measuring"));
const EmailHistory = lazy(() => import("./components/modules/EmailHistory"));
const PermissionsManager = lazy(
  () => import("./components/modules/PermissionsManager"),
);
const ReportTemplates = lazy(
  () => import("./components/modules/ReportTemplates"),
);
const BIMViewer = lazy(() => import("./components/modules/BIMViewer"));
const CostManagement = lazy(
  () => import("./components/modules/CostManagement"),
);
const SubmittalManagement = lazy(
  () => import("./components/modules/SubmittalManagement"),
);
const MaintenanceSchedules = lazy(
  () => import("./components/modules/MaintenanceSchedules"),
);
const ProjectTemplates = lazy(
  () => import("./components/modules/ProjectTemplates"),
);
const DevSandbox = lazy(() => import("./components/modules/DevSandbox"));
const AIVision = lazy(() => import("./components/modules/AIVision"));
const ClientPortal = lazy(() => import("./components/modules/ClientPortal"));
const Webhooks = lazy(() => import("./components/modules/Webhooks"));
const CarbonEstimating = lazy(
  () => import("./components/modules/CarbonEstimating"),
);
const Tasks = lazy(() => import("./components/modules/Tasks"));
const SiteInspections = lazy(
  () => import("./components/modules/SiteInspections"),
);
const BIM4D = lazy(() => import("./components/modules/BIM4D"));
const MyDesktop = lazy(() => import("./components/modules/MyDesktop"));
const AdvancedAnalytics = lazy(
  () => import("./components/modules/AdvancedAnalytics"),
);
const ProjectCalendar = lazy(
  () => import("./components/modules/ProjectCalendar"),
);
const AdminDashboard = lazy(
  () => import("./components/modules/AdminDashboard"),
);
const TeamChat = lazy(() => import("./components/modules/TeamChat"));
const ActivityFeed = lazy(() => import("./components/modules/ActivityFeed"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const SettingsMfa = lazy(() => import("./pages/SettingsMfa").then(m => ({ default: () => <m.SettingsMfa /> })));
const ApiKeysManager = lazy(() => import("./components/modules/ApiKeysManager"));
const Permits = lazy(() => import("./components/modules/Permits"));
const Suppliers = lazy(() => import("./components/modules/Suppliers"));

/** Themes that use dark chrome for toasts / loading surfaces */
const DARK_CHROME_THEMES = new Set([
  "dark",
  "cortexbuild",
  "corporate",
  "synthwave",
  "cyberpunk",
  "dracula",
  "nord",
  "ocean",
]);

function isDarkChromeTheme(theme: string | undefined): boolean {
  return theme ? DARK_CHROME_THEMES.has(theme) : false;
}

const ModuleLoader = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "20px",
      height: "calc(100vh - 200px)",
    }}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    {/* Blueprint crosshair spinner */}
    <div style={{ position: "relative", width: "52px", height: "52px" }}>
      {/* Outer ring */}
      <svg
        viewBox="0 0 52 52"
        fill="none"
        style={{
          position: "absolute",
          inset: 0,
          animation: "spin-slow 2s linear infinite",
        }}
      >
        <circle
          cx="26"
          cy="26"
          r="23"
          stroke="rgba(245,158,11,0.12)"
          strokeWidth="2"
        />
        <path
          d="M 26 3 A 23 23 0 0 1 49 26"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="36 108"
        />
      </svg>
      {/* Inner crosshair */}
      <svg
        viewBox="0 0 52 52"
        fill="none"
        style={{
          position: "absolute",
          inset: 0,
          animation: "spin-slow 1.2s linear infinite reverse",
        }}
      >
        <circle
          cx="26"
          cy="26"
          r="10"
          stroke="rgba(245,158,11,0.3)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="26"
          y1="12"
          x2="26"
          y2="20"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="26"
          y1="32"
          x2="26"
          y2="40"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="12"
          y1="26"
          x2="20"
          y2="26"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="26"
          x2="40"
          y2="26"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="26" cy="26" r="2.5" fill="#f59e0b" />
      </svg>
      {/* Center dot pulse */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#f59e0b",
          animation: "pulse-glow 1.5s ease-in-out infinite",
        }}
      />
    </div>
    {/* Loading text */}
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "13px",
          letterSpacing: "0.3em",
          color: "#64748b",
          textTransform: "uppercase",
          animation: "fade-in 0.4s ease-out",
        }}
      >
        Loading Module
      </div>
      <div
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: "9px",
          color: "#334155",
          letterSpacing: "0.1em",
          marginTop: "4px",
        }}
      >
        Initialising workspace...
      </div>
    </div>
    <span className="sr-only">Loading module</span>
  </div>
);

function MobileShellWrapper() {
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  return (
    <MobileShell activeModule={activeModule} setModule={setActiveModule} />
  );
}

function AppShell() {
  const { token } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const toggleSearch = useCallback(() => setShowGlobalSearch((p) => !p), []);
  const toggleCommandPalette = useCallback(
    () => setShowCommandPalette((p) => !p),
    [],
  );

  useKeyboardShortcuts(
    useMemo(
      () => [
        {
          ...DEFAULT_SHORTCUTS.goToDashboard,
          handler: () => setActiveModule("dashboard"),
        },
        {
          ...DEFAULT_SHORTCUTS.goToProjects,
          handler: () => setActiveModule("projects"),
        },
        {
          ...DEFAULT_SHORTCUTS.goToInvoicing,
          handler: () => setActiveModule("invoicing"),
        },
        {
          ...DEFAULT_SHORTCUTS.goToSafety,
          handler: () => setActiveModule("safety"),
        },
        {
          ...DEFAULT_SHORTCUTS.goToSettings,
          handler: () => setActiveModule("settings"),
        },
        {
          ...DEFAULT_SHORTCUTS.goToAnalytics,
          handler: () => setActiveModule("analytics"),
        },
        {
          ...DEFAULT_SHORTCUTS.goToCalendar,
          handler: () => setActiveModule("calendar"),
        },
        {
          ...DEFAULT_SHORTCUTS.toggleSidebar,
          handler: () => setSidebarCollapsed((p) => !p),
        },
        {
          ...DEFAULT_SHORTCUTS.showHelp,
          handler: () => setShowShortcuts(true),
        },
        { ...DEFAULT_SHORTCUTS.commandPalette, handler: toggleCommandPalette },
        { ...DEFAULT_SHORTCUTS.search, handler: toggleSearch },
        {
          ...DEFAULT_SHORTCUTS.openNotifications,
          handler: () => setActiveModule("notifications"),
        },
      ],
      [toggleCommandPalette, toggleSearch],
    ),
  );

  useEffect(() => {
    agentDebugLog({
      hypothesisId: "H2",
      location: "App.tsx:activeModule",
      message: "module changed",
      data: { activeModule },
    });
  }, [activeModule]);

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <Dashboard />;
      case "projects":
        return <Projects />;
      case "invoicing":
        return <Invoicing />;
      case "accounting":
        return <Accounting />;
      case "financial-reports":
        return <FinancialReports />;
      case "procurement":
        return <Procurement />;
      case "rams":
        return <RAMS />;
      case "cis":
        return <CIS />;
      case "site-ops":
        return <SiteOperations />;
      case "teams":
        return <Teams />;
      case "tenders":
        return <Tenders />;
      case "analytics":
        return <Analytics />;
      case "advanced-analytics":
        return <AdvancedAnalytics />;
      case "project-calendar":
        return <ProjectCalendar />;
      case "safety":
        return <Safety />;
      case "field-view":
        return <FieldView />;
      case "crm":
        return <CRM />;
      case "documents":
        return <Documents />;
      case "timesheets":
        return <Timesheets />;
      case "plant":
        return <PlantEquipment />;
      case "subcontractors":
        return <Subcontractors />;
      case "ai-assistant":
        return <AIAssistant />;
      case "rfis":
        return <RFIs />;
      case "change-orders":
        return <ChangeOrders />;
      case "punch-list":
        return <PunchList />;
      case "inspections":
        return <Inspections />;
      case "risk-register":
        return <RiskRegister />;
      case "drawings":
        return <Drawings />;
      case "meetings":
        return <Meetings />;
      case "materials":
        return <Materials />;
      case "daily-reports":
        return <DailyReports />;
      case "marketplace":
        return <Marketplace />;
      case "settings":
        return <Settings />;
      case "insights":
        return <Insights />;
      case "notifications":
        return (
          <NotificationsPanel
            authToken={token}
            onClose={() => setActiveModule("dashboard")}
          />
        );
      case "executive-reports":
        return <ExecutiveReports />;
      case "predictive-analytics":
        return <PredictiveAnalytics />;
      case "calendar":
        return <Calendar />;
      case "search":
        return (
          <GlobalSearch embedded onClose={() => setActiveModule("dashboard")} />
        );
      case "audit-log":
        return <AuditLog />;
      case "variations":
        return <Variations />;
      case "defects":
        return <Defects />;
      case "valuations":
        return <Valuations />;
      case "specifications":
        return <Specifications />;
      case "temp-works":
        return <TempWorks />;
      case "signage":
        return <Signage />;
      case "waste-management":
        return <WasteManagement />;
      case "sustainability":
        return <Sustainability />;
      case "training":
        return <Training />;
      case "certifications":
        return <Certifications />;
      case "prequalification":
        return <Prequalification />;
      case "lettings":
        return <Lettings />;
      case "measuring":
        return <Measuring />;
      case "email-history":
        return <EmailHistory />;
      case "permissions":
        return <PermissionsManager />;
      case "report-templates":
        return <ReportTemplates />;
      case "bim-viewer":
        return <BIMViewer />;
      case "cost-management":
        return <CostManagement />;
      case "submittal-management":
        return <SubmittalManagement />;
      case "maintenance-schedules":
        return <MaintenanceSchedules />;
      case "project-templates":
        return <ProjectTemplates />;
      case "dev-sandbox":
        return <DevSandbox />;
      case "ai-vision":
        return <AIVision />;
      case "my-desktop":
        return <MyDesktop />;
      case "client-portal":
        return <ClientPortal />;
      case "webhooks":
        return <Webhooks />;
      case "carbon-estimating":
        return <CarbonEstimating />;
      case "site-inspections":
        return <SiteInspections />;
      case "bim-4d":
        return <BIM4D />;
      case "admin-dashboard":
        return <AdminDashboard />;
      case "team-chat":
        return <TeamChat />;
      case "activity-feed":
        return <ActivityFeed />;
      case "billing":
        return <BillingPage />;
      case "settings-mfa":
        return <SettingsMfa />;
      case "api-keys":
        return <ApiKeysManager />;
      case "permits":
        return <Permits />;
      case "suppliers":
        return <Suppliers />;
      case "tasks":
        return <Tasks />;
      default:
        return <Dashboard />;
    }
  };

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div
        className="flex h-screen overflow-hidden"
        style={{ position: "relative" }}
      >
        <BlueprintBackground />
        {/* Sidebar — always visible on desktop, mobile uses drawer */}
        <div
          className="flex flex-shrink-0"
          style={{ position: "relative", zIndex: 1 }}
        >
          <Sidebar
            activeModule={activeModule}
            setModule={setActiveModule}
            collapsed={sidebarCollapsed}
            setCollapsed={setSidebarCollapsed}
          />
        </div>
        <div
          className="flex min-h-0 flex-col flex-1 overflow-hidden min-w-0"
          style={{ position: "relative", zIndex: 1 }}
        >
          {!isOnline && (
            <div
              role="status"
              aria-live="polite"
              className="bg-yellow-500 text-black px-4 py-2 text-sm text-center font-medium"
            >
              You&apos;re offline. Some features may not work.
            </div>
          )}
          <Header
            activeModule={activeModule}
            onMenuToggle={() => {
              if (window.innerWidth < 768) {
                setMobileMenuOpen((p) => !p);
              } else {
                setSidebarCollapsed((p) => !p);
              }
            }}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-auto outline-none"
            style={{
              backgroundAttachment: "fixed",
              paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mx-auto w-full max-w-[1920px] p-5 md:p-8 stagger-1">
              <div className="module-stage mx-auto w-full max-w-[1680px] min-w-0 space-y-1">
                <ModuleNavigationProvider navigate={setActiveModule}>
                  <Suspense fallback={<ModuleLoader />}>
                    {renderModule()}
                  </Suspense>
                </ModuleNavigationProvider>
              </div>
            </div>
          </main>
        </div>
      </div>
      {/* Mobile sidebar drawer */}
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] md:hidden bg-slate-950/60 backdrop-blur-sm border-0 p-0 cursor-pointer"
            aria-label="Close navigation menu"
            onClick={closeMobileMenu}
          />
          <div
            className="mobile-nav-drawer md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 60,
              width: "280px",
              overflowY: "auto",
            }}
          >
            <Sidebar
              activeModule={activeModule}
              setModule={(m) => {
                setActiveModule(m);
                setMobileMenuOpen(false);
              }}
              collapsed={false}
              setCollapsed={() => {}}
            />
          </div>
        </>
      )}
      <QuickActionsHUD
        currentModule={activeModule}
        onAction={(m) => setActiveModule(m as Module)}
      />
      <ShortcutsHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
      <MobileNav activeModule={activeModule} setModule={setActiveModule} />
      {showGlobalSearch && (
        <Suspense fallback={null}>
          <GlobalSearch onClose={() => setShowGlobalSearch(false)} />
        </Suspense>
      )}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(m) => {
          setActiveModule(m);
          setShowCommandPalette(false);
        }}
      />
    </>
  );
}

function ThemedApp() {
  const { isAuthenticated, loading, user } = useAuth();
  const { resolvedTheme } = useTheme();

  const isMobile = useIsMobile();
  const showMobile = user?.role === "field_worker" || isMobile;

  useEffect(() => {
    // #region agent log
    agentDebugLog({
      hypothesisId: "H4",
      location: "App.tsx:ThemedApp",
      message: "shell gate state",
      data: { loading, isAuthenticated },
    });
    // #endregion
  }, [loading, isAuthenticated]);

  // Check for OAuth callback route
  const isOAuthCallback =
    typeof window !== "undefined" &&
    window.location.pathname === "/auth/callback";

  if (isOAuthCallback) {
    return <OAuthCallback />;
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#090b0f",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
        }}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {/* Large logo spinner */}
        <div style={{ position: "relative", width: "80px", height: "80px" }}>
          <svg
            viewBox="0 0 80 80"
            fill="none"
            style={{
              position: "absolute",
              inset: 0,
              animation: "spin-slow 3s linear infinite",
            }}
          >
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="rgba(245,158,11,0.08)"
              strokeWidth="2"
            />
            <path
              d="M 40 4 A 36 36 0 0 1 76 40"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="56 170"
            />
          </svg>
          <svg
            viewBox="0 0 80 80"
            fill="none"
            style={{
              position: "absolute",
              inset: 0,
              animation: "spin-slow 2s linear infinite reverse",
            }}
          >
            <circle
              cx="40"
              cy="40"
              r="22"
              stroke="rgba(245,158,11,0.15)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <circle cx="40" cy="40" r="4" fill="#f59e0b" fillOpacity="0.8" />
          </svg>
          {/* Pulse rings */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#f59e0b",
              animation: "pulse-glow 2s ease-in-out infinite",
            }}
          />
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "22px",
              letterSpacing: "0.35em",
              color: "#f59e0b",
              textTransform: "uppercase",
            }}
          >
            CortexBuild
          </div>
          <div
            style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: "10px",
              color: "#334155",
              letterSpacing: "0.2em",
              marginTop: "6px",
            }}
          >
            INITIALISING WORKSPACE
          </div>
        </div>
        <span className="sr-only">Application is loading</span>
      </div>
    );
  }

  const darkChrome = isDarkChromeTheme(resolvedTheme);

  return (
    <ErrorBoundary>
      <Toaster
        theme={darkChrome ? "dark" : "light"}
        position="top-right"
        closeButton
        containerAriaLabel="Notifications"
        toastOptions={{
          style: {
            background: darkChrome ? "#1f2937" : "#ffffff",
            border: "1px solid #374151",
            color: darkChrome ? "#f9fafb" : "#1f2937",
          },
        }}
      />
      {isAuthenticated ? (
        showMobile ? (
          <MobileShellWrapper />
        ) : (
          <AppShell />
        )
      ) : (
        <LoginPage />
      )}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
