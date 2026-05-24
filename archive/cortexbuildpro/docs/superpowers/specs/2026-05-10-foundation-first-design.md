# CortexBuild Pro Foundation-First Design Specification

**Date:** 2026-05-10  
**Project:** CortexBuild Pro Construction Management SaaS  
**Approach:** Foundation-First Comprehensive Implementation  
**Status:** Draft for Review

---

## Executive Summary

This specification outlines a comprehensive "Foundation-First" approach to implementing backend integration, UI/UX improvements, and performance optimizations for CortexBuild Pro. The goal is to create a solid technical foundation that supports all current and future features while delivering immediate value to users.

---

## 1. Backend Integration Design

### 1.1 Supabase Database Schema

**Tables to Implement:**

```sql
-- organisations
CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'planning',
  location jsonb,
  start_date date,
  end_date date,
  budget numeric,
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- tasks
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',
  priority text DEFAULT 'medium',
  assignee_id uuid REFERENCES auth.users(id),
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- safety_incidents
CREATE TABLE safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'minor',
  status text DEFAULT 'open',
  reported_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- team_members
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role text DEFAULT 'worker',
  trade text,
  certifications text[],
  hourly_rate numeric
);

-- notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  body text,
  type text DEFAULT 'system',
  read boolean DEFAULT false,
  data jsonb,
  created_at timestamptz DEFAULT now()
);
```

### 1.2 Authentication System

**Components:**
- Email/password authentication via Supabase Auth
- Organization membership system
- Role-based access control (admin, manager, worker)
- JWT validation and session management

**Implementation:**
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } from '../constants'

export const supabase = createClient(
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY
)
```

### 1.3 API Service Layer

**Structure:**
```
src/
  lib/
    api.ts                # Generic CRUD wrapper
    supabase.ts           # Supabase client
    services/
      projectService.ts  # Project-specific operations
      taskService.ts      # Task-specific operations
      safetyService.ts    # Safety incident operations
      teamService.ts      # Team management operations
      notificationService.ts # Notification operations
```

**Example Service Implementation:**
```typescript
// src/lib/services/projectService.ts
export const ProjectService = {
  async getAll(orgId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // update, delete, getById methods...
};
```

### 1.4 Real-time Features

**Subscriptions to Implement:**
- Task status updates
- Safety incident creation/resolution
- Project modifications
- Notification delivery

**Implementation Pattern:**
```typescript
// src/lib/realtime.ts
export function setupRealtimeSubscriptions(userId: string, orgId: string, callbacks: RealtimeCallbacks) {
  // Task updates
  supabase
    .channel('tasks')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `org_id=eq.${orgId}`
    }, (payload) => callbacks.onTaskUpdate(payload))
    .subscribe();

  // Additional subscriptions...
}
```

### 1.5 Row-Level Security Policies

**Policies to Implement:**

```sql
-- Enable RLS on all tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Organisation access
CREATE POLICY "Users can access their organisation"
ON organisations
FOR ALL
USING (auth.uid() = (SELECT user_id FROM team_members WHERE org_id = id LIMIT 1));

-- Project access
CREATE POLICY "Users can access their organisation's projects"
ON projects
FOR ALL
USING (org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()));

-- Task access with role-based filtering
CREATE POLICY "Users can access tasks in their projects"
ON tasks
FOR SELECT
USING (project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid())));

CREATE POLICY "Users can update their assigned tasks"
ON tasks
FOR UPDATE
USING (
  project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM team_members WHERE user_id = auth.uid()))
  AND (
    assignee_id = auth.uid() OR 
    (SELECT role FROM team_members WHERE user_id = auth.uid() AND org_id = (SELECT org_id FROM projects WHERE id = project_id)) IN ('admin', 'manager')
  )
);
```

---

## 2. UI/UX Improvement Design

### 2.1 Design System Enhancements

**Component Library Structure:**
```
src/
  components/
    common/              # Basic building blocks
      ThemedText.tsx     # Enhanced with more variants
      Card.tsx           # Added hover/press effects
      Button.tsx         # Loading states, icons
      Input.tsx          # Better validation UX
      Badge.tsx          # Status indicators
      Avatar.tsx         # User profiles
      Header.tsx         # Screen headers
      ThemeToggle.tsx    # Theme switching
      LoadingScreen.tsx  # Full-screen loading
      EmptyState.tsx     # Better empty states
    
    forms/               # Form components
      DatePicker.tsx     # Mobile-optimized
      Select.tsx         # Dropdown selector
      Checkbox.tsx       # Custom styled
      RadioGroup.tsx     # Option selection
      FormField.tsx      # Label + input + error
    
    feedback/           # User feedback
      Toast.tsx         # Notification toasts
      Alert.tsx          # Confirmation dialogs
      ToolTip.tsx        # Help tooltips
      Progress.tsx       # Loading indicators
