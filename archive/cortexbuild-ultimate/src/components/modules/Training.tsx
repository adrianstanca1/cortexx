import { useState, useRef } from 'react';
import { Plus, GraduationCap, Award, AlertCircle, Trash2, X, Edit, Download, BarChart3, Users, CheckCircle2, TrendingUp, Bell, FileDown, Calendar, Clock, Filter, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { EmptyState } from '../ui/EmptyState';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { DataImporter, ExportButton, ColumnMapping } from '../ui/DataImportExport';
import { trainingApi, uploadFile } from '../../services/api';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { toast } from 'sonner';
import { useTraining } from '../../hooks/useData';
import { useQueryClient } from '@tanstack/react-query';


interface TrainingRecord {
  id: string;
  title: string;
  type: string;
  provider: string;
  scheduled_date?: string;
  completed_date?: string;
  status: string;
  duration?: number;
  location?: string;
  attendees?: string[];
  certification?: string;
  cert_name?: string;
}

interface CourseRecord {
  id: string;
  title: string;
  provider: string;
  duration: number;
  mandatory: boolean;
  completionRate: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  requiredCourses: number;
  completed: number;
  compliancePercent: number;
  lastActivity: string;
  department: string;
}

interface ExpiringCert {
  id: string;
  name: string;
  holder: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: 'critical'|'warning'|'ok';
}

interface Certificate {
  id: string;
  course: string;
  completionDate: string;
  expiryDate: string;
  certNumber: string;
  holder: string;
}

interface Assessment {
  id: string;
  course: string;
  dueDate: string;
  status: 'pending' | 'passed' | 'failed';
  score?: number;
}

interface LearningPath {
  id: string;
  name: string;
  role: string;
  courses: number;
  completed: number;
  progress: number;
  duration: string;
}

export default function Training() {
  const { data: training = [] } = useTraining.useList();
  const createMutation = useTraining.useCreate();
  const updateMutation = useTraining.useUpdate();
  const deleteMutation = useTraining.useDelete();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [_uploading, setUploading] = useState(false);
  const [_selectedId, setSelectedId] = useState<string | null>(null);
  const _fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'courses' | 'learning' | 'team' | 'compliance' | 'certificates' | 'assessments' | 'report' | 'paths'>('courses');
  const [form, setForm] = useState({ title: '', provider: '', type: 'formal_course', status: 'scheduled', scheduledDate: '', completedDate: '', duration: '', location: '', certification: 'no', certName: '', attendees: '' });
  const [editItem, setEditItem] = useState<(TrainingRecord & { scheduledDate?: string; completedDate?: string }) | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState('');
  const [certExpiryFilter, setCertExpiryFilter] = useState<'valid' | 'expiring' | 'expired'>('valid');
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});

  const { selectedIds, clearSelection } = useBulkSelection();

  const COURSES: CourseRecord[] = [
    { id:'c1', title:'CSCS Health & Safety', provider:'CITB', duration:5, mandatory:true, completionRate:92 },
    { id:'c2', title:'Manual Handling', provider:'Red Cross', duration:3, mandatory:true, completionRate:87 },
    { id:'c3', title:'First Aid Level 3', provider:'Red Cross', duration:8, mandatory:false, completionRate:65 },
    { id:'c4', title:'IPAF 3A+3B', provider:'IPAF', duration:4, mandatory:true, completionRate:78 },
    { id:'c5', title:'Site Safety Induction', provider:'CortexBuild', duration:2, mandatory:true, completionRate:99 },
    { id:'c6', title:'Confined Spaces', provider:'CITB', duration:6, mandatory:false, completionRate:45 },
  ];

  const TEAM_MEMBERS: TeamMember[] = [
    { id:'m1', name:'John Smith', role:'Site Manager', requiredCourses:6, completed:5, compliancePercent:83, lastActivity:'2026-03-18', department:'Operations' },
    { id:'m2', name:'Sarah Johnson', role:'Health & Safety', requiredCourses:6, completed:6, compliancePercent:100, lastActivity:'2026-03-20', department:'Safety' },
    { id:'m3', name:'Mike Davis', role:'Plant Operator', requiredCourses:4, completed:2, compliancePercent:50, lastActivity:'2026-03-10', department:'Plant' },
    { id:'m4', name:'Emma Wilson', role:'Site Engineer', requiredCourses:6, completed:4, compliancePercent:67, lastActivity:'2026-03-15', department:'Engineering' },
    { id:'m5', name:'David Brown', role:'Foreman', requiredCourses:5, completed:5, compliancePercent:100, lastActivity:'2026-03-20', department:'Operations' },
  ];

  const EXPIRING_CERTS: ExpiringCert[] = [
    { id:'ex1', name:'CSCS Card', holder:'Mike Davis', expiryDate:'2026-04-15', daysUntilExpiry:19, status:'critical' },
    { id:'ex2', name:'First Aid', holder:'John Smith', expiryDate:'2026-05-10', daysUntilExpiry:43, status:'warning' },
    { id:'ex3', name:'IPAF 3A+3B', holder:'Emma Wilson', expiryDate:'2026-06-30', daysUntilExpiry:64, status:'ok' },
  ];

  const COMPLIANCE_DATA = [
    { department:'Operations', compliance:89 },
    { department:'Engineering', compliance:76 },
    { department:'Safety', compliance:98 },
    { department:'Plant', compliance:62 },
    { department:'Admin', compliance:95 },
  ];

  const CERTIFICATES: Certificate[] = [
    { id: 'cert1', course: 'CSCS Health & Safety', completionDate: '2025-12-15', expiryDate: '2027-12-15', certNumber: 'CSCS-2025-001234', holder: 'You' },
    { id: 'cert2', course: 'Manual Handling', completionDate: '2025-11-20', expiryDate: '2026-11-20', certNumber: 'MH-2025-005678', holder: 'You' },
    { id: 'cert3', course: 'First Aid Level 3', completionDate: '2025-10-10', expiryDate: '2028-10-10', certNumber: 'FA3-2025-009876', holder: 'You' },
    { id: 'cert4', course: 'Site Safety Induction', completionDate: '2026-01-05', expiryDate: '2027-01-05', certNumber: 'SSI-2026-001111', holder: 'You' },
  ];

  const ASSESSMENTS: Assessment[] = [
    { id: 'assess1', course: 'Confined Spaces Awareness', dueDate: '2026-04-15', status: 'pending' },
    { id: 'assess2', course: 'IPAF Refresher', dueDate: '2026-04-28', status: 'pending' },
    { id: 'assess3', course: 'CSCS Health & Safety', dueDate: '2026-03-25', status: 'passed', score: 92 },
    { id: 'assess4', course: 'Manual Handling', dueDate: '2026-03-20', status: 'passed', score: 87 },
  ];

  const LEARNING_PATHS: LearningPath[] = [
    { id: 'path1', name: 'Site Manager Core', role: 'Site Manager', courses: 8, completed: 5, progress: 62, duration: '24 hours' },
    { id: 'path2', name: 'Quality Surveyor Path', role: 'QS', courses: 6, completed: 2, progress: 33, duration: '18 hours' },
    { id: 'path3', name: 'Health & Safety Specialist', role: 'H&S Officer', courses: 10, completed: 10, progress: 100, duration: '40 hours' },
  ];

  const COMPLIANCE_MATRIX = [
    { person: 'John Smith', 'CSCS H&S': 'pass', 'Manual Handling': 'pass', 'Site Induction': 'due', 'First Aid': 'pass' },
    { person: 'Sarah Johnson', 'CSCS H&S': 'pass', 'Manual Handling': 'pass', 'Site Induction': 'pass', 'First Aid': 'pass' },
    { person: 'Mike Davis', 'CSCS H&S': 'fail', 'Manual Handling': 'pass', 'Site Induction': 'pass', 'First Aid': 'due' },
    { person: 'Emma Wilson', 'CSCS H&S': 'pass', 'Manual Handling': 'pass', 'Site Induction': 'pass', 'First Aid': 'pass' },
    { person: 'David Brown', 'CSCS H&S': 'pass', 'Manual Handling': 'pass', 'Site Induction': 'pass', 'First Aid': 'pass' },
  ];

  const ASSESSMENT_QUESTIONS = [
    { id: 1, text: 'What is the maximum working height before fall protection is required?' },
    { id: 2, text: 'Which of the following is NOT a PPE requirement on site?' },
    { id: 3, text: 'What should be done when discovering a hazard?' },
    { id: 4, text: 'How often should safety inductions be refreshed?' },
    { id: 5, text: 'What does COSHH stand for?' },
  ];

  const ASSESSMENT_OPTIONS = [
    { id: 1, options: ['1.5m', '2m', '2.5m', '3m'] },
    { id: 2, options: ['Hard hat', 'Safety shoes', 'Sunscreen', 'High visibility vest'] },
    { id: 3, options: ['Ignore it', 'Report to supervisor', 'Continue working', 'Tell colleagues'] },
    { id: 4, options: ['Quarterly', 'Annually', 'Every 2 years', 'Every 3 years'] },
    { id: 5, options: ['Control Of Serious Health Hazards', 'Control Of Substance Hazardous to Health', 'Chemical & Occupational Safety Handbook', 'Control Of Site Health Warnings'] },
  ];

  const trainingData = training as unknown as TrainingRecord[];

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      clearSelection();
      toast.success(`Deleted ${ids.length} item(s)`);
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const filtered = trainingData.filter((t: TrainingRecord) =>
    (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.provider || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const completedCount = trainingData.filter((t: TrainingRecord) => t.status === 'completed').length;
  const scheduledCount = trainingData.filter((t: TrainingRecord) => t.status === 'scheduled').length;
  const totalCount = trainingData.length;

  const handleCreate = async () => {
    if (!form.title) return;
    try {
      await createMutation.mutateAsync({
        title: form.title,
        provider: form.provider || 'CortexBuild Training',
        type: form.type || 'formal_course',
        status: form.status,
        scheduled_date: form.scheduledDate || null,
        completed_date: form.completedDate || null,
        duration: form.duration ? parseFloat(form.duration) : null,
        location: form.location || '',
        attendees: form.attendees ? form.attendees.split(',').map(a => a.trim()) : [],
        certification: form.certification || 'no',
        cert_name: form.certName || '',
      });
      toast.success('Training record created');
      setShowCreateModal(false);
      setForm({ title: '', provider: '', type: 'formal_course', status: 'scheduled', scheduledDate: '', completedDate: '', duration: '', location: '', certification: 'no', certName: '', attendees: '' });
    } catch {
      toast.error('Failed to create training record');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this training record?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Training record deleted');
    } catch {
      toast.error('Failed to delete training record');
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.title) return;
    try {
      await updateMutation.mutateAsync({
        id: editItem.id,
        data: {
          title: editItem.title,
          provider: editItem.provider,
          type: editItem.type,
          status: editItem.status,
          scheduled_date: editItem.scheduled_date || null,
          completed_date: editItem.completed_date || null,
          duration: editItem.duration || null,
          location: editItem.location || '',
          attendees: editItem.attendees || [],
          certification: editItem.certification || 'no',
          cert_name: editItem.cert_name || '',
        },
      });
      toast.success('Training record updated');
      setEditItem(null);
    } catch {
      toast.error('Failed to update training record');
    }
  };

  const _handleUploadCert = async (id: string, file: File) => {
    setUploading(true);
    setSelectedId(id);
    try {
      await uploadFile(file, 'REPORTS');
      queryClient.invalidateQueries({ queryKey: ['training'] });
      toast.success(`Uploaded: ${file.name}`);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setSelectedId(null);
    }
  };

  async function handleBulkImport(data: Record<string, unknown>[], mapping: ColumnMapping[]) {
    let failed = 0;
    for (const row of data) {
      const mapped: Record<string, unknown> = {};
      mapping.forEach(m => { if (m.target) mapped[m.target] = row[m.source]; });
      try {
        await trainingApi.create({
          title: String(mapped.title || ''),
          provider: String(mapped.provider || 'CortexBuild Training'),
          type: String(mapped.type || 'formal_course'),
          status: String(mapped.status || 'scheduled'),
          scheduled_date: mapped.scheduled_date || null,
          completed_date: mapped.completed_date || null,
          certification: String(mapped.certification || 'no'),
        });
      } catch { failed++; }
    }
    if (failed > 0) toast.error(`${failed} row(s) failed to import`);
    toast.success(`${data.length - failed} training record(s) imported`);
  }

  const handleSubmitAssessment = () => {
    if (Object.keys(assessmentAnswers).length < ASSESSMENT_QUESTIONS.length) {
      toast.error('Please answer all questions');
      return;
    }
    const score = Math.floor(Math.random() * 20 + 80);
    toast.success(`Assessment submitted! Score: ${score}%`);
    setShowAssessmentModal(false);
    setAssessmentAnswers({});
    setSelectedAssessmentId(null);
  };

  const handleDownloadCert = (certNumber: string) => {
    toast.success(`Downloaded certificate ${certNumber}`);
  };

  const complianceByDept = [
    { department: 'Operations', compliance: 89 },
    { department: 'Engineering', compliance: 76 },
    { department: 'Safety', compliance: 98 },
    { department: 'Plant', compliance: 62 },
  ];

  return (
    <>
      <ModuleBreadcrumbs currentModule="training" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">Training & Certifications</h2>
            <p className="text-gray-400 text-sm mt-1">Track workforce training, compliance and development</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium">
              <Download size={16}/><span>Import</span>
            </button>
            <ExportButton data={trainingData as unknown as Record<string, unknown>[]} filename="training" />
            <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
              <Plus size={18} /> Add Training
            </button>
          </div>
        </div>


        <div className="flex border-b border-gray-700 cb-table-scroll touch-pan-x">
          {(['courses', 'learning', 'team', 'compliance', 'certificates', 'assessments', 'report', 'paths'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'courses' && 'Course Catalog'}
              {tab === 'learning' && 'My Learning'}
              {tab === 'team' && 'Team Progress'}
              {tab === 'compliance' && 'Compliance'}
              {tab === 'certificates' && 'Certificates'}
              {tab === 'assessments' && 'Assessments'}
              {tab === 'report' && 'Compliance Report'}
              {tab === 'paths' && 'Learning Paths'}
            </button>
          ))}
        </div>

        <div className="card p-6">
          {activeTab === 'courses' && (
            <div className="space-y-6">
              <div>
                <input
                  type="text"
                  placeholder="Search courses…"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value.toLowerCase())}
                  className="w-full px-4 py-2 input input-bordered text-white mb-4"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {COURSES.filter(c => c.title.toLowerCase().includes(courseSearch) || c.provider.toLowerCase().includes(courseSearch)).map(course => (
                  <div key={course.id} className="card bg-gray-800 border border-gray-700 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-white font-semibold flex-1">{course.title}</h4>
                      {course.mandatory && <span className="text-xs px-2 py-1 bg-red-900/40 text-red-400 rounded font-medium">Mandatory</span>}
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{course.provider}</p>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Completion Rate</span>
                        <span>{course.completionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-amber-500 h-2 rounded-full" style={{width:`${course.completionRate}%`}}></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{course.duration}h duration</span>
                      <button type="button" onClick={() => toast.success(`Enrolled in ${course.title}`)} className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors">
                        Enrol
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'learning' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4 bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-700">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-blue-400"/>
                    <div>
                      <p className="text-gray-400 text-xs">Learning Streak</p>
                      <p className="text-2xl font-display text-blue-400">12 days</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4 bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-700">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400"/>
                    <div>
                      <p className="text-gray-400 text-xs">Courses Completed</p>
                      <p className="text-2xl font-display text-green-400">8</p>
                    </div>
                  </div>
                </div>
                <div className="card p-4 bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-700">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-purple-400"/>
                    <div>
                      <p className="text-gray-400 text-xs">Certificates Earned</p>
                      <p className="text-2xl font-display text-purple-400">5</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Enrolled Courses</h4>
                <div className="space-y-3">
                  {[
                    { title:'CSCS Health & Safety', progress:100, dueDate:null, cert:true },
                    { title:'Manual Handling', progress:75, dueDate:'2026-04-15', cert:false },
                    { title:'First Aid Level 3', progress:40, dueDate:'2026-05-20', cert:false },
                  ].map((course,idx) => (
                    <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="text-white font-medium">{course.title}</h5>
                        {course.cert && <span className="text-xs px-2 py-1 bg-green-900/40 text-green-400 rounded font-medium">Completed</span>}
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div className="bg-amber-500 h-2 rounded-full" style={{width:`${course.progress}%`}}></div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{course.progress}% complete</span>
                        {course.dueDate && <span className="text-amber-400 font-medium">Due {course.dueDate}</span>}
                        {course.cert && <button type="button" onClick={() => toast.success('Certificate downloaded')} className="text-blue-400 hover:text-blue-300 flex items-center gap-1"><Download className="w-3 h-3"/> Download</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Upcoming Training</h4>
                <div className="space-y-2">
                  {[
                    { date:'2026-04-15', title:'Confined Spaces Awareness' },
                    { date:'2026-04-28', title:'IPAF Refresher' },
                    { date:'2026-05-10', title:'Fire Safety' },
                  ].map((event,idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-700 rounded">
                      <div className="text-amber-400 font-semibold text-sm min-w-fit">{event.date}</div>
                      <div className="text-gray-300">{event.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6">
              <div>
                <select value={teamDeptFilter} onChange={(e) => setTeamDeptFilter(e.target.value)} className="px-3 py-2 input input-bordered text-white mb-4">
                  <option value="">All Departments</option>
                  <option value="Operations">Operations</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Safety">Safety</option>
                  <option value="Plant">Plant</option>
                </select>
              </div>

              <button type="button" onClick={() => {
                const csv = 'Name,Role,Compliance%,Last Activity\n' + TEAM_MEMBERS.filter(m => !teamDeptFilter || m.department === teamDeptFilter).map(m => `${m.name},${m.role},${m.compliancePercent}%,${m.lastActivity}`).join('\n');
                toast.success('CSV exported');
              }} className="flex items-center gap-2 px-4 py-2 bg-blue-900/40 hover:bg-blue-800 text-blue-400 rounded font-medium text-sm transition-colors">
                <FileDown className="w-4 h-4"/> Export to CSV
              </button>

              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/50 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Role</th>
                      <th className="px-4 py-3 text-center text-xs font-display text-gray-400">Required</th>
                      <th className="px-4 py-3 text-center text-xs font-display text-gray-400">Completed</th>
                      <th className="px-4 py-3 text-center text-xs font-display text-gray-400">Compliance</th>
                      <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {TEAM_MEMBERS.filter(m => !teamDeptFilter || m.department === teamDeptFilter).map(member => (
                      <tr key={member.id} className={`hover:bg-gray-900/30 ${member.compliancePercent < 80 ? 'bg-red-900/10' : ''}`}>
                        <td className="px-4 py-3 text-white font-medium">{member.name}</td>
                        <td className="px-4 py-3 text-gray-300">{member.role}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{member.requiredCourses}</td>
                        <td className="px-4 py-3 text-center text-white font-semibold">{member.completed}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-semibold ${member.compliancePercent >= 90 ? 'text-green-400' : member.compliancePercent >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                            {member.compliancePercent}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{member.lastActivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4 bg-blue-900/30 border border-blue-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">Overall Compliance</p>
                  <p className="text-3xl font-display text-blue-400">84%</p>
                </div>
                <div className="card p-4 bg-amber-900/30 border border-amber-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">Due This Month</p>
                  <p className="text-3xl font-display text-amber-400">5</p>
                </div>
                <div className="card p-4 bg-red-900/30 border border-red-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">Expired Certs</p>
                  <p className="text-3xl font-display text-red-400">0</p>
                </div>
                <div className="card p-4 bg-orange-900/30 border border-orange-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">At-Risk Staff</p>
                  <p className="text-3xl font-display text-orange-400">2</p>
                </div>
              </div>

              <div className="card bg-gray-800 p-6 border border-gray-700">
                <h4 className="text-white font-semibold mb-4">Compliance by Department</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={COMPLIANCE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                    <XAxis dataKey="department" stroke="#9ca3af"/>
                    <YAxis stroke="#9ca3af"/>
                    <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'1px solid #374151',borderRadius:8}}/>
                    <Legend/>
                    <Bar dataKey="compliance" name="Compliance %" fill="#f59e0b" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Expiring Certifications (Next 90 Days)</h4>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/50 border-b border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Certification</th>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Holder</th>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Expiry Date</th>
                        <th className="px-4 py-3 text-center text-xs font-display text-gray-400">Days</th>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {EXPIRING_CERTS.map(cert => (
                        <tr key={cert.id} className="hover:bg-gray-900/30">
                          <td className="px-4 py-3 text-white font-medium">{cert.name}</td>
                          <td className="px-4 py-3 text-gray-300">{cert.holder}</td>
                          <td className="px-4 py-3 text-gray-300">{cert.expiryDate}</td>
                          <td className="px-4 py-3 text-center text-white font-semibold">{cert.daysUntilExpiry}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${cert.status === 'critical' ? 'bg-red-900/40 text-red-400' : cert.status === 'warning' ? 'bg-amber-900/40 text-amber-400' : 'bg-green-900/40 text-green-400'}`}>
                              {cert.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => toast.success(`Reminder sent to ${cert.holder}`)} className="text-xs px-3 py-1 bg-blue-900/40 hover:bg-blue-800 text-blue-400 rounded font-medium transition-colors flex items-center gap-1">
                              <Bell className="w-3 h-3"/> Send Reminder
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <button
                  onClick={() => setCertExpiryFilter('valid')}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    certExpiryFilter === 'valid'
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Valid
                </button>
                <button
                  onClick={() => setCertExpiryFilter('expiring')}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    certExpiryFilter === 'expiring'
                      ? 'bg-amber-900/40 text-amber-400'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Expiring Soon
                </button>
                <button
                  onClick={() => setCertExpiryFilter('expired')}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    certExpiryFilter === 'expired'
                      ? 'bg-red-900/40 text-red-400'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Expired
                </button>
              </div>

              <button className="flex items-center gap-2 px-4 py-2 bg-blue-900/40 hover:bg-blue-800 text-blue-400 rounded font-medium text-sm transition-colors">
                <Download className="w-4 h-4" /> Bulk Download All
              </button>

              <div className="space-y-3">
                {CERTIFICATES.map(cert => {
                  const isExpired = new Date(cert.expiryDate) < new Date();
                  const isExpiringSoon = new Date(cert.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
                  const status = isExpired ? 'expired' : isExpiringSoon ? 'expiring' : 'valid';

                  if (certExpiryFilter !== status) return null;

                  return (
                    <div key={cert.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h5 className="text-white font-semibold">{cert.course}</h5>
                          <p className="text-xs text-gray-500">Cert #: {cert.certNumber}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          isExpired ? 'bg-red-900/40 text-red-400' :
                          isExpiringSoon ? 'bg-amber-900/40 text-amber-400' :
                          'bg-green-900/40 text-green-400'
                        }`}>
                          {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Valid'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs">
                        <div>
                          <p className="text-gray-500">Completion</p>
                          <p className="text-gray-300">{cert.completionDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Expiry</p>
                          <p className="text-gray-300">{cert.expiryDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Holder</p>
                          <p className="text-gray-300">{cert.holder}</p>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleDownloadCert(cert.certNumber)}
                            className="px-3 py-1 bg-blue-900/40 hover:bg-blue-800 text-blue-400 rounded text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'assessments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4 bg-blue-900/30 border border-blue-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">Pending</p>
                  <p className="text-2xl font-display text-blue-400">{ASSESSMENTS.filter(a => a.status === 'pending').length}</p>
                </div>
                <div className="card p-4 bg-green-900/30 border border-green-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">Passed</p>
                  <p className="text-2xl font-display text-green-400">{ASSESSMENTS.filter(a => a.status === 'passed').length}</p>
                </div>
                <div className="card p-4 bg-red-900/30 border border-red-700">
                  <p className="text-gray-400 text-xs uppercase mb-2">Failed</p>
                  <p className="text-2xl font-display text-red-400">{ASSESSMENTS.filter(a => a.status === 'failed').length}</p>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Pending Assessments</h4>
                <div className="space-y-3">
                  {ASSESSMENTS.filter(a => a.status === 'pending').map(assess => (
                    <div key={assess.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <h5 className="text-white font-semibold">{assess.course}</h5>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Due {assess.dueDate}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAssessmentId(assess.id);
                          setShowAssessmentModal(true);
                        }}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        Take Assessment
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-4">Assessment History</h4>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/50 border-b border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Course</th>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-display text-gray-400">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-display text-gray-400">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {ASSESSMENTS.filter(a => a.status !== 'pending').map(assess => (
                        <tr key={assess.id} className="hover:bg-gray-900/30">
                          <td className="px-4 py-3 text-white font-medium">{assess.course}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              assess.status === 'passed'
                                ? 'bg-green-900/40 text-green-400'
                                : 'bg-red-900/40 text-red-400'
                            }`}>
                              {assess.status === 'passed' ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-white font-semibold">{assess.score}%</td>
                          <td className="px-4 py-3 text-gray-400">2026-03-{Math.floor(Math.random() * 20) + 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display text-white">Team Compliance Matrix</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-green-900/40 hover:bg-green-800 text-green-400 rounded font-medium text-sm transition-colors">
                  <Download className="w-4 h-4" /> Export to Excel
                </button>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="text-white font-semibold mb-4">Compliance by Department</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={complianceByDept}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="department" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="compliance" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="cb-table-scroll touch-pan-x">
                <table className="w-full text-xs">
                  <thead className="bg-gray-900/50 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-display text-gray-400 whitespace-nowrap">Person</th>
                      <th className="px-4 py-3 text-center font-display text-gray-400">CSCS H&S</th>
                      <th className="px-4 py-3 text-center font-display text-gray-400">Manual Handling</th>
                      <th className="px-4 py-3 text-center font-display text-gray-400">Site Induction</th>
                      <th className="px-4 py-3 text-center font-display text-gray-400">First Aid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {COMPLIANCE_MATRIX.map((row: Record<string, unknown>, idx) => (
                      <tr key={idx} className="hover:bg-gray-900/30">
                        <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{String(row.person)}</td>
                        {['CSCS H&S', 'Manual Handling', 'Site Induction', 'First Aid'].map(course => {
                          const status = String(row[course]);
                          const statusColor = status === 'pass' ? 'bg-green-900/40 text-green-400' : status === 'fail' ? 'bg-red-900/40 text-red-400' : 'bg-amber-900/40 text-amber-400';
                          return (
                            <td key={course} className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                                {status === 'pass' ? '✓' : status === 'fail' ? '✗' : 'Due'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'paths' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {LEARNING_PATHS.map(path => (
                  <div key={path.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-4">
                    <div>
                      <h4 className="text-white font-semibold mb-1">{path.name}</h4>
                      <p className="text-xs text-gray-500">{path.role}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{path.completed} of {path.courses} courses</span>
                        <span className="text-amber-400 font-semibold">{path.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${path.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-700 flex items-center justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {path.duration}
                      </span>
                      {path.progress === 100 ? (
                        <span className="text-green-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      ) : (
                        <button className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                          Enrol
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h4 className="text-white font-semibold mb-4">Learning Path Details</h4>
                <div className="space-y-4">
                  {LEARNING_PATHS.map(path => (
                    <div key={path.id} className="border-b border-gray-700 pb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-semibold">{path.name}</p>
                          <p className="text-xs text-gray-500">For {path.role}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          path.progress === 100
                            ? 'bg-green-900/40 text-green-400'
                            : path.progress > 50
                            ? 'bg-blue-900/40 text-blue-400'
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          {path.progress}% Complete
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{path.completed} of {path.courses} mandatory courses completed</p>
                      {path.progress < 100 && (
                        <button className="text-xs px-3 py-1 bg-blue-900/40 hover:bg-blue-800 text-blue-400 rounded font-medium transition-colors">
                          Continue Path
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          actions={[
            { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
          ]}
          onClearSelection={clearSelection}
        />

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <h3 className="text-xl font-display text-white">Add Training Record</h3>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Title *</label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. CSCS Health & Safety" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                      <option value="toolbox_talk">Toolbox Talk</option>
                      <option value="formal_course">Formal Course</option>
                      <option value="e_learning">E-Learning</option>
                      <option value="on_the_job">On-the-Job</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Provider</label>
                    <input type="text" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="e.g. CITB" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Scheduled Date</label>
                    <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Completed Date</label>
                    <input type="date" value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Duration (hours)</label>
                    <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 4" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Location</label>
                    <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Training Centre" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Attendees (comma separated)</label>
                  <input type="text" value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="e.g. John Smith, Sarah Johnson" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Certification Awarded</label>
                    <select value={form.certification} onChange={e => setForm(f => ({ ...f, certification: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  {form.certification === 'yes' && (
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Certification Name</label>
                      <input type="text" value={form.certName} onChange={e => setForm(f => ({ ...f, certName: e.target.value }))} placeholder="e.g. CSCS Card" className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="button" onClick={handleCreate} disabled={createMutation.isPending || !form.title} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                  {createMutation.isPending ? 'Creating...' : 'Add Record'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editItem && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <h3 className="text-xl font-display text-white">Edit Training Record</h3>
                <button type="button" onClick={() => setEditItem(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Title *</label>
                  <input type="text" value={editItem.title} onChange={e => setEditItem(f => ({ ...f!, title: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Type</label>
                    <select value={editItem.type} onChange={e => setEditItem(f => ({ ...f!, type: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                      <option value="toolbox_talk">Toolbox Talk</option>
                      <option value="formal_course">Formal Course</option>
                      <option value="e_learning">E-Learning</option>
                      <option value="on_the_job">On-the-Job</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Provider</label>
                    <input type="text" value={editItem.provider} onChange={e => setEditItem(f => ({ ...f!, provider: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Scheduled Date</label>
                    <input type="date" value={editItem.scheduled_date || ''} onChange={e => setEditItem(f => ({ ...f!, scheduled_date: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Completed Date</label>
                    <input type="date" value={editItem.completed_date || ''} onChange={e => setEditItem(f => ({ ...f!, completed_date: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Duration (hours)</label>
                    <input type="number" value={editItem.duration || ''} onChange={e => setEditItem(f => ({ ...f!, duration: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 input input-bordered text-white placeholder-gray-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Status</label>
                  <select value={editItem.status} onChange={e => setEditItem(f => ({ ...f!, status: e.target.value }))} className="w-full px-3 py-2 input input-bordered text-white">
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
                <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="button" onClick={handleUpdate} disabled={updateMutation.isPending || !editItem.title} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showBulkImport && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-700">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">Import Items</h2>
                <button type="button" onClick={() => setShowBulkImport(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
              </div>
              <div className="p-6">
                <DataImporter
                  onImport={handleBulkImport}
                  format="csv"
                  exampleData={{ title: '', provider: '', type: '', date: '', status: '', notes: '' }}
                />
              </div>
            </div>
          </div>
        )}

        {showAssessmentModal && selectedAssessmentId && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900">
                <h3 className="text-xl font-display text-white">Assessment: {ASSESSMENTS.find(a => a.id === selectedAssessmentId)?.course}</h3>
                <button type="button" onClick={() => setShowAssessmentModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-6">
                {ASSESSMENT_QUESTIONS.map(q => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-white font-semibold">Q{q.id}. {q.text}</p>
                    <div className="space-y-2">
                      {ASSESSMENT_OPTIONS[q.id - 1].options.map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700/50 transition">
                          <input
                            type="radio"
                            name={`q${q.id}`}
                            value={idx}
                            checked={assessmentAnswers[`q${q.id}`] === idx}
                            onChange={() => setAssessmentAnswers({ ...assessmentAnswers, [`q${q.id}`]: idx })}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-300 text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-900">
                <button type="button" onClick={() => setShowAssessmentModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                <button type="button" onClick={handleSubmitAssessment} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold">
                  Submit Assessment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
