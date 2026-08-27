# CortexBuild Field — TODO

## Setup & Configuration
- [x] Configure theme colors (orange/navy construction brand)
- [x] Set up tab navigation (Dashboard, Projects, Field, AI, More)
- [x] Add all icon mappings to icon-symbol.tsx
- [x] Configure app.config.ts with CortexBuild Field branding
- [x] Generate and set app icon/logo

## Core Infrastructure
- [x] Create shared types and data models (lib/types.ts)
- [x] Set up mock data store for offline-first development (lib/mock-data.ts)
- [x] Create API client with tRPC backend integration
- [x] Create shared UI components (StatusBadge, ProgressBar, KPICard, SectionHeader)

## Dashboard Screen
- [x] Role-aware greeting with user name and role badge
- [x] KPI cards (Open Tasks, Active Permits, Hours This Week, Open Defects)
- [x] Active Projects horizontal scroll
- [x] Quick Actions grid (Log Report, Check In, Report Hazard, Ask AI)
- [x] Recent Activity feed
- [x] AI Agent quick access card
- [x] Live/Offline connection status banner

## Projects Module
- [x] Projects list screen with search and filter
- [x] Project cards with status, progress, deadline
- [x] Project detail screen with tabs (Overview, Tasks, Documents)
- [x] Task list with status grouping
- [x] Live data from database with offline fallback

## Field Operations Module
- [x] Field hub screen with check-in/check-out
- [x] Active permits summary
- [x] Recent incidents feed
- [x] Daily report form and history (daily-report.tsx)
- [x] GPS-based site check-in with geofencing (expo-location)

## Safety Module
- [x] Safety overview screen with stats
- [x] Incident list with severity badges
- [x] Permit to Work tracker
- [x] Quick Incident Report modal with photo capture
- [x] AI Photo Incident Analysis shortcut

## Timesheets Module
- [x] Weekly timesheet grid view
- [x] Hours summary (regular + overtime)
- [x] Timesheet history with approval status

## Defects / Snag List Module
- [x] Defects list with priority badges
- [x] Filter by status
- [x] Search functionality
- [x] Add Defect modal with photo capture (camera + gallery)
- [x] AI auto-fill from photo analysis
- [x] AI Defect Detection banner
- [x] Live data from database with offline fallback

## Teams Module
- [x] Team member list with roles and CSCS status
- [x] Member profile cards with contact actions
- [x] On-site status indicator

## AI Agent Module
- [x] Chat interface with real AI responses
- [x] 8 specialist agents (Safety, Cost, Scheduling, Defects, Contracts, Domain Expert, Valuations, Team)
- [x] Quick prompt chips per agent
- [x] Agent selector with live switching
- [x] Backend AI integration (tRPC + Forge LLM)

## Analytics Module
- [x] Cost breakdown with progress bars
- [x] Labour productivity bar chart
- [x] Project progress tracking
- [x] KPI summary cards

## Notifications
- [x] Notifications list with type icons
- [x] Mark as read / mark all read
- [x] Push notification registration and delivery
- [x] Backend push token registration

## Settings & Profile
- [x] User profile card
- [x] Notification preferences toggles
- [x] Privacy & security settings
- [x] App settings (dark mode, offline mode)
- [x] About / version info

## Enhancement: File Upload Infrastructure (v1.1)
- [x] Backend upload route (base64 → S3-compatible storage)
- [x] Backend file metadata route (list, delete)
- [x] File type detection and validation

## Enhancement: AI Photo Intelligence (v1.1)
- [x] AI Photo Analysis screen (photo-ai.tsx)
- [x] Camera capture and gallery picker
- [x] 4 analysis modes: Defect Detection, Safety Hazard, Progress Tracking, Material ID
- [x] Structured AI results with risk assessment, findings, and recommendations
- [x] Photo upload to server before AI analysis
- [x] Analysis history with expandable results

## Enhancement: Document Generator (v1.1)
- [x] Document Generator screen (documents.tsx)
- [x] RAMS generator with AI-assisted hazard identification
- [x] Toolbox Talk generator with topic selection
- [x] Invoice generator with line items and CIS deductions
- [x] Timesheet PDF export
- [x] Daily Report generator
- [x] Document preview and share via native Share sheet
- [x] Generated documents history

