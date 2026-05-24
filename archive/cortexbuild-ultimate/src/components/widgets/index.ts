/**
 * Dashboard Widgets System
 *
 * Comprehensive collection of reusable dashboard widgets for CortexBuild Ultimate.
 * All widgets support dark theme, configurable sizes, loading states, and refresh capability.
 *
 * @packageDocumentation
 */

// StatsCard Widget
export {
  StatsCard,
  type StatsCardProps,
  type StatsCardColor,
  type StatsCardSize,
  type TrendDirection,
} from './StatsCard';

// ActivityFeedWidget
export {
  ActivityFeedWidget,
  type ActivityFeedWidgetProps,
  type Activity,
  type ActivityType,
  type ActivitySize,
} from './ActivityFeedWidget';

// ProjectProgressWidget
export {
  ProjectProgressWidget,
  type ProjectProgressWidgetProps,
  type ProjectProgressData,
  type RiskLevel,
  type TimelineStatus,
  type ProjectProgressSize,
} from './ProjectProgressWidget';

// TaskSummaryWidget
export {
  TaskSummaryWidget,
  type TaskSummaryWidgetProps,
  type Task,
  type TaskStatus,
  type Priority,
  type TaskSummarySize,
} from './TaskSummaryWidget';

// SafetyMetricsWidget
export {
  SafetyMetricsWidget,
  type SafetyMetricsWidgetProps,
  type SafetyMetricsData,
  type SafetyInspection,
  type SafetyIncident,
  type Severity,
  type InspectionStatus,
  type SafetyMetricsSize,
} from './SafetyMetricsWidget';

// FinancialOverviewWidget
export {
  FinancialOverviewWidget,
  type FinancialOverviewWidgetProps,
  type FinancialData,
  type Invoice,
  type InvoiceStatus,
  type CashFlowTrend,
  type FinancialOverviewSize,
} from './FinancialOverviewWidget';

// WeatherWidget
export {
  WeatherWidget,
  type WeatherWidgetProps,
  type WeatherData,
  type WeatherAlert,
  type DailyForecast,
  type WeatherCondition,
  type AlertLevel,
  type WeatherSize,
} from './WeatherWidget';

// TeamPresenceWidget
export {
  TeamPresenceWidget,
  type TeamPresenceWidgetProps,
  type TeamPresenceData,
  type TeamMember,
  type PresenceStatus,
  type Role,
  type TeamPresenceSize,
} from './TeamPresenceWidget';

// DocumentUpdatesWidget
export {
  DocumentUpdatesWidget,
  type DocumentUpdatesWidgetProps,
  type DocumentUpdatesData,
  type Document,
  type DocumentType,
  type DocumentStatus,
  type DocumentCategory,
  type DocumentUpdatesSize,
} from './DocumentUpdatesWidget';

// DeadlinesWidget
export {
  DeadlinesWidget,
  type DeadlinesWidgetProps,
  type DeadlinesData,
  type Deadline,
  type DeadlineType,
  type DeadlineStatus,
  type DeadlinesSize,
} from './DeadlinesWidget';
