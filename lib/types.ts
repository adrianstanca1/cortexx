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
  certifications?: Certification[]
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

export interface Inspection {
  id: string
  projectId: string
  title: string
  type: 'general' | 'safety' | 'quality' | 'scaffold' | 'electrical'
  status: 'draft' | 'in_progress' | 'passed' | 'failed'
  checklistItems: Array<{ id: string; label: string; result?: 'pass' | 'fail' | 'na'; note?: string }>
  overallResult: 'pass' | 'fail' | null
  conductedBy: string | null
  scheduledAt: string | null
  completedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface Meeting {
  id: string
  projectId: string | null
  title: string
  location: string | null
  scheduledAt: string
  durationMin: number
  attendees: string | null
  minutes: string | null
  actionItems: Array<{ id: string; title: string; assignee?: string; dueDate?: string; done?: boolean }>
  status: 'scheduled' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface Risk {
  id: string
  projectId: string
  title: string
  category: 'operational' | 'financial' | 'schedule' | 'safety' | 'quality' | 'environmental'
  likelihood: number
  impact: number
  score: number
  mitigation: string | null
  owner: string | null
  status: 'open' | 'mitigated' | 'accepted' | 'closed'
  reviewBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface ToolboxTalk {
  id: string
  projectId: string | null
  date: string
  topic: string
  location: string | null
  deliveredBy: string | null
  attendees: string | null
  attendeeCount: number
  hazardsCovered: string | null
  notes: string | null
  signedOff: boolean
  signedAt: string | null
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string } | null
}

export interface MaintenanceSchedule {
  id: string
  equipmentId: string
  title: string
  type: 'service' | 'inspection' | 'calibration' | 'repair'
  status: 'scheduled' | 'due' | 'completed' | 'overdue' | 'cancelled'
  dueDate: string
  intervalDays: number | null
  completedAt: string | null
  performedBy: string | null
  cost: number
  notes: string | null
  createdAt: string
  updatedAt: string
  equipment?: { id: string; name: string; code: string | null; status: string } | null
}

export interface Supplier {
  id: string
  name: string
  category: 'materials' | 'plant' | 'services' | 'other'
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  postcode: string | null
  paymentTerms: string | null
  accountNumber: string | null
  notes: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Certification {
  id: string
  memberId: string | null
  holderName: string
  type: string
  category: 'qualification' | 'training' | 'course' | 'licence' | 'safety'
  number: string | null
  issuedDate: string | null
  expiryDate: string | null
  notes: string | null
  courseId: string | null
  createdAt: string
  updatedAt: string
  member?: TeamMember | null
  course?: TrainingCourse | null
  statusBucket?: 'valid' | 'expiring' | 'expired' | 'no_expiry'
}

export interface TrainingCourse {
  id: string
  name: string
  code: string | null
  provider: string | null
  category: 'safety' | 'technical' | 'management' | 'first_aid' | 'environmental' | 'other'
  validityDays: number | null
  description: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
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