## Enhancement: File Vault (v1.1)
- [x] File Vault screen with 6 category tabs (All, Photos, Certificates, Payslips, Documents, RAMS)
- [x] Photo upload from camera or gallery
- [x] Document upload (PDF, Word, Excel, any file) via document picker
- [x] File search by name
- [x] File preview (images) and sharing
- [x] Delete files
- [x] Upload progress indicator

## Enhancement: Module Upgrades (v1.1)
- [x] Defects screen: photo capture and AI auto-fill
- [x] Safety screen: photo evidence for incidents
- [x] Daily Report: site photo capture (up to 8 photos) + AI generation
- [x] Field screen: updated quick actions with new module routes
- [x] More screen: AI Intelligence section with new routes

## Enhancement: GPS Geofencing & HORUS Tracking (v1.2)
- [x] GPS location permission handling (foreground)
- [x] Site geofence definition per project (center lat/lng + radius)
- [x] Check-in: verify worker is within geofence before allowing check-in
- [x] Check-in: capture GPS coordinates and timestamp
- [x] Check-out: record GPS coordinates and duration
- [x] Background location watch while on site (30s interval, 20m distance)
- [x] Haversine distance calculation for geofence verification
- [x] Field screen: enhanced check-in UI with GPS status and distance display
- [x] Backend: check-in/check-out HORUS sync (fire-and-forget)
- [x] AsyncStorage persistence for active check-in state

## Enhancement: Push Notifications (v1.2)
- [x] Register device for push notifications on app start
- [x] Store push token in backend per user/device
- [x] Android notification channels (safety, permits, defects, general)
- [x] Safety incident → immediate push notification
- [x] Permit expiry → warning push notification
- [x] Defect assignment → push notification to assigned worker
- [x] Check-in confirmation notification
- [x] In-app notification feed with read/unread state
- [x] Notification persistence in AsyncStorage

## Enhancement: Live Backend Connection (v1.2)
- [x] Database schema: 13 tables (projects, check-ins, defects, incidents, push_tokens, etc.)
- [x] TiDB-compatible schema (text columns, no JSON defaults)
- [x] tRPC routes: projects CRUD (list, create, update)
- [x] tRPC routes: check-ins (create, checkout, history)
- [x] tRPC routes: defects (list, create, updateStatus)
- [x] tRPC routes: incidents (list, create)
- [x] tRPC routes: push token registration
- [x] useLiveProjects() hook with offline fallback
- [x] useLiveDefects() hook with offline fallback
- [x] useLiveIncidents() hook with offline fallback
- [x] useLiveCheckInHistory() hook
- [x] Dashboard: live project count and KPIs
- [x] Projects screen: live project list with Live/Offline indicator
- [x] Connection status banner on dashboard

## Quality
- [x] Zero TypeScript errors
- [x] 25 unit tests passing

## Enhancement: Multi-Tenant Architecture (v1.3)
- [x] Multi-tenant DB schema: companies, company_users, company_settings, feature_flags
- [x] Row-level isolation: all queries scoped by company_id
- [x] Role hierarchy: Super Admin → Company Admin → Manager → Supervisor → Worker
- [x] Permission matrix: feature access per role
- [x] Company context provider (active company, active project, user role)
- [x] Company/Project switcher header component (Procore-style)
- [x] GPS-sorted project list in switcher
- [x] Apply schema to database

## Enhancement: Admin Panel (v1.3)
- [x] Admin Panel screen (admin-only access)
- [x] API key management: add/edit/delete keys per provider (OpenAI, Anthropic, Ollama, etc.)
- [x] LLM model switcher: select active model per company
- [x] Feature flags per company plan (Free/Business/Pro)
- [x] Company settings: name, logo, UTR, CIS status
- [x] User management: invite, role assignment, deactivate
- [x] Usage analytics (API calls, tokens used)

