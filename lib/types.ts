export interface Project {
  id: string
  name: string
  address: string
  postcode: string
  status: string
  progress: number
  clientName: string
  budget: number
  spent: number
  lat: number
  lng: number
  startDate: string | null
  endDate: string | null
  onSiteCount: number
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    tasks: number
    assignments: number
  }
  tasks?: Task[]
  assignments?: Assignment[]
  invoices?: Invoice[]
  activities?: Activity[]
  documents?: Document[]
}

export interface Task {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  dueTime: string | null
  status: string
  priority: string
  category: string | null
  projectId: string | null
  assigneeId: string | null
  createdAt: string
  updatedAt: string
  project?: Project | null
  assignee?: TeamMember | null
  _count?: { comments?: number }
}

export interface TeamMember {
  id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  avatarColor: string
  dailyRate: number
  onSite: boolean
  createdAt: string
  hoursThisWeek?: number
  assignments?: Assignment[]
}

export interface Assignment {
  id: string
  projectId: string
  memberId: string
  role: string | null
  onSite: boolean
  project?: Project
  member?: TeamMember
}

export interface Invoice {
  id: string
  number: string
  projectId: string | null
  clientName: string
  amount: number
  status: string
  issuedDate: string
  dueDate: string
  paidDate: string | null
  notes: string | null
  createdAt: string
  project?: Project | null
}

export interface TimeEntry {
  id: string
  memberId: string
  projectId: string | null
  date: string
  hours: number
  week: number
  year: number
  approved: boolean
  member?: TeamMember
  project?: Project | null
}

export interface Activity {
  id: string
  projectId: string | null
  actorName: string
  actorType: string
  action: string
  detail: string | null
  iconType: string
  createdAt: string
  project?: Project | null
}

export interface Document {
  id: string
  projectId: string | null
  type: string
  name: string
  url?: string | null
  size?: number | null
  mimeType?: string | null
  expiresAt: string | null
  createdAt: string
  project?: Project | null
}

export interface Comment {
  id: string
  taskId?: string | null
  projectId?: string | null
  authorId: string
  authorName: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface Snag {
  id: string
  projectId: string
  title: string
  description: string | null
  location: string | null
  status: 'open' | 'in_progress' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  photoUrl: string | null
  dueDate: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface DashboardStats {
  cashflow: number
  owed: number
  hoursThisWeek: number
  activeSites: number
}

export interface DashboardData {
  projects: Project[]
  tasks: Task[]
  team: TeamMember[]
  invoices: Invoice[]
  activities: Activity[]
  stats: DashboardStats
}
