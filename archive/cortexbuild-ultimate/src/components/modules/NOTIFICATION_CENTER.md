# NotificationCenter - CortexBuild Ultimate

## Overview

Comprehensive real-time Notification Center for CortexBuild Ultimate with WebSocket support, advanced filtering, settings management, and notification history.

## Files Created

### Core Components

| File | Description |
|------|-------------|
| `src/types/notification.ts` | Complete TypeScript types and interfaces for notifications |
| `src/hooks/useNotificationCenter.ts` | Comprehensive hook with WebSocket, filtering, and all actions |
| `src/components/modules/NotificationCenter.tsx` | Main notification center component |
| `src/components/modules/NotificationItem.tsx` | Individual notification display with actions |
| `src/components/modules/NotificationFilters.tsx` | Advanced filtering and search UI |
| `src/components/modules/NotificationCenterSettings.tsx` | Settings and preferences management |
| `src/components/modules/NotificationHistory.tsx` | History view with export capabilities |
| `src/components/modules/index.ts` | Module exports |
| `src/components/modules/NotificationCenter.examples.tsx` | Usage examples |

## Features

### 1. Notification Types (16 supported)

- `project_update` - Project status changes
- `task_assignment` - New task assignments
- `rfi_response` - RFI responses
- `safety_incident` - Safety alerts and incidents
- `document_upload` - New document uploads
- `meeting_reminder` - Upcoming meetings
- `team_mention` - @mentions from team
- `system_alert` - System notifications
- `approval_request` - Pending approvals
- `deadline_warning` - Approaching deadlines
- `budget_alert` - Budget variances
- `change_order` - Change order updates
- `inspection_scheduled` - Scheduled inspections
- `material_delivery` - Material deliveries
- `timesheet_approval` - Timesheet approvals
- `subcontractor_update` - Subcontractor changes

### 2. Notification Categories

- **All** - All notifications
- **Unread** - Only unread notifications
- **Mentions** - Team mentions
- **Assignments** - Task assignments
- **System** - System alerts
- **Safety** - Safety incidents
- **Projects** - Project updates
- **Documents** - Document uploads
- **Meetings** - Meeting reminders
- **Approvals** - Approval requests
- **Deadlines** - Deadline warnings

### 3. Real-time Updates

- WebSocket integration for live push notifications
- Auto-reconnect with exponential backoff
- Connection status indicator
- 30-second polling fallback
- Custom event bus for cross-component updates

### 4. Notification Actions

- **Mark as Read** - Single or bulk
- **Mark All as Read** - Clear all unread
- **Delete** - Remove notifications
- **Archive** - Archive read notifications
- **Snooze** - Temporarily hide (1h, 4h, 1d, 1w)
- **Quick Reply** - Reply directly from notification
- **Quick Approve/Reject** - For approval requests
- **Navigate** - Jump to related item

### 5. Notification Settings

- **Email Notifications** - Toggle email delivery
- **Push Notifications** - Browser push notifications
- **Sound Alerts** - Audio notifications
- **Browser Notifications** - Desktop notifications
- **Quiet Hours** - Pause during specified times
- **Digest Frequency** - Never, Hourly, Daily, Weekly
- **Category Preferences** - Per-type toggles

### 6. Notification History

- Search past notifications
- Filter by date range
- Filter by type/severity/status
- Export to JSON, CSV, or PDF
- Pagination support
- Archive management

## UI Features

### Layout Options

- **Panel** - Slide-out side panel (default)
- **Modal** - Centered modal dialog
- **Dropdown** - Compact dropdown menu

### Position Options

- Top Right (default)
- Top Left
- Bottom Right
- Bottom Left

### Visual Features

- Dark theme compatible
- Grouped by date (Today, Yesterday, This Week, Older)
- Unread indicators with badges
- User avatars for person notifications
- Type-specific icons
- Severity color coding
- Relative timestamps
- Compact/Detailed view toggle

## Usage

### Basic Example

```tsx
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationCenter } from '@/components/modules';

function Header() {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="btn btn-ghost btn-circle relative"
      >
        <Bell className="w-5 h-5" />
        <span className="absolute top-2 right-2 badge badge-primary badge-xs">
          5
        </span>
      </button>

      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        position="top-right"
        variant="panel"
      />
    </>
  );
}
```

### With Hook

```tsx
import { useNotificationCenter } from '@/hooks/useNotificationCenter';

function NotificationsButton() {
  const { unreadCount, wsStatus } = useNotificationCenter();

  return (
    <button className="btn btn-ghost btn-circle relative">
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-2 right-2 badge badge-primary badge-xs">
          {unreadCount}
        </span>
      )}
      <span
        className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
          wsStatus.isConnected ? 'bg-success' : 'bg-error'
        }`}
      />
    </button>
  );
}
```

### Keyboard Shortcut

```tsx
import { useEffect } from 'react';