```

### 2.2 Screen-Specific Improvements

**Dashboard (`app/(tabs)/index.tsx`):**
- Interactive stats cards with drill-down navigation
- Quick action buttons with haptic feedback
- Recent activity feed with pull-to-refresh
- Personalized greeting based on time of day
- Project progress visualization

**Projects (`app/(tabs)/projects.tsx` and `app/project/[id].tsx`):**
- Enhanced search with multi-criteria filters
- Project cards with progress indicators and status badges
- Grid/List view toggle
- Bulk actions for project management
- Project timeline visualization

**Tasks Kanban (`app/(tabs)/tasks.tsx` and `app/task/[id].tsx`):**
- Smooth drag-and-drop between columns
- Task cards with priority indicators and due dates
- Quick edit actions (swipe gestures)
- Task dependency visualization
- Filtering by assignee, priority, due date

**Safety (`app/(tabs)/safety.tsx`):**
- Severity-based color coding (minor/warning/serious/critical)
- Incident timeline view
- Photo attachment support with camera integration
- Safety trend analytics
- Reporting workflow with required fields

### 2.3 Navigation Improvements

**Enhanced Navigation Patterns:**
- Consistent header with back button and actions
- Improved deep linking between related entities
- Better error handling for offline states
- Loading states during navigation transitions
- Breadcrumbs for complex flows

**Navigation Structure:**
```
Dashboard
├── Quick Actions → Create Project/Task
├── Recent Projects → Project Detail
└── Recent Tasks → Task Detail

Projects
├── Project List (with filters)
└── Project Detail
    ├── Tasks → Task Detail
    ├── Safety Incidents → Incident Detail
    └── Team Members → Member Profile

Tasks (Kanban)
├── Column Filters
├── Task Detail
│   ├── Subtasks
│   ├── Comments
│   └── Attachments
└── Quick Create

Safety
├── Incident List
└── Incident Detail
    ├── Photos
    ├── Resolution Workflow
    └── Related Tasks