## Enhancement: Procore-Inspired UI (v1.3)
- [x] Procore-style home screen with tool grid (2-column)
- [x] Tool modules: Camera, Dashboard, Action Plans, Announcements, Site Diary, Documents, Drawings, Forms, Incidents, Inspections, Locations, Observations, Photos, Snag List, RFIs, Programme
- [x] Pending upload banner
- [x] Recent Drawings horizontal scroll with thumbnails
- [x] Bookmarks section
- [x] Floating orange FAB (+) button
- [x] My Tools section with priority sync status

## Enhancement: AI Receipt Scanner (v1.3)
- [x] Receipt Scanner screen
- [x] Camera capture or gallery pick of receipt/invoice
- [x] AI extraction: vendor, date, line items, VAT, total
- [x] Editable extracted data form
- [x] Submit to office for approval workflow
- [x] Approval queue for managers
- [x] CIS classification (on-site / off-site labour)

## Enhancement: CIS Invoicing (v1.3)
- [x] CIS settings: UTR, registration status (20%/30%/0%)
- [x] CIS invoice screen with automatic deduction calculation
- [x] On-site vs off-site labour classification
- [x] CIS breakdown: gross labour, deduction, net payable
- [x] Zero-rated VAT option (alongside 20%, 5%, reverse-charge)
- [x] HMRC-correct invoice PDF generation

## Enhancement: Tender & Pricing (v1.3)
- [x] Tender import screen: CSV/XLSX upload with column mapping wizard
- [x] Price a Job condensed mode
- [x] Enquiry pipelines: multiple named pipelines with stages
- [x] Pipeline management (Free: 1, Business: 3, Pro: unlimited)
- [x] Lead/enquiry cards with pipeline stage tracking

## Enhancement: New Modules (v1.3)
- [x] Inspections module (checklists, pass/fail, photos)
- [x] RFIs module (Requests for Information)
- [x] Observations module (site observations with photos)
- [x] Drawings module (upload, view, annotate drawings)
- [x] Announcements module (company-wide announcements)
- [x] Action Plans module (corrective actions with assignees)
- [x] Enhancement: Site Diary module (daily site diary entries)

## Enhancement v1.4
- [x] Tender Import wizard with multi-step CSV/XLSX column mapping
- [x] Quote generation from tender import
- [x] Manager Approval Inbox with prioritised feed
- [x] One-tap approve/reject with push notification to submitter
- [x] Offline-first sync queue with AsyncStorage
- [x] Auto-replay mutations on reconnect
- [x] Sync status indicator (banner + badge)
- [x] Wire new screens into More menu and navigation
- [x] Backend tRPC routes for approvals and tender management

## Enhancement v1.5
- [x] Background location task with expo-task-manager
- [x] Continuous HORUS location pings while checked in (background/locked screen)
- [x] Background task registration in app config (iOS/Android permissions)
- [x] Location ping interval control (configurable per company)
- [x] Interactive Drawings viewer screen
- [x] Pinch-to-zoom and pan gesture support on drawings
- [x] Pin-dropping on drawings for defects and RFIs
- [x] Pin detail modal (type, description, photo, assign)
- [x] Timesheet table in database schema
- [x] Timesheet submission screen (weekly hours entry)
- [x] Timesheet approval workflow in Approval Inbox
- [x] Push notification to worker on approve/reject
- [x] Timesheet history and status tracking
- [x] Backend tRPC routes for timesheets CRUD and approval

## Enhancement v1.6
- [x] drawing_pins table in Drizzle schema
- [x] DB migration: apply drawing_pins table to TiDB
- [x] tRPC routes: drawing pins list, add, delete
- [x] Drawing viewer: load/save pins from backend (shared across devices)
- [x] Timesheet PDF export with worker + manager signature blocks
- [x] Share timesheet PDF from Submission History screen
- [x] Background location: configurable distance-filter threshold (default 10m)
- [x] Distance-filter: skip HORUS ping if worker has not moved beyond threshold
- [x] Distance-filter: persist last known position for comparison