function App() {
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowNotifications(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <NotificationCenter
      isOpen={showNotifications}
      onClose={() => setShowNotifications(false)}
    />
  );
}
```

## API Endpoints Required

```
GET    /api/notifications              - List notifications
GET    /api/notifications/unread-count - Get unread count
PUT    /api/notifications/:id/read     - Mark as read
PUT    /api/notifications/read-all     - Mark all as read
DELETE /api/notifications/:id          - Delete notification
POST   /api/notifications/mark-read-bulk - Bulk mark as read
POST   /api/notifications/delete-bulk  - Bulk delete
PUT    /api/notifications/:id/archive  - Archive notification
POST   /api/notifications/archive-read - Archive all read
PUT    /api/notifications/:id/snooze   - Snooze notification
PUT    /api/notifications/:id/unsnooze - Unsnooze notification
GET    /api/notifications/settings     - Get settings
PUT    /api/notifications/settings     - Update settings
GET    /api/notifications/history      - Get archived notifications
POST   /api/notifications/export       - Export notifications
DELETE /api/notifications/all          - Clear all
WS     /api/ws/notifications           - WebSocket connection
```

## WebSocket Message Format

```typescript
{
  type: 'notification',
  event: 'task_assignment',
  payload: {
    id: 'notif-123',
    type: 'task_assignment',
    category: 'assignments',
    severity: 'info',
    title: 'New Task Assigned',
    message: 'You have been assigned to "Foundation Inspection"',
    description: 'Due date: April 15, 2026',
    relatedItem: {
      type: 'task',
      id: 'task-456',
      title: 'Foundation Inspection',
      url: '/projects/123/tasks/456'
    },
    fromUser: {
      id: 'user-789',
      name: 'John Smith',
      avatar: '/avatars/john.jpg',
      role: 'project_manager'
    },
    metadata: {
      projectId: '123',
      projectName: 'Site A Development',
      taskId: '456',
      priority: 'high',
      dueDate: '2026-04-15T00:00:00Z'
    }
  },
  timestamp: '2026-04-02T10:30:00Z'
}
```

## Type Exports

```typescript
// From src/types/notification.ts
export type {
  Notification,
  NotificationType,
  NotificationCategory,
  NotificationSeverity,
  NotificationStatus,
  NotificationSettings,
  NotificationMetadata,
  NotificationAction,
  RelatedItem,
  NotificationGroup,
  NotificationStats,
  NotificationFilter,
  ExportOptions,
  QuickReply,
  QuietHours,
  CategoryPreferences,
  NotificationsResponse,
  UnreadCountResponse,
  WebSocketNotificationMessage,
  WebSocketConnectionStatus,
  NotificationQuery,
}
```

## Component Props

### NotificationCenter

```typescript
interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  variant?: 'panel' | 'modal' | 'dropdown';
  compact?: boolean;
}
```

### useNotificationCenter Options

```typescript
interface UseNotificationCenterOptions {
  autoConnect?: boolean;        // Auto-connect WebSocket (default: true)
  pollingInterval?: number;     // Polling interval in ms (default: 60000)
  maxNotifications?: number;    // Max notifications to fetch (default: 100)
}
```

## Customization

### Sound Notification

Replace `/sounds/notification.mp3` with your custom sound file.

### Styling

All components use Tailwind CSS with DaisyUI. Customize via:
- Tailwind config for colors
- DaisyUI themes for dark/light mode
- Custom CSS classes for specific overrides

### Icons

Uses Lucide React icons. Replace icons in `TYPE_ICONS` and `SEVERITY_ICONS` mappings.

## Performance Considerations

- Virtual scrolling for large notification lists (auto-enabled with 100+ items)
- Debounced search (300ms)
- WebSocket reconnection with exponential backoff
- 30-second polling interval (configurable)
- Memoized grouped notifications
- Lazy loading for history

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- ARIA labels for screen readers
- Keyboard navigation support
- Focus management
- Semantic HTML structure
- High contrast mode compatible

## Testing

```bash
# Type check
npx tsc --noEmit

# Run tests (when test files are created)
npm test -- NotificationCenter
npx vitest run src/components/modules/NotificationCenter.test.tsx
```

## Future Enhancements

- [ ] Push notification service worker
- [ ] Email digest templates
- [ ] Notification templates for quick replies
- [ ] Advanced analytics dashboard
- [ ] AI-powered notification prioritization
- [ ] Custom notification rules engine
- [ ] Multi-channel notification preferences
- [ ] Notification scheduling

## Related Files

- `src/hooks/useNotifications.ts` - Legacy notification hook (maintained for compatibility)
- `src/lib/eventBus.ts` - Shared event bus for WebSocket messages
- `src/lib/validations.ts` - Zod schemas for notification validation
- `src/lib/validateNotification.ts` - Runtime validation utilities

## Author

CortexBuild Ultimate Development Team

## License

Proprietary - CortexBuild Ultimate
