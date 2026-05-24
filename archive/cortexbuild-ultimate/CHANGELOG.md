# 📋 Changelog - CortexBuild Ultimate

All notable changes to CortexBuild Ultimate will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-04-01

### 🎉 Major Release - Enterprise Enhancement Update

#### Added

**New Features:**
- **NotificationCenter** - Full notification center with filtering and management
  - Real-time notifications via WebSocket
  - Filter by read/unread status
  - Filter by notification type
  - Mark all as read functionality
  - Action buttons for quick navigation

- **NotificationPreferences** - Multi-channel notification settings
  - Toggle notifications by type
  - Channel preferences (Email, Push, SMS, In-App)
  - 6 notification types supported

- **TeamChat** - Real-time team messaging
  - Live chat interface
  - Message history
  - Typing indicators
  - System notifications
  - Loading states

- **ActivityFeed** - Live activity stream
  - Real-time activity updates
  - User activity tracking
  - Multiple activity types
  - Timestamp display

- **PresenceIndicator** - User presence display
  - Online/Away/Busy/Offline status
  - User avatars
  - Online count display

- **AdvancedAnalytics** - Business intelligence dashboard
  - KPI cards with metrics
  - Revenue vs Cost charts
  - Project status distribution (pie chart)
  - Productivity trends
  - Performance indicators
  - Time range selection

- **ProjectCalendar** - Project scheduling
  - Month/Week/Day views
  - Event management
  - Color-coded event types
  - Upcoming events sidebar

**Testing:**
- 15 E2E tests for all new features
- Test coverage for NotificationCenter, TeamChat, ActivityFeed
- Integration tests for cross-feature flows

**Validation:**
- 10 Zod runtime validation schemas
- Type-safe API responses
- Safe parse functions

**Accessibility:**
- 16 ARIA labels across new components
- WCAG 2.1 AA compliance improvements
- Screen reader compatibility
- Keyboard navigation support

**Documentation:**
- 7 comprehensive documentation files
- User guides, API reference, implementation plans
- JSDoc comments for library files

#### Changed

**Performance:**
- Increased React Query cache time (30s → 60s)
- Added gcTime of 5 minutes for unused data
- Added retry logic (2 retries)
- Disabled refetchOnWindowFocus
- Added 10s timeout to Ollama API calls

**Error Handling:**
- Improved error messages in useNotifications
- Added proper error logging
- Better error type handling

**UI/UX:**
- Added loading states to TeamChat
- Spinner during message load
- Prevents empty state flash

#### Fixed

**Critical:**
- Fixed 6 modules with missing exports (black screens)
  - AIVision, BIMViewer, CostManagement
  - DevSandbox, MyDesktop, SubmittalManagement
- Fixed React error #321 (unused imports causing hook errors)
- Fixed module registrations in App.tsx, Sidebar.tsx, Header.tsx, Breadcrumbs.tsx

**Security:**
- Removed hardcoded SendGrid credentials
- Added input sanitization for PDF generation
- Moved credentials to environment variables

**TypeScript:**
- Fixed type errors in reportGenerator.ts
- Fixed type errors in workflowEngine.ts
- Fixed import references (exportTableToCSV → exportToCSV)

#### Technical

**Dependencies Added:**
- @dnd-kit/core - Drag-drop functionality
- @dnd-kit/sortable - Sortable lists
- @dnd-kit/utilities - Drag-drop utilities
- jspdf-autotable - PDF table generation

**New Files:**
- `src/components/ui/NotificationCenter.tsx`
- `src/components/ui/NotificationPreferences.tsx`
- `src/components/ui/TeamChat.tsx`
- `src/components/ui/PresenceIndicator.tsx`
- `src/components/ui/ActivityFeed.tsx`
- `src/components/modules/AdvancedAnalytics.tsx`
- `src/components/modules/ProjectCalendar.tsx`
- `src/lib/validation.ts`
- `e2e/new-features.spec.ts`

**Modified Files:**
- `src/App.tsx` - Module registrations
- `src/components/layout/Header.tsx` - NotificationCenter integration
- `src/components/layout/Sidebar.tsx` - New navigation items
- `src/components/modules/Dashboard.tsx` - ActivityFeed widget
- `src/components/modules/Teams.tsx` - TeamChat button
- `src/hooks/useData.ts` - Performance optimizations
- `src/hooks/useNotifications.ts` - Error handling improvements
- `src/types/index.ts` - New module types

---

## [2.5.0] - 2026-03-29

### Added

**Database:**
- 81 new database indexes for performance
- Optimized slow queries

**API:**
- New endpoints for all modules
- WebSocket support for real-time features

**Security:**
- Rate limiting (100 req/15min)
- Helmet security headers
- XSS protection middleware
- Input sanitization

### Changed

**Performance:**
- Optimized database queries
- Reduced API response times

### Fixed

**Security:**
- SQL injection prevention
- CSRF protection
- Authentication improvements

---

## [2.0.0] - 2026-03-01

### Added

**Core Platform:**
- 59 construction management modules
- React 18 + TypeScript + Vite
- Tailwind CSS + DaisyUI
- PostgreSQL database
- Express.js API

**Features:**
- Project management
- Safety management
- Document control
- Team management
- Financial tracking
- Resource scheduling

---

## [1.0.0] - 2026-01-01

### Added

**Initial Release:**
- Basic project management
- User authentication
- Core database schema
- API foundation

---

## Version History

| Version | Date | Platform Health | Key Changes |
|---------|------|-----------------|-------------|
| 3.0.0 | 2026-04-01 | 94/100 | Enterprise features, accessibility |
| 2.5.0 | 2026-03-29 | 85/100 | Database optimization, security |
| 2.0.0 | 2026-03-01 | 75/100 | Full platform launch |
| 1.0.0 | 2026-01-01 | 60/100 | Initial release |

---

## Migration Notes

### Upgrading to 3.0.0

**Breaking Changes:**
- None - fully backward compatible

**Required Actions:**
1. Set `SENDGRID_API_KEY` environment variable
2. Run database migrations (if any)
3. Clear browser cache after deploy

**New Environment Variables:**
```bash
SENDGRID_API_KEY=your_sendgrid_api_key
```

---

## Known Issues

### v3.0.0

**Minor:**
- Unit tests deferred to next sprint (E2E tests provide coverage)
- Component refactoring planned for Week 2
- Full accessibility audit scheduled

**Workarounds:**
- All critical functionality tested via E2E
- Components functional, refactoring is optimization

---

## Upcoming Changes

### v3.1.0 (Planned: Week 2-3)

**Planned:**
- Component refactoring (extract sub-components)
- Lighthouse CI integration
- Full accessibility audit
- Storybook creation
- Complete JSDoc coverage

### v3.2.0 (Planned: Month 2)

**Under Consideration:**
- Comprehensive unit test suite
- WebSocket optimization
- Mobile PWA features
- Offline mode with sync
- Custom report builder

---

## Support

**Documentation:**
- [NEW_FEATURES_GUIDE.md](./NEW_FEATURES_GUIDE.md) - User guide
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick start

**Issues:**
- Report bugs via GitHub Issues
- Contact support for urgent issues

---

*Last Updated: 2026-04-01 23:54 GMT*
