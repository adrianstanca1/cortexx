import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, Phone, Mail, Edit2, Trash2, X, ChevronDown, ChevronUp, Shield, Clock, Award, AlertTriangle, PoundSterling, MapPin, CheckCircle2, Calendar, Upload, CheckSquare, Square, Download, Pencil, MessageSquare } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { useTeam } from '../../hooks/useData';
import { uploadFile, teamApi } from '../../services/api';
import { toast } from 'sonner';
import { z } from 'zod';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { DataImporter, ExportButton } from '../ui/DataImportExport';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { TeamChat } from '../ui/TeamChat';

type AnyRow = Record<string, unknown>;

const ROLES = ['Site Manager','Project Manager','Foreman','Carpenter','Bricklayer','Electrician','Plumber','Steel Fixer','Labourer','Health & Safety Officer','QS','Engineer'];
const TRADE_TYPES = ['Management','Structural','Electrical','Mechanical','Civil','Finishing','Safety'];
const STATUS_OPTIONS = ['Active','On Leave','Signed Off','Inactive'];

const SKILLS = ['CSCS', 'First Aid', 'Working at Height', 'Confined Space', 'Asbestos Awareness', 'Scaffold Inspection', 'MEWP', 'Plant Operator'];
const CSCS_TYPES = ['Gold', 'Blue', 'Green', 'White'];

const teamMemberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.string().min(1, 'Role is required'),
  trade_type: z.string().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional(),
  daily_rate: z.union([z.string(), z.number()]).optional(),
  cscs_card: z.string().optional(),
  cscs_expiry: z.string().optional(),
  cscs_type: z.enum(['Gold', 'Blue', 'Green', 'White']).optional(),
  status: z.enum(['Active', 'On Leave', 'Signed Off', 'Inactive']).optional(),
  notes: z.string().optional(),
});

type _TeamMemberForm = z.infer<typeof teamMemberSchema>;

const statusColour: Record<string,string> = {
  'Active':'bg-green-900 text-green-100','On Leave':'bg-amber-900 text-amber-100',
  'Signed Off':'bg-blue-900 text-blue-100','Inactive':'bg-gray-800 text-gray-400',
};

const emptyForm = { name:'',role:'',trade_type:'',email:'',phone:'',daily_rate:'',cscs_card:'',cscs_expiry:'',cscs_type:'Gold',status:'Active',notes:'' };

/** Site-check QR: encodes app-scoped CSCS label (not a password). Image from public QR API. */
function cscsSiteCheckQrSrc(cardNo: string, holderName: string): string {
  const payload = `cortexbuild:cscs|v1|${String(cardNo).trim()}|${String(holderName).trim().slice(0, 80)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=1&data=${encodeURIComponent(payload)}`;
}

type Skill = { id: string; skill_name: string; status: 'yes' | 'no' | 'expired' };
type Induction = { id: string; project: string; date: string; next_due?: string; status: 'current' | 'due_soon' | 'overdue' };
type Availability = { id: string; project: string; status: 'onsite' | 'office' | 'off' | 'sick' };

