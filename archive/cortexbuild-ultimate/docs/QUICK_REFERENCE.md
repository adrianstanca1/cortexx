# CortexBuild Ultimate - Quick Reference

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+K | Open command palette |
| Ctrl+1-4 | Navigate to modules |
| Ctrl+B | Toggle sidebar |
| Shift+? | Show help |

## New Components
```tsx
// Notifications
import { NotificationCenter } from './components/ui/NotificationCenter';
import { NotificationPreferences } from './components/ui/NotificationPreferences';

// Calendar
import { ProjectCalendar } from './components/modules/ProjectCalendar';

// Analytics
import { AdvancedAnalytics } from './components/modules/AdvancedAnalytics';

// Collaboration
import { TeamChat } from './components/ui/TeamChat';
import { PresenceIndicator } from './components/ui/PresenceIndicator';
import { ActivityFeed } from './components/ui/ActivityFeed';
```

## New Hooks
```tsx
import { useOptimizedData } from './hooks/useOptimizedData';
import { useCollaborativeEditor } from './hooks/useCollaborativeEditor';
```

## New Utilities

> **Note:** Legacy examples referencing `integrations`, `workflowEngine`, and `aiSearch` under `src/lib/` are removed. Use `src/services/api.ts`, `src/hooks/useData.ts`, and `src/lib/validations.ts` for current patterns.

```tsx
import { exportToPDF, exportTableToCSV } from './lib/exportUtils';
import { reportGenerator } from './lib/reportGenerator';
```

## Export Examples
```tsx
// PDF Export
exportToPDF({
  filename: 'report.pdf',
  title: 'Project Report',
  columns: [{ header: 'Name', key: 'name' }],
  data: projects,
});

// CSV Export
exportTableToCSV(invoices, 'invoices.csv');

// Report Generation
await reportGenerator.download({
  title: 'Monthly Report',
  sections: [...],
}, 'monthly-report.pdf');
```