## Enhancement v1.7
- [x] Drawing viewer: per-pin sync state (idle/saving/saved/error)
- [x] Drawing viewer: spinner overlay on pin while saving to backend
- [x] Drawing viewer: retry button on pin when save fails (network error)
- [x] Drawing viewer: optimistic pin placement with rollback on failure
- [x] Timesheets: Send to Payroll button on each approved submission
- [x] Timesheets: mailto link pre-populated with worker name, week, hours, PDF URL
- [x] Timesheets: payroll email configurable in company settings
- [x] Admin Panel: per-project GPS distance filter setting
- [x] Admin Panel: project distance filter stored in DB (company_settings or project row)
- [x] Background location task: read project-level distance filter at check-in, override worker preference
- [x] use-geofence: pass project distance filter to startHorusTracking

## Enhancement v1.8 — Super Admin Control Panel

### Dashboard
- [x] Super Admin shell with 6-tab navigation (Dashboard, Users, Projects, Tasks, Employees, Timesheets)
- [x] KPI cards: total users, active projects, open tasks, pending timesheets, compliance rate, monthly spend
- [x] Activity feed: recent invites, approvals, project updates
- [x] Project health bar chart (budget vs spend per project)
- [x] Workforce pie chart (roles breakdown)
- [x] Quick-action buttons (Invite User, New Project, New Task)

### User Management
- [x] User list with search, filter by role/status, sort
- [x] Invite user modal (email, role, project assignment)
- [x] Edit user role and access permissions inline
- [x] Employee class management (Operative, Foreman, Manager, Subcontractor, Client)
- [x] Suspend / reactivate user accounts
- [x] Bulk role assignment

### Project Management
- [x] Create project form (name, client, address, dates, contract value, manager)
- [x] Project list with status badges and progress bars
- [x] Assign / remove team members per project
- [x] Edit project details inline
- [x] Archive / close projects

### Task Management
- [x] Create task form (title, project, assignee, priority, due date, description)
- [x] Task list with Kanban-style status columns (To Do, In Progress, Blocked, Done)
- [x] Delegate task to employee with notification
- [x] Edit / reassign / close tasks
- [x] Task filter by project, assignee, priority

### Employee Profiles & Credentials
- [x] Employee directory with search and filter
- [x] Employee detail card (contact, role, CSCS card, expiry, trade)
- [x] Document list per employee (certs, IDs, training records)
- [x] Add / edit / delete credential entries
- [x] Compliance status badge (valid / expiring soon / expired)
- [x] Bulk compliance export

### Timesheet Review
- [x] Admin timesheet table (all workers, all projects, all weeks)
- [x] Filter by worker, project, status, date range
- [x] Approve / reject individual timesheets
- [x] Bulk approve selected timesheets
- [x] Export timesheets to CSV
- [x] Summary totals (regular hours, overtime, cost estimate)

## Enhancement v1.9
- [x] Backend: users.invite tRPC route with PIN generation and SMTP email
- [x] Backend: invited_users table (email, pin, role, expires_at)
- [x] Backend: onboarding link with PIN in email body
- [x] Frontend: Invite User modal wired to users.invite mutation
- [x] Frontend: loading/success/error states on invite form
- [x] CSV timesheet export from Super Admin Timesheets tab
- [x] CSV includes: worker, project, week, regular hours, overtime, status, rate, cost
- [x] Native share sheet for CSV file
- [x] Backend: credential expiry check route (scan all employees, flag <30 days)
- [x] Backend: daily scheduled job for credential expiry alerts
- [x] Push notification to admin when any cert expires within 30 days
- [x] Super Admin Employees tab: expiry alert banner

## Enhancement v2.0
- [x] Credential renewal: Renew button on expiring/expired credentials in Employees tab
- [x] Credential renewal: Upload new certificate (document picker)
- [x] Credential renewal: Update expiry date form with date picker
- [x] Credential renewal: Reset alertSent=0 on renewal via tRPC mutation
- [x] Credential renewal: Backend credentials.renew tRPC route
- [x] Onboarding screen: /onboard route (app/onboard.tsx)
- [x] Onboarding screen: Email + PIN entry form
- [x] Onboarding screen: Validate PIN against invited_users table
- [x] Onboarding screen: Account activation (mark invite as used)
- [x] Onboarding screen: Profile completion (name, phone, trade, CSCS)
- [x] Onboarding screen: Redirect to main app on completion
- [x] Payroll email: payrollEmail field in Admin Panel Company Details form
- [x] Payroll email: Persist payrollEmail to company_settings table via tRPC
- [x] Payroll email: Load payrollEmail from company_settings on screen mount
- [x] Payroll email: Wire Send to Payroll button to use saved payrollEmail
- [x] VPS deployment: .env.production template with all required variables
- [x] VPS deployment: PM2 ecosystem config for server process
- [x] VPS deployment: Nginx reverse proxy config for API + Metro
- [x] VPS deployment: Database migration script for TiDB/MySQL on VPS
- [x] VPS deployment: Deployment guide (DEPLOY.md)

