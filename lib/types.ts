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

export interface Drawing {
  id: string
  projectId: string
  number: string | null
  title: string
  discipline: 'arch' | 'struct' | 'mep' | 'civil' | 'fire' | 'other'
  revision: string
  fileUrl: string | null
  uploadedBy: string | null
  notes: string | null
  isSuperseded: boolean
  supersededAt: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface Milestone {
  id: string
  projectId: string
  title: string
  plannedStart: string
  plannedEnd: string
  actualEnd: string | null
  status: 'planned' | 'in_progress' | 'complete' | 'slipped'
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string; status: string } | null
}

export interface Permit {
  id: string
  projectId: string
  title: string
  type: 'hot_work' | 'confined_space' | 'excavation' | 'working_at_height' | 'electrical' | 'general'
  status: 'draft' | 'active' | 'expired' | 'cancelled'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  location: string | null
  issuedBy: string | null
  issuedTo: string | null
  validFrom: string | null
  validTo: string | null
  conditions: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface Tender {
  id: string
  projectId: string | null
  title: string
  clientName: string | null
  status: 'draft' | 'submitted' | 'won' | 'lost' | 'withdrawn'
  totalValue: number
  deadline: string | null
  submittedAt: string | null
  decidedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface Rams {
  id: string
  projectId: string
  title: string
  type: 'rams' | 'risk_assessment' | 'method_statement'
  hazards: string | null
  controls: string | null
  ppe: string | null
  reviewBy: string | null
  signedBy: string | null
  signedAt: string | null
  status: 'draft' | 'active' | 'expired' | 'archived'
  notes: string | null
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
