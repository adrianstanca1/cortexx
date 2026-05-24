# CortexBuild Field — Mobile App Design

## Brand Identity
- **Primary Color**: #F97316 (Construction Orange) — energy, safety, action
- **Secondary Color**: #1E3A5F (Deep Navy) — trust, professionalism, authority
- **Accent**: #22C55E (Site Green) — success, active, on-track
- **Background (Light)**: #F8FAFC | **Background (Dark)**: #0F172A
- **Surface (Light)**: #FFFFFF | **Surface (Dark)**: #1E293B
- **Typography**: System font (SF Pro on iOS, Roboto on Android)

## Screen List

### Tab Navigation (Bottom Bar)
1. **Dashboard** — Home/overview for the current user role
2. **Projects** — Project list and detail views
3. **Field** — Field operations hub (daily reports, site check-ins)
4. **AI Agent** — Conversational AI assistant with specialized agents
5. **More** — Safety, Timesheets, Defects, Teams, Settings

### Full Screen List
- `(tabs)/index` — Dashboard (role-aware: field worker vs. manager)
- `(tabs)/projects` — Projects list
- `(tabs)/field` — Field operations hub
- `(tabs)/ai` — AI Agent chat interface
- `(tabs)/more` — More menu / module launcher
- `projects/[id]` — Project detail (tasks, progress, team, docs)
- `projects/[id]/tasks` — Task list for a project
- `field/daily-report` — Daily report form
- `field/site-checkin` — Site check-in with GPS
- `field/weather` — Site weather widget
- `safety/index` — Safety overview
- `safety/incident` — Report safety incident
- `safety/permits` — Hot work / confined space permits
- `safety/rams` — RAMS documents
- `timesheets/index` — Timesheet entry and history
- `timesheets/new` — New timesheet entry
- `defects/index` — Defects / snag list
- `defects/new` — Log new defect with photo
- `defects/[id]` — Defect detail
- `teams/index` — Team members and roles
- `reports/index` — Reports hub
- `ai/agents` — AI agent selector
- `settings/index` — User settings, profile, notifications

## Primary Content and Functionality

### Dashboard (Home)
- **Role-aware greeting** with user name and role badge
- **KPI cards**: Open Tasks, Active Permits, Hours This Week, Open Defects
- **Active Projects** horizontal scroll cards with progress bars
- **Today's Schedule** — upcoming tasks and meetings
- **Weather widget** — current site weather
- **Quick Actions**: Log Report, Check In, Report Hazard, Ask AI
- **Recent Activity** feed

### Projects Screen
- Searchable, filterable project list
- Project cards: name, status badge, progress %, deadline, team count
- Swipe actions: view, pin, archive
- FAB to create new project (manager role)

### Project Detail
- Header: project name, status, client, contract value
- Tab bar: Overview | Tasks | Team | Documents | AI Insights
- Overview: progress ring, budget vs. actual, timeline
- Tasks: grouped by status (To Do / In Progress / Done)
- Team: member cards with roles and contact
- Documents: file list with preview

### Field Operations Hub
- **Check In / Check Out** with GPS location capture
- **Daily Report** quick-start card
- **Active Permits** summary
- **Weather** current + 3-day forecast
- **Site Photos** — camera quick-capture with tagging

### AI Agent Screen
- Chat interface with message bubbles
- Agent selector: Safety | Cost | Scheduling | Defects | Contracts | Domain Expert
- Typing indicator with streaming responses
- Context-aware suggestions based on current project
- Voice input button
- Quick prompt chips: "What are today's risks?", "Summarize project status", "Draft a RAMS"

### Safety Module
- Incident log with severity badges (Critical/High/Medium/Low)
- Permit to Work tracker
- RAMS document list
- Risk register summary
- Quick "Report Hazard" button

### Timesheets
- Weekly grid view (Mon–Sun)
- Hours by project/task
- Overtime indicator
- Submit for approval flow

### Defects / Snag List
- List with photo thumbnails, priority badges, status
- Filter by: trade, priority, status, project
- New defect form: photo, description, trade, priority, location
- Defect detail with resolution tracking

### Teams
- Member list with CSCS card status
- Role badges (Foreman, Operative, Subcontractor)
- Contact cards with call/message actions
- Certifications expiry alerts

## Key User Flows

### Field Worker Daily Flow
1. Open app → Dashboard shows today's tasks and check-in prompt
2. Tap "Check In" → GPS captured → confirmation
3. View assigned tasks → tap task → update status
4. End of day: tap "Daily Report" → fill form → submit
5. Report hazard: tap Quick Action → fill incident form → submit

### Manager Project Review Flow
1. Dashboard → tap project card → Project Detail
2. Review progress ring and budget status
3. Tap "AI Insights" tab → AI summarizes risks and recommendations
4. Tap Tasks → review open items → reassign if needed
5. Tap "Ask AI" → "What are the biggest risks on this project?"

### Safety Incident Flow
1. Tap "Report Hazard" quick action
2. Fill: location, description, severity, photo
3. Assign to responsible person
4. Submit → notification sent to safety manager
5. Track resolution in Safety module

### AI Agent Interaction
1. Tap AI tab → select agent (e.g., Safety)
2. Type or speak query: "What PPE is required for confined space entry?"
3. AI streams response with regulatory references
4. Follow-up: "Draft a permit to work for this task"
5. AI generates document template

## Color Choices
- **Primary**: #F97316 (Orange) — used for CTAs, active states, FABs
- **Navy**: #1E3A5F — headers, nav bar, professional elements
- **Green**: #22C55E — success, completed, on-track
- **Amber**: #F59E0B — warnings, in-progress, caution
- **Red**: #EF4444 — errors, critical, overdue
- **Background Light**: #F8FAFC | **Dark**: #0F172A
- **Surface Light**: #FFFFFF | **Dark**: #1E293B
- **Muted Light**: #64748B | **Dark**: #94A3B8

## Component Design Patterns
- **Cards**: rounded-2xl, shadow-sm, border-border, bg-surface
- **Status Badges**: rounded-full, colored bg with matching text
- **Progress Bars**: rounded-full, primary color fill
- **Section Headers**: uppercase tracking-wider text-muted text-xs
- **FAB**: rounded-full bg-primary shadow-lg, bottom-right
- **List Items**: py-4 px-4, border-b border-border
- **Quick Action Grid**: 2x2 or 2x3 grid of icon+label cards