## Bug Fixes
- [x] Fix 'Working Offline' sync indicator — offline queue should detect real connectivity and retry correctly when back online

## Enhancement v2.1 — Full-Stack Live Data Wiring
- [x] PostgreSQL schema migration (all 31 tables, from MySQL/TiDB to PostgreSQL)
- [x] VPS deployment: field.cortexbuildpro.com with SSL (Let's Encrypt)
- [x] GitHub repository: adrianstanca1/cortexbuild-field (private)
- [x] GitHub Actions CI/CD: auto-deploy to VPS on push to main
- [x] EAS Build config (eas.json) with development/preview/production profiles
- [x] iOS TestFlight build guide (IOS_BUILD_GUIDE.md)
- [x] Fix 'Working Offline' sync indicator — cold-start false offline, stale closure, hardcoded badge count, empty queue banner
- [x] Backend: 14 new tRPC router namespaces (permits, dailyReports, tasks, inspections, rfis, observations, drawings, announcements, actionPlans, finance, enquiries, teams, analytics)
- [x] Frontend: wire teams.tsx to live tRPC data
- [x] Frontend: wire inspections.tsx to live tRPC data
- [x] Frontend: wire rfis.tsx to live tRPC data
- [x] Frontend: wire observations.tsx to live tRPC data
- [x] Frontend: wire announcements.tsx to live tRPC data
- [x] Frontend: wire action-plans.tsx to live tRPC data
- [x] Frontend: wire analytics.tsx to live tRPC data
- [x] Frontend: wire finance.tsx to live tRPC data
- [x] Frontend: wire timesheets.tsx to live tRPC data
- [x] Frontend: wire defects.tsx to live tRPC data
- [x] Frontend: wire daily-report.tsx to live tRPC data
- [x] Unit tests: 13 sync-queue tests (serialisation, banner visibility, cold-start, retry logic)
- [x] Zero TypeScript errors across all 31 tables and 14 router namespaces

## Enhancement v2.2 — Database Seed
- [x] Write seed script covering all 31 tables with realistic UK construction data
- [x] Run seed on VPS PostgreSQL database (cortexbuild_field)
- [x] Verify data: 22 tables seeded — 1 company, 6 users, 4 projects, 10 team members, 10 tasks, 6 check-ins, 10 timesheets, 3 incidents, 5 defects, 4 permits, 4 daily reports, 5 inspections, 4 RFIs, 4 observations, 6 drawings, 4 announcements, 4 action plans, 4 enquiries, 4 tenders, 5 invoices, 7 credentials, 10 feature flags

## Enhancement v2.3 — Quality & Security Hardening
- [x] Zero TypeScript errors and ESLint errors (17 warnings → 4 warnings)
- [x] Tool output limits increased (max_lines: 500→2000, max_bytes: 32KB→128KB)
- [x] Dependabot vulnerability remediation — updated axios, drizzle-orm, esbuild, superjson, tailwind-merge, tsx, prettier, concurrently, cross-env; critical transitive deps (tar, ws, postcss) already at fixed versions via transitive resolution
- [x] Resolve 6+ critical/high bugs from comprehensive code audit
- [x] Dependabot alerts reduced from 128 → 20 via dep upgrades + transitive fixes
- [ ] Add Content-Security-Policy headers to API server
- [ ] Add rate limiting middleware (express-rate-limit)
- [ ] Add input sanitization on file upload routes
- [ ] Add E2E smoke tests (Playwright for web, Detox for mobile)
- [ ] CI: auto-merge safe Dependabot PRs (patch/minor)
- [ ] CI: add lint + type-check + test gates to deploy workflow