export function Teams() {
  const { useList, useCreate, useUpdate, useDelete } = useTeam;
  const { data: raw = [], isLoading } = useList();
  const members = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useState<'members'|'skills'|'cscs'|'inductions'|'onsite'>('members');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadingCscs, setUploadingCscs] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);

  // Skills modal
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillMember, setSkillMember] = useState<AnyRow | null>(null);
  const [skillForm, setSkillForm] = useState({ skill_name: '', status: 'no' });
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Inductions modal
  const [showInductionModal, setShowInductionModal] = useState(false);
  const [inductionMember, setInductionMember] = useState<AnyRow | null>(null);
  const [inductionForm, setInductionForm] = useState({ project: '', date: '', next_due: '', status: 'current' as Induction['status'] });
  const [editingInduction, setEditingInduction] = useState<Induction | null>(null);

  // Availability modal
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [availMember, setAvailMember] = useState<AnyRow | null>(null);
  const [availForm, setAvailForm] = useState({ project: '', status: 'off' as Availability['status'] });
  const [editingAvail, setEditingAvail] = useState<Availability | null>(null);

  const openAddSkill = (member: AnyRow) => {
    setSkillMember(member);
    setSkillForm({ skill_name: '', status: 'no' });
    setEditingSkill(null);
    setShowSkillModal(true);
  };

  const openEditSkill = (skill: Skill, member: AnyRow) => {
    setSkillMember(member);
    setSkillForm({ skill_name: skill.skill_name, status: skill.status });
    setEditingSkill(skill);
    setShowSkillModal(true);
  };

  const saveSkill = async () => {
    if (!skillMember) return;
    try {
      if (editingSkill) {
        const updated = await teamApi.updateMemberSkill(String(editingSkill.id), skillForm) as Skill;
        setMemberSkills(prev => ({
          ...prev,
          [String(skillMember.id ?? '')]: prev[String(skillMember.id ?? '')].map(s => String(s.id ?? '') === String(updated.id ?? '') ? { ...s, ...updated } : s)
        }));
      } else {
        const created = await teamApi.addMemberSkill(String(skillMember.id), skillForm.skill_name, skillForm.status) as Skill;
        setMemberSkills(prev => ({
          ...prev,
          [String(skillMember.id)]: [...(prev[String(skillMember.id)] || []), created]
        }));
      }
      setShowSkillModal(false);
      toast.success(editingSkill ? 'Skill updated' : 'Skill added');
    } catch {
      toast.error('Failed to save skill');
    }
  };

  const deleteSkill = async (id: string, memberId: string | number | undefined) => {
    if (!confirm('Delete this skill?')) return;
    try {
      await teamApi.deleteMemberSkill(id);
      setMemberSkills(prev => ({
        ...prev,
        [String(memberId)]: prev[String(memberId)].filter((s: Skill) => s.id !== id)
      }));
      toast.success('Skill removed');
    } catch {
      toast.error('Failed to delete skill');
    }
  };

  const openAddInduction = (member: AnyRow) => {
    setInductionMember(member);
    setInductionForm({ project: '', date: new Date().toISOString().split('T')[0], next_due: '', status: 'current' });
    setEditingInduction(null);
    setShowInductionModal(true);
  };

  const openEditInduction = (ind: Induction, member: AnyRow) => {
    setInductionMember(member);
    setInductionForm({ project: ind.project, date: ind.date, next_due: ind.next_due ?? '', status: ind.status });
    setEditingInduction(ind);
    setShowInductionModal(true);
  };

  const saveInduction = async () => {
    if (!inductionMember) return;
    try {
      if (editingInduction) {
        const updated = await teamApi.updateMemberInduction(editingInduction.id, inductionForm) as Induction;
        setMemberInductions(prev => ({
          ...prev,
          [String(inductionMember.id)]: prev[String(inductionMember.id)].map(i => i.id === updated.id ? { ...i, ...updated } : i)
        }));
      } else {
        const created = await teamApi.addMemberInduction(String(inductionMember.id), inductionForm) as Induction;
        setMemberInductions(prev => ({
          ...prev,
          [String(inductionMember.id)]: [...(prev[String(inductionMember.id)] || []), created]
        }));
      }
      setShowInductionModal(false);
      toast.success(editingInduction ? 'Induction updated' : 'Induction added');
    } catch {
      toast.error('Failed to save induction');
    }
  };

  const deleteInduction = async (ind: Induction, memberId: string) => {
    if (!confirm('Delete this induction?')) return;
    try {
      await teamApi.deleteMemberInduction(ind.id);
      setMemberInductions(prev => ({
        ...prev,
        [String(memberId)]: prev[String(memberId)].filter(i => i.id !== ind.id)
      }));
      toast.success('Induction removed');
    } catch {
      toast.error('Failed to delete induction');
    }
  };

  const openAddAvail = (member: AnyRow) => {
    setAvailMember(member);
    setAvailForm({ project: '', status: 'off' });
    setEditingAvail(null);
    setShowAvailModal(true);
  };

  const openEditAvail = (av: Availability, member: AnyRow) => {
    setAvailMember(member);
    setAvailForm({ project: av.project, status: av.status });
    setEditingAvail(av);
    setShowAvailModal(true);
  };

  const saveAvail = async () => {
    if (!availMember) return;
    try {
      if (editingAvail) {
        const updated = await teamApi.updateMemberAvailability(editingAvail.id, availForm.status) as Availability;
        setMemberAvailability(prev => ({
          ...prev,
          [String(availMember.id)]: prev[String(availMember.id)].map(a => a.id === updated.id ? { ...a, ...updated } : a)
        }));
      } else {
        const created = await teamApi.addMemberAvailability(String(availMember.id), availForm.project, availForm.status) as Availability;
        setMemberAvailability(prev => ({
          ...prev,
          [String(availMember.id)]: [...(prev[String(availMember.id)] || []), created]
        }));
      }
      setShowAvailModal(false);
      toast.success(editingAvail ? 'Availability updated' : 'Availability added');
    } catch {
      toast.error('Failed to save availability');
    }
  };

  const deleteAvail = async (av: Availability, memberId: string) => {
    if (!confirm('Delete this availability entry?')) return;
    try {
      await teamApi.deleteMemberAvailability(av.id);
      setMemberAvailability(prev => ({
        ...prev,
        [String(memberId)]: prev[String(memberId)].filter(a => a.id !== av.id)
      }));
      toast.success('Availability removed');
    } catch {
      toast.error('Failed to delete availability');
    }
  };
  const { selectedIds, toggle, toggleAll: _toggleAll, clearSelection, isAllSelected: _isAllSelected } = useBulkSelection();

  const selectedCount = selectedIds.size;

  const [memberSkills, setMemberSkills] = useState<Record<string, Skill[]>>({});
  const [memberInductions, setMemberInductions] = useState<Record<string, Induction[]>>({});
  const [memberAvailability, setMemberAvailability] = useState<Record<string, Availability[]>>({});
  const [fetchingMemberData, setFetchingMemberData] = useState(false);
  const fetchedMemberIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (members.length === 0) return;
    const unfetched = members.filter(m => m.id && !fetchedMemberIds.current.has(String(m.id)));
    if (unfetched.length === 0) return;

    let cancelled = false;
    setFetchingMemberData(true);

    Promise.all(
      unfetched.map(async (m) => {
        const memberId = String(m.id);
        const [skills, inductions, availability] = await Promise.all([
          teamApi.getMemberSkills(memberId).catch(err => { console.warn('[Teams] skills fetch failed:', err); return []; }),
          teamApi.getMemberInductions(memberId).catch(err => { console.warn('[Teams] inductions fetch failed:', err); return []; }),
          teamApi.getMemberAvailability(memberId).catch(err => { console.warn('[Teams] availability fetch failed:', err); return []; }),
        ]);
        return { memberId, skills: skills as Skill[], inductions: inductions as Induction[], availability: availability as Availability[] };
      })
    ).then(results => {
      if (cancelled) return;
      setMemberSkills(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.memberId] = r.skills; });
        return next;
      });
      setMemberInductions(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.memberId] = r.inductions; });
        return next;
      });
      setMemberAvailability(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.memberId] = r.availability; });
        return next;
      });
      results.forEach(r => fetchedMemberIds.current.add(r.memberId));
    }).finally(() => {
      if (!cancelled) setFetchingMemberData(false);
    });

    return () => { cancelled = true; };
  }, [members]);

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} team member(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} member(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  async function handleBulkImport(data: Record<string, unknown>[], mapping: { source: string; target: string }[]) {
    let failed = 0;
    for (const row of data) {
      const mapped: Record<string, unknown> = {};
      mapping.forEach(m => { if (m.target) mapped[m.target] = row[m.source]; });
      try { await createMutation.mutateAsync(mapped); } catch { failed++; }
    }
    if (failed > 0) toast.error(`${failed} row(s) failed to import`);
    toast.success(`${data.length - failed} members imported`);
  }

  const filtered = members.filter(m => {
    const name = String(m.name ?? '').toLowerCase();
    const role = String(m.role ?? '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || role.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = members.filter(m => m.status === 'Active').length;
  const _onLeaveCount = members.filter(m => m.status === 'On Leave').length;
  const totalDailyCost = members.filter(m => m.status === 'Active').reduce((s, m) => s + Number(m.daily_rate ?? 0), 0);
  const weeklyForecast = totalDailyCost * 5;
  const monthlyForecast = totalDailyCost * 21;

  const cscsExpiring = members.filter(m => {
    if (!m.cscs_expiry) return false;
    const diff = (new Date(String(m.cscs_expiry)).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 30;
  }).length;

  const cscsAlerts = members.filter(m => {
    if (!m.cscs_expiry) return true;
    const diff = (new Date(String(m.cscs_expiry)).getTime() - Date.now()) / 86400000;
    return diff < 60;
  });

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); }
  function openEdit(m: AnyRow) {
    setEditing(m);
    setForm({ name:String(m.name??''),role:String(m.role??''),trade_type:String(m.trade_type??''),email:String(m.email??''),phone:String(m.phone??''),daily_rate:String(m.daily_rate??''),cscs_card:String(m.cscs_card??''),cscs_expiry:String(m.cscs_expiry??''),cscs_type:String(m.cscs_type??'Gold'),status:String(m.status??'Active'),notes:String(m.notes??'') });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = teamMemberSchema.safeParse(form);
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return;
    }
    const payload = { ...form, daily_rate: form.daily_rate !== '' ? Number(form.daily_rate) : 0 };
    if (editing) { await updateMutation.mutateAsync({ id: String(editing.id), data: payload }); toast.success('Member updated'); }
    else { await createMutation.mutateAsync(payload); toast.success('Member added'); }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this team member?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
  }

  async function renewCSCS(id: string) {
    try {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      await updateMutation.mutateAsync({ id, data: { cscs_expiry: nextYear.toISOString().split('T')[0] } });
      toast.success('CSCS card renewed');
    } catch { toast.error('Failed to renew CSCS card'); }
  }

  async function handleUploadCscsCert(memberId: string, file: File) {
    setUploadingCscs(memberId);
    try {
      await uploadFile(file, 'REPORTS');
      toast.success(`Uploaded: ${file.name}`);
    } catch { toast.error('Upload failed'); } finally {
      setUploadingCscs(null);
    }
  }

  function getAvailabilityColor(status: string): string {
    switch (status) {
      case 'onsite': return 'bg-green-900 text-green-100';
      case 'office': return 'bg-yellow-900 text-yellow-100';
      case 'sick': return 'bg-red-900 text-red-100';
      case 'off': return 'bg-gray-800 text-gray-400';
      default: return 'bg-gray-800 text-gray-400';
    }
  }

  function getInductionColor(status: string): string {
    switch (status) {
      case 'current': return 'bg-green-900 text-green-100';
      case 'due_soon': return 'bg-amber-900 text-amber-100';
      case 'overdue': return 'bg-red-900 text-red-100';
      default: return 'bg-gray-800 text-gray-400';
    }
  }

  function MemberRow({ m }: { m: AnyRow }) {
    const id = String(m.id??'');
    const isExp = expanded === id;
    const isSelected = selectedIds.has(id);
    const expiring = (() => {
      if (!m.cscs_expiry) return false;
      const d = (new Date(String(m.cscs_expiry)).getTime() - Date.now()) / 86400000;
      return d < 60;
    })();
    const expired = (() => {
      if (!m.cscs_expiry) return false;
      return new Date(String(m.cscs_expiry)).getTime() < Date.now();
    })();
    return (
      <>
        <div className={`flex items-center gap-4 p-4 hover:bg-gray-800 cursor-pointer border-b border-gray-700 ${isSelected ? 'bg-blue-900/20' : ''}`} onClick={()=>setExpanded(isExp?null:id)}>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggle(id); }}
            className="flex-shrink-0 p-1"
          >
            {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-display text-sm flex-shrink-0">
            {String(m.name??'?').split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-white truncate">{String(m.name??'Unknown')}</p>
              {expired && <span className="text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded-full">CSCS Expired</span>}
              {!expired && expiring && <span className="text-xs bg-amber-900 text-amber-200 px-2 py-0.5 rounded-full">CSCS Expiring</span>}
              {!m.cscs_card && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">No CSCS</span>}
            </div>
            <p className="text-sm text-gray-400">{String(m.role??'')} {m.trade_type?`· ${m.trade_type}`:''}</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {!!m.daily_rate && <span className="text-sm font-medium text-gray-300">£{Number(m.daily_rate).toLocaleString()}/day</span>}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(m.status??'')] ?? 'bg-gray-800 text-gray-400'}`}>{String(m.status??'')}</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button type="button" onClick={e=>{e.stopPropagation();openEdit(m);}} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 rounded"><Edit2 size={14}/></button>
            <button type="button" onClick={e=>{e.stopPropagation();handleDelete(id);}} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded"><Trash2 size={14}/></button>
            {isExp?<ChevronUp size={16} className="text-gray-500"/>:<ChevronDown size={16} className="text-gray-500"/>}
          </div>
        </div>
        {isExp && (
          <div className="px-6 pb-4 bg-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b border-gray-700">
            {!!m.email && <div><p className="text-xs text-gray-400 mb-1">Email</p><a href={`mailto:${m.email}`} className="flex items-center gap-1 text-blue-400 hover:underline"><Mail size={12}/>{String(m.email)}</a></div>}
            {!!m.phone && <div><p className="text-xs text-gray-400 mb-1">Phone</p><a href={`tel:${m.phone}`} className="flex items-center gap-1 text-blue-400 hover:underline"><Phone size={12}/>{String(m.phone)}</a></div>}
            {!!m.cscs_card && <div><p className="text-xs text-gray-400 mb-1">CSCS Card</p><p className="flex items-center gap-1 text-yellow-400"><Award size={12}/>{String(m.cscs_card)} (Type: {String(m.cscs_type??'Gold')})</p></div>}
            {!!m.cscs_expiry && <div><p className="text-xs text-gray-400 mb-1">CSCS Expiry</p><p className={expiring?'text-red-400 font-medium':'text-gray-300'}>{String(m.cscs_expiry)}</p></div>}
            {!!m.notes && <div className="col-span-2 md:col-span-4"><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-gray-300">{String(m.notes)}</p></div>}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen text-gray-100">
      {/* Breadcrumbs */}
      <ModuleBreadcrumbs currentModule="teams" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-white">Team Management</h1>
          <p className="text-sm text-gray-400 mt-1">Site workforce & personnel records</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowTeamChat(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">
            <MessageSquare size={16}/><span>Team Chat</span>
          </button>
          <button type="button" onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm font-medium">
            <Download size={16}/><span>Import</span>
          </button>
          <ExportButton data={members} filename="team-members" />
          <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
            <Plus size={16}/><span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Labour Cost KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Active Workers', value:activeCount, icon:Users, colour:'text-blue-400', bg:'bg-blue-900/30' },
          { label:'Daily Labour Cost', value:`£${totalDailyCost.toLocaleString()}`, icon:PoundSterling, colour:'text-green-400', bg:'bg-green-900/30' },
          { label:'Weekly Forecast', value:`£${weeklyForecast.toLocaleString()}`, icon:Clock, colour:'text-purple-400', bg:'bg-purple-900/30' },
          { label:'Monthly Forecast', value:`£${monthlyForecast.toLocaleString()}`, icon:TrendingUp, colour:'text-orange-400', bg:'bg-orange-900/30' },
        ].map(kpi=>(
          <div key={kpi.label} className={`rounded-xl border border-gray-700 p-4 ${kpi.bg}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-800"><kpi.icon size={20} className={kpi.colour}/></div>
              <div><p className="text-xs text-gray-400">{kpi.label}</p><p className="text-xl font-display text-white">{kpi.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* CSCS Alert Banner */}
      {cscsExpiring > 0 && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-400 flex-shrink-0"/>
          <div>
            <p className="font-semibold text-amber-200">{cscsExpiring} CSCS card{cscsExpiring !== 1 ? 's' : ''} expiring within 30 days</p>
            <p className="text-sm text-amber-300">Review and renew certifications to maintain compliance</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {([
          { key:'members'    as const, label:'Members',     icon:Users },
          { key:'skills'     as const, label:'Skills',      icon:Shield },
          { key:'cscs'       as const, label:'CSCS Cards',  icon:Award },
          { key:'inductions' as const, label:'Inductions',  icon:Calendar },
          { key:'onsite'     as const, label:'On Site',     icon:MapPin },
        ]).map(t=>(
          <button type="button"  key={t.key} onClick={()=>setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${subTab===t.key?'border-orange-600 text-orange-400':'border-transparent text-gray-400 hover:text-gray-300'}`}>
            <t.icon size={16}/>
            {t.label}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {subTab === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center bg-gray-900 rounded-xl border border-gray-700 p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or role…" className="w-full pl-9 pr-4 py-2 text-sm input input-bordered text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
            </div>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="text-sm input input-bordered text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {['All',...STATUS_OPTIONS].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
              {filtered.length === 0 ? (
                <EmptyState
                icon={Users}
                title="No team members found"
                description="Add team members to start managing your workforce."
                variant="team"
              />
              ) : (
                filtered.map(m => <MemberRow key={String(m.id)} m={m} />)
              )}
            </div>
          )}
        </div>
      )}

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[
          { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: `Delete ${selectedCount} member(s)?` },
        ]}
        onClearSelection={clearSelection}
      />

      {showBulkImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Import Team Members</h2>
              <button type="button" onClick={() => setShowBulkImport(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6">
              <DataImporter
                onImport={handleBulkImport}
                format="csv"
                exampleData={{ name: '', role: '', trade_type: '', email: '', phone: '', daily_rate: '', cscs_card: '', cscs_type: 'Gold', status: 'Active', notes: '' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Skills Matrix Tab */}
      {subTab === 'skills' && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 cb-table-scroll touch-pan-x">
          {fetchingMemberData && (
            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"/></div>
          )}
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={() => {
                if (members.filter(m => m.status === 'Active').length === 0) { toast.error('No active members'); return; }
                setSkillMember(members.filter(m => m.status === 'Active')[0]);
                setSkillForm({ skill_name: '', status: 'no' });
                setEditingSkill(null);
                setShowSkillModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
            >
              <Plus size={14} /><span>Add Skill</span>
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Member</th>
                {SKILLS.map(skill => <th key={skill} className="text-center px-3 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider min-w-24">{skill}</th>)}
                <th className="px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {members.filter(m=>m.status==='Active').map(m=>{
                const memberSkillList = memberSkills[String(m.id)] || [];
                const skillsMap: Record<string, string> = {};
                memberSkillList.forEach((s: Skill) => { skillsMap[s.skill_name] = s.status; });
                return (
                  <tr key={String(m.id)} className="hover:bg-gray-800">
                    <td className="px-6 py-4 font-medium text-white">{String(m.name??'Unknown')}</td>
                    {SKILLS.map(skill=>{
                      const status = skillsMap[skill];
                      return (
                        <td key={skill} className="text-center px-3 py-4">
                          {status === 'yes' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-900 text-green-100"><CheckCircle2 size={14}/></span>}
                          {status === 'no' && <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-900 text-red-100">✗</span>}
                          {status === 'expired' && <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-900 text-amber-200">Exp</span>}
                          {!status && <span className="text-gray-500">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openAddSkill(m)} className="p-1 text-gray-500 hover:text-green-400" title="Add Skill"><Plus size={12}/></button>
                        {memberSkillList.length > 0 && (
                          <button type="button" onClick={() => openEditSkill(memberSkillList[0], m)} className="p-1 text-gray-500 hover:text-blue-400" title="Edit"><Pencil size={12}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.filter(m=>m.status==='Active').length === 0 && <div className="text-center py-12 text-gray-500"><Shield size={32} className="mx-auto mb-2 opacity-30"/><p>No active members to display</p></div>}
        </div>
      )}

      {/* CSCS Cards Tab */}
      {subTab === 'cscs' && (
        <div className="space-y-4">
          {cscsAlerts.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-300">⚠ {cscsAlerts.length} member{cscsAlerts.length !== 1 ? 's' : ''} with expired or expiring CSCS cards</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.filter(m=>m.status==='Active').map(m=>{
              const expiry = m.cscs_expiry ? new Date(String(m.cscs_expiry)) : null;
              const daysUntil = expiry ? Math.floor((expiry.getTime() - Date.now()) / 86400000) : null;
              const isExpired = daysUntil !== null && daysUntil < 0;
              const isExpiring = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;

              let colorClass = 'bg-green-900 text-green-100';
              if (isExpired) colorClass = 'bg-red-900 text-red-100';
              else if (isExpiring) colorClass = 'bg-amber-900 text-amber-100';

              return (
                <div key={String(m.id)} className={`rounded-xl border border-gray-700 p-5 ${colorClass}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-display">{String(m.name??'?').split(' ').map((n:string)=>n[0]).slice(0,1).join('')}</div>
                      <div>
                        <p className="font-semibold">{String(m.name??'Unknown')}</p>
                        <p className="text-xs opacity-75">{String(m.role??'')}</p>
                      </div>
                    </div>
                    {isExpired && <AlertTriangle size={20} className="text-red-300"/>}
                  </div>

                  <div className="space-y-3 text-sm">
                    {m.cscs_card ? (
                      <>
                        <div>
                          <p className="opacity-75 text-xs">Card Type</p>
                          <p className="font-semibold">{String(m.cscs_type??'Gold')}</p>
                        </div>
                        <div>
                          <p className="opacity-75 text-xs">Card Number</p>
                          <p className="font-mono">{String(m.cscs_card)}</p>
                        </div>
                        {expiry && (
                          <div>
                            <p className="opacity-75 text-xs">Expiry Date</p>
                            <p className="font-semibold">{expiry.toLocaleDateString()}</p>
                            {daysUntil !== null && (
                              <p className="text-xs opacity-75 mt-1">
                                {isExpired ? `Expired ${Math.abs(daysUntil)} days ago` : `${daysUntil} days remaining`}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="opacity-75">No CSCS card on file</p>
                    )}
                  </div>

                  <div className="w-full min-h-[7.5rem] mt-4 rounded-lg bg-white flex items-center justify-center p-2 border border-gray-600">
                    {m.cscs_card ? (
                      <img
                        src={cscsSiteCheckQrSrc(String(m.cscs_card), String(m.name ?? ''))}
                        alt={`CSCS site-check QR for ${String(m.name ?? 'member')}`}
                        width={112}
                        height={112}
                        className="object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-xs text-gray-600 text-center px-2">Add a card number to show a site-check QR</span>
                    )}
                  </div>

                  {Boolean(m.cscs_card) && isExpiring && (
                    <button type="button" onClick={()=>renewCSCS(String(m.id))} className="w-full mt-4 px-3 py-2 bg-gray-800/20 hover:bg-gray-800/30 rounded-lg text-sm font-medium transition-colors">
                      Renew Certificate
                    </button>
                  )}

                  <input
                    type="file"
                    id={`upload-cscs-${m.id}`}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadCscsCert(String(m.id), file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => document.getElementById(`upload-cscs-${m.id}`)?.click()}
                    disabled={uploadingCscs === String(m.id)}
                    className="w-full mt-2 px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload size={14} />
                    {uploadingCscs === String(m.id) ? 'Uploading...' : 'Upload CSCS Certificate'}
                  </button>
                </div>
              );
            })}
          </div>
          {members.filter(m=>m.status==='Active').length === 0 && <div className="text-center py-12 text-gray-500"><Award size={32} className="mx-auto mb-2 opacity-30"/><p>No active members to display</p></div>}
        </div>
      )}

      {/* Inductions Tab */}
      {subTab === 'inductions' && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 cb-table-scroll touch-pan-x">
          {fetchingMemberData && (
            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"/></div>
          )}
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={() => {
                const active = members.filter(m => m.status === 'Active');
                if (active.length === 0) { toast.error('No active members'); return; }
                openAddInduction(active[0]);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
            >
              <Plus size={14} /><span>Add Induction</span>
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Member</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Project</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Inducted</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Re-Induction Due</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {members.filter(m=>m.status==='Active').flatMap(m=>{
                const inds = memberInductions[String(m.id)] || [];
                return inds.map(ind=>(
                  <tr key={`${m.id}-${ind.project}`} className="hover:bg-gray-800">
                    <td className="px-6 py-4 font-medium text-white">{String(m.name??'Unknown')}</td>
                    <td className="px-6 py-4 text-gray-300">{ind.project}</td>
                    <td className="px-6 py-4 text-gray-400">{new Date(ind.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-gray-400">{(ind.next_due ? new Date(ind.next_due).toLocaleDateString() : '—')}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${getInductionColor(ind.status)}`}>
                        {ind.status === 'current' && 'Current'}
                        {ind.status === 'due_soon' && 'Due Soon'}
                        {ind.status === 'overdue' && 'Overdue'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEditInduction(ind, m)} className="p-1 text-gray-500 hover:text-blue-400" title="Edit"><Pencil size={12}/></button>
                        <button type="button" onClick={() => deleteInduction(ind, String(m.id))} className="p-1 text-gray-500 hover:text-red-400" title="Delete"><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
          {members.filter(m=>m.status==='Active').length === 0 && <div className="text-center py-12 text-gray-500"><Calendar size={32} className="mx-auto mb-2 opacity-30"/><p>No active members to display</p></div>}
        </div>
      )}

      {/* On Site Tab */}
      {subTab === 'onsite' && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 cb-table-scroll touch-pan-x">
          {fetchingMemberData && (
            <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"/></div>
          )}
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={() => {
                const active = members.filter(m => m.status === 'Active');
                if (active.length === 0) { toast.error('No active members'); return; }
                openAddAvail(active[0]);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
            >
              <Plus size={14} /><span>Add Availability</span>
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider">Member</th>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day=><th key={day} className="text-center px-4 py-3 text-xs font-semibold text-gray-300 uppercase">{day}</th>)}
                <th className="px-4 py-3 text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {members.filter(m=>m.status==='Active').map(m=>{
                const availList = memberAvailability[String(m.id)] || [];
                return (
                  <tr key={String(m.id)} className="hover:bg-gray-800">
                    <td className="px-6 py-4 font-medium text-white">{String(m.name??'Unknown')}</td>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day=>{
                      const projAvail = availList.find(a => a.project.toLowerCase().includes(day.toLowerCase()));
                      const status = projAvail?.status || 'off';
                      return (
                        <td key={day} className="text-center px-4 py-4">
                          <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${getAvailabilityColor(status)}`}>
                            {status === 'onsite' && 'On Site'}
                            {status === 'office' && 'Office'}
                            {status === 'sick' && 'Sick'}
                            {status === 'off' && 'Off'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openAddAvail(m)} className="p-1 text-gray-500 hover:text-green-400" title="Add"><Plus size={12}/></button>
                        {availList.length > 0 && (
                          <button type="button" onClick={() => openEditAvail(availList[0], m)} className="p-1 text-gray-500 hover:text-blue-400" title="Edit"><Pencil size={12}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.filter(m=>m.status==='Active').length === 0 && <div className="text-center py-12 text-gray-500"><MapPin size={32} className="mx-auto mb-2 opacity-30"/><p>No active members to display</p></div>}
        </div>
      )}

      {/* Member Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-semibold text-white">{editing?'Edit Member':'Add Team Member'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                  <input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">Select role…</option>
                    {ROLES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Trade Type</label>
                  <select value={form.trade_type} onChange={e=>setForm(f=>({...f,trade_type:e.target.value}))} className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">Select trade…</option>
                    {TRADE_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Daily Rate (£)</label>
                  <input type="number" step="0.01" value={form.daily_rate} onChange={e=>setForm(f=>({...f,daily_rate:e.target.value}))} className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CSCS Card Number</label>
                  <input value={form.cscs_card} onChange={e=>setForm(f=>({...f,cscs_card:e.target.value}))} className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CSCS Card Type</label>
                  <select value={form.cscs_type} onChange={e=>setForm(f=>({...f,cscs_type:e.target.value}))} className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {CSCS_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CSCS Expiry Date</label>
                  <input type="date" value={form.cscs_expiry} onChange={e=>setForm(f=>({...f,cscs_expiry:e.target.value}))} className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {editing?'Update Member':'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Skill Modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">{editingSkill ? 'Edit Skill' : 'Add Skill'}</h2>
              <button type="button" onClick={() => setShowSkillModal(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Member</label>
                <select
                  value={skillMember ? String(skillMember.id) : ''}
                  onChange={e => {
                    const found = members.find(m => String(m.id) === e.target.value);
                    if (found) setSkillMember(found);
                  }}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select member…</option>
                  {members.filter(m => m.status === 'Active').map(m => <option key={String(m.id)} value={String(m.id)}>{String(m.name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Skill</label>
                <select
                  value={skillForm.skill_name}
                  onChange={e => setSkillForm(f => ({ ...f, skill_name: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select skill…</option>
                  {SKILLS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  value={skillForm.status}
                  onChange={e => setSkillForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              {editingSkill && skillMember && (
                <button
                  type="button"
                  onClick={() => { setShowSkillModal(false); deleteSkill(String(editingSkill.id), String(skillMember.id ?? '')); }}
                  className="px-4 py-2 border border-red-700 text-red-400 rounded-lg text-sm hover:bg-red-900/30"
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={() => setShowSkillModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
              <button
                type="button"
                onClick={saveSkill}
                disabled={!skillMember || !skillForm.skill_name}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {editingSkill ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Induction Modal */}
      {showInductionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">{editingInduction ? 'Edit Induction' : 'Add Induction'}</h2>
              <button type="button" onClick={() => setShowInductionModal(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Member</label>
                <select
                  value={inductionMember ? String(inductionMember.id) : ''}
                  onChange={e => {
                    const found = members.find(m => String(m.id) === e.target.value);
                    if (found) setInductionMember(found);
                  }}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select member…</option>
                  {members.filter(m => m.status === 'Active').map(m => <option key={String(m.id)} value={String(m.id)}>{String(m.name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
                <input
                  type="text"
                  value={inductionForm.project}
                  onChange={e => setInductionForm(f => ({ ...f, project: e.target.value }))}
                  placeholder="e.g. Site A"
                  className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Induction Date</label>
                <input
                  type="date"
                  value={inductionForm.date}
                  onChange={e => setInductionForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Re-Induction Due</label>
                <input
                  type="date"
                  value={inductionForm.next_due}
                  onChange={e => setInductionForm(f => ({ ...f, next_due: e.target.value }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  value={inductionForm.status}
                  onChange={e => setInductionForm(f => ({ ...f, status: e.target.value as Induction['status'] }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="current">Current</option>
                  <option value="due_soon">Due Soon</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              {editingInduction && inductionMember && (
                <button
                  type="button"
                  onClick={() => { setShowInductionModal(false); deleteInduction(editingInduction, String(inductionMember.id)); }}
                  className="px-4 py-2 border border-red-700 text-red-400 rounded-lg text-sm hover:bg-red-900/30"
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={() => setShowInductionModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
              <button
                type="button"
                onClick={saveInduction}
                disabled={!inductionMember || !inductionForm.project || !inductionForm.date}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {editingInduction ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Modal */}
      {showAvailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">{editingAvail ? 'Edit Availability' : 'Add Availability'}</h2>
              <button type="button" onClick={() => setShowAvailModal(false)} className="p-2 hover:bg-gray-800 rounded-lg"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Member</label>
                <select
                  value={availMember ? String(availMember.id) : ''}
                  onChange={e => {
                    const found = members.find(m => String(m.id) === e.target.value);
                    if (found) setAvailMember(found);
                  }}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select member…</option>
                  {members.filter(m => m.status === 'Active').map(m => <option key={String(m.id)} value={String(m.id)}>{String(m.name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
                <input
                  type="text"
                  value={availForm.project}
                  onChange={e => setAvailForm(f => ({ ...f, project: e.target.value }))}
                  placeholder="e.g. Site A or Mon/Tue/Wed/Thu/Fri"
                  className="w-full input input-bordered w-full placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  value={availForm.status}
                  onChange={e => setAvailForm(f => ({ ...f, status: e.target.value as Availability['status'] }))}
                  className="w-full input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="onsite">On Site</option>
                  <option value="office">Office</option>
                  <option value="sick">Sick</option>
                  <option value="off">Off</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              {editingAvail && availMember && (
                <button
                  type="button"
                  onClick={() => { setShowAvailModal(false); deleteAvail(editingAvail, String(availMember.id)); }}
                  className="px-4 py-2 border border-red-700 text-red-400 rounded-lg text-sm hover:bg-red-900/30"
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={() => setShowAvailModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
              <button
                type="button"
                onClick={saveAvail}
                disabled={!availMember || !availForm.project}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {editingAvail ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Chat Modal */}
      {showTeamChat && (
        <TeamChat onClose={() => setShowTeamChat(false)} />
      )}
    </div>
  );
}

function TrendingUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
export default React.memo(Teams);