```

---

## 3. Performance Optimization Design

### 3.1 Code-Level Optimizations

**Memoization Strategy:**
```typescript
// Example: Memoized task filtering
const filteredTasks = useMemo(() => {
  return tasks.filter(task => {
    if (statusFilter && task.status !== statusFilter) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
}, [tasks, statusFilter, priorityFilter, searchQuery]);
```

**List Virtualization:**
```typescript
// Replace ScrollView with FlatList for large datasets
<FlatList
  data={filteredTasks}
  renderItem={({ item }) => <TaskCard task={item} />}
  keyExtractor={item => item.id}
  initialNumToRender={10}
  maxToRenderPerBatch={5}
  windowSize={7}
  getItemLayout={(data, index) => (
    { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }
  )}
/>
```

### 3.2 Network Performance

**Caching Strategy:**
```typescript
// src/lib/cache.ts
export const cache = {
  projects: {
    data: null as Project[] | null,
    timestamp: 0,
    ttl: 300000 // 5 minutes
  },
  
  getProjects(orgId: string): Project[] | null {
    if (this.projects.data && Date.now() - this.projects.timestamp < this.projects.ttl) {
      return this.projects.data;
    }
    return null;
  },
  
  setProjects(data: Project[]) {
    this.projects.data = data;
    this.projects.timestamp = Date.now();
  },
  
  invalidateProjects() {
    this.projects.timestamp = 0;
  }
};
```

**Optimistic Updates:**
```typescript
// Example: Optimistic task status update
const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
  // Optimistic update
  const previousTasks = [...tasks];
  setTasks(tasks.map(task => 
    task.id === taskId ? { ...task, status: newStatus } : task
  ));
  
  try {
    await TaskService.update(taskId, { status: newStatus });
    cache.invalidateTasks(); // Invalidate cache for next load
  } catch (error) {
    // Revert on error
    setTasks(previousTasks);
    showErrorToast('Failed to update task status');
  }
};
```

### 3.3 Memory Management

**Cleanup Patterns:**
```typescript
useEffect(() => {
  const subscription = setupRealtimeSubscriptions(user.id, org.id, {
    onTaskUpdate: handleTaskUpdate,
    onSafetyIncident: handleSafetyIncident
  });
  
  return () => {
    // Cleanup on unmount
    subscription.unsubscribe();
    clearTimeouts();
    cancelPendingRequests();
  };
}, [user.id, org.id]);
```

**Image Optimization:**
```typescript
// Use Expo Image with caching
<Image
  source={{ uri: imageUri }}
  style={{ width: 100, height: 100 }}
  resizeMode="cover"
  resizeMethod="scale"
  cachePolicy="memory-disk"
  progressiveRenderingEnabled={true}
/>
```

### 3.4 Performance Monitoring

**Monitoring Setup:**
```typescript
// src/lib/monitoring.ts
export function setupPerformanceMonitoring() {
  if (__DEV__) {
    // Development monitoring
    console.time('AppStartup');
    // ... other dev-specific monitoring
  } else {
    // Production monitoring (example with Sentry)
    Sentry.init({
      dsn: EXPO_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.2,
      profilesSampleRate: 0.1,
    });
    
    Sentry.ReactNavigationInstrumentation.registerNavigation(
      navigationRef,
      'CortexBuildPro'
    );
  }
}
```

---

## 4. Implementation Plan

### Phase 1: Backend Foundation (Week 1)

**Tasks:**
1. Set up Supabase project and database
2. Create all tables with proper constraints
3. Implement authentication system
4. Create basic CRUD services for all entities
5. Set up row-level security policies
6. Implement basic error handling and logging

**Deliverables:**
- Functional Supabase backend
- Authenticated API access
- Basic data operations working
- Security policies in place

### Phase 2: Core Features Integration (Week 2)

**Tasks:**
1. Integrate projects functionality with backend
2. Connect tasks system to Supabase
3. Implement basic UI improvements for core screens
4. Add performance optimizations for lists
5. Set up caching layer
6. Implement optimistic updates

**Deliverables:**
- Working projects and tasks features
- Improved UI/UX for main workflows
- Better performance characteristics
- Offline-capable basic operations

### Phase 3: Advanced Features & Polish (Week 3)

**Tasks:**
1. Implement safety incidents functionality
2. Add team management features
3. Set up real-time subscriptions
4. Complete UI/UX enhancements
5. Add performance monitoring
6. Comprehensive testing and bug fixing

**Deliverables:**
- Complete feature set working
- Polished user experience
- Production-ready performance
- Monitoring and analytics

---

## 5. Testing Strategy

### Unit Testing
- Service layer tests with mock Supabase client
- Utility function tests
- State management tests

### Integration Testing
- API integration tests
- Authentication flow tests
- Real-time subscription tests

### End-to-End Testing
- User journey tests (task creation to completion)
- Offline/online transition tests
- Error handling and recovery tests

### Performance Testing
- Load testing with large datasets
- Memory usage profiling
- Startup time optimization
- Navigation performance

---

## 6. Success Metrics

**Technical Success:**
- All backend services operational
- UI/UX improvements implemented
- Performance targets met
- Test coverage > 80%

**User Success:**
- Smooth authentication flow
- Responsive interface (< 100ms for interactions)
- Reliable data synchronization
- Intuitive navigation

**Business Success:**
- Foundation for future features
- Scalable architecture
- Maintainable codebase
- Positive user feedback

---

## 7. Risks and Mitigations

**Risk: Backend integration delays**
- Mitigation: Start with backend first, validate early

**Risk: Performance issues with real data**
- Mitigation: Implement monitoring from start, optimize iteratively

**Risk: UI/UX changes not well received**
- Mitigation: Follow established patterns, get early feedback

**Risk: Scope creep**
- Mitigation: Stick to phased approach, defer non-critical features

---

## Appendix: Technical Decisions

### Why Supabase?
- Postgres-based (relational + JSON flexibility)
- Built-in auth and real-time
- Generous free tier
- Excellent React Native support

### Why Zustand?
- Lightweight and performant
- TypeScript-first
- Simple API, no boilerplate
- Works well with Expo

### Why NativeWind?
- Tailwind CSS familiarity
- Good performance characteristics
- Responsive design support
- Theming capabilities

---

**Approval Status:** ⏳ Draft - Awaiting Review
**Next Steps:** User review → Implementation planning → Development