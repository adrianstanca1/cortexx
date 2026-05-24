import React, { useState, useMemo } from 'react';
import {
  Calendar, Plus, Search, Clock, CheckCircle2, Users, Edit2, Trash2, X,
  ChevronDown, ChevronUp, Video, AlertCircle, FileText, MoreVertical, Building2, CheckSquare, Square, Download
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { useMeetings } from '../../hooks/useData';
import { toast } from 'sonner';

type AnyRow = Record<string, unknown>;

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  meetingId: string;
  meetingTitle: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
}

const MEETING_TYPES = ['Progress','Design','Safety','Client','Internal'];
const STATUS_OPTIONS = ['Upcoming','In Progress','Completed','Cancelled'];
const _ACTION_STATUSES = ['Open','In Progress','Completed'];
const _PRIORITIES = ['High','Medium','Low'];

const statusColour: Record<string,string> = {
  'Upcoming':'bg-blue-900/30 text-blue-300','In Progress':'bg-green-900/30 text-green-300',
  'Completed':'bg-gray-900/50 text-gray-400','Cancelled':'bg-red-900/30 text-red-300',
};

const priorityColour: Record<string,string> = {
  'High':'text-red-400 bg-red-900/30','Medium':'text-yellow-400 bg-yellow-900/30','Low':'text-green-400 bg-green-900/30',
};

const emptyForm = { title:'',meeting_type:'Progress',date:'',time:'',location:'',attendees:'',agenda:'',minutes:'',actions:'',status:'Upcoming',project_id:'',link:'' };

export function Meetings() {
  const { useList, useCreate, useUpdate, useDelete } = useMeetings;
  const { data: raw = [], isLoading } = useList();
  const meetings = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [activeTab, setActiveTab] = useState<'meetings'|'actions'|'calendar'|'minutes'>('meetings');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<AnyRow | null>(null);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [actionFilter, setActionFilter] = useState('Open');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} meeting(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} meeting(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const today = new Date().toISOString().slice(0,10);

  // Parse action items from meetings
  const allActionItems: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [];
    meetings.forEach((m) => {
      const actionsStr = String(m.actions??'').trim();
      if (!actionsStr) return;
      const lines = actionsStr.split('\n').filter(l=>l.trim());
      lines.forEach((line, idx) => {
        const parts = line.split('|').map(p=>p.trim());
        items.push({
          id: `${m.id}-action-${idx}`,
          task: parts[0] || 'Untitled',
          owner: parts[1] || 'Unassigned',
          meetingId: String(m.id??''),
          meetingTitle: String(m.title??''),
          dueDate: parts[2] || String(m.date??''),
          status: (parts[3] as 'Open'|'In Progress'|'Completed') || 'Open',
          priority: (parts[4] as 'High'|'Medium'|'Low') || 'Medium',
        });
      });
    });
    return items;
  }, [meetings]);

  // Filter meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const title = String(m.title??'').toLowerCase();
      const type = String(m.meeting_type??'').toLowerCase();
      const project = String(m.project_id??'').toLowerCase();
      const matchSearch = title.includes(search.toLowerCase()) || type.includes(search.toLowerCase()) || project.includes(search.toLowerCase());
      let matchType = true;
      if (filterType === 'Upcoming') matchType = String(m.date??'') >= today && m.status !== 'Cancelled' && m.status !== 'Completed';
      else if (filterType === 'Past') matchType = String(m.date??'') < today || m.status === 'Completed';
      else if (filterType !== 'All') matchType = m.status === filterType;
      return matchSearch && matchType;
    });
  }, [meetings, search, filterType, today]);

  // Filter action items
  const filteredActions = useMemo(() => {
    return allActionItems.filter(a => {
      if (actionFilter === 'Overdue') return a.dueDate < today && a.status !== 'Completed';
      if (actionFilter !== 'All') return a.status === actionFilter;
      return true;
    });
  }, [allActionItems, actionFilter, today]);

  // Stats
  const stats = useMemo(() => {
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    const twoWeeksStr = twoWeeks.toISOString().slice(0,10);

    return {
      total: meetings.length,
      upcoming: meetings.filter(m => String(m.date??'') >= today && String(m.date??'') <= twoWeeksStr && m.status !== 'Cancelled').length,
      actions: allActionItems.filter(a => a.status !== 'Completed').length,
      thisMonth: meetings.filter(m => {
        const d = String(m.date??'');
        return d.startsWith(today.slice(0,7));
      }).length,
    };
  }, [meetings, allActionItems, today]);

  function openCreate() { setEditing(null); setForm({ ...emptyForm, date:today }); setShowModal(true); }

  function openEdit(m: AnyRow) {
    setEditing(m);
    setForm({
      title:String(m.title??''),meeting_type:String(m.meeting_type??'Progress'),date:String(m.date??''),
      time:String(m.time??''),location:String(m.location??''),attendees:String(m.attendees??''),
      agenda:String(m.agenda??''),minutes:String(m.minutes??''),actions:String(m.actions??''),
      status:String(m.status??'Upcoming'),project_id:String(m.project_id??''),link:String(m.link??'')
    });
    setShowModal(true);
  }

  function openDetail(m: AnyRow) {
    setSelectedMeeting(m);
    setShowDetailModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id:String(editing.id), data:form });
        toast.success('Meeting updated');
      } else {
        await createMutation.mutateAsync(form);
        toast.success('Meeting scheduled');
      }
      setShowModal(false);
    } catch {
      toast.error('Error saving meeting');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this meeting?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Meeting deleted');
    } catch {
      toast.error('Error deleting meeting');
    }
  }

  async function markMeetingComplete(m: AnyRow) {
    try {
      await updateMutation.mutateAsync({ id:String(m.id), data:{ status:'Completed' } });
      toast.success('Meeting marked complete');
    } catch {
      toast.error('Error updating meeting');
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getMeetingsForDate = (dateStr: string) => {
    return meetings.filter(m => String(m.date??'') === dateStr);
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="meetings" />
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-gray-100">Meetings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage meetings, minutes & action items</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors">
          <Plus size={16}/><span>New Meeting</span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total Meetings', value:stats.total, icon:Calendar, colour:'text-blue-400', bg:'bg-blue-900/30' },
          { label:'Upcoming (14d)', value:stats.upcoming, icon:Clock, colour:'text-green-400', bg:'bg-green-900/30' },
          { label:'Open Actions', value:stats.actions, icon:AlertCircle, colour:'text-red-400', bg:'bg-red-900/30' },
          { label:'This Month', value:stats.thisMonth, icon:FileText, colour:'text-purple-400', bg:'bg-purple-900/30' },
        ].map(kpi=>(
          <div key={kpi.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bg}`}><kpi.icon size={20} className={kpi.colour}/></div>
              <div><p className="text-xs text-gray-400">{kpi.label}</p><p className="text-2xl font-display text-gray-100">{kpi.value}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { id:'meetings', label:'Meetings', count:filteredMeetings.length },
          { id:'minutes', label:'Minutes', count:meetings.filter(m=>m.minutes).length },
          { id:'actions', label:'Action Tracker', count:allActionItems.filter(a=>a.status!=='Completed').length },
          { id:'calendar', label:'Calendar', count:'' },
        ].map(tab=>(
          <button type="button"  key={tab.id} onClick={()=>setActiveTab(tab.id as 'meetings'|'actions'|'calendar'|'minutes')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab===tab.id?'border-orange-600 text-orange-400':'border-transparent text-gray-400 hover:text-gray-300'
            }`}>
            {tab.label}
            {tab.count !== '' && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab===tab.id?'bg-orange-900/30 text-orange-300':'bg-gray-700/50 text-gray-400'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-wrap gap-3 items-center bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search meetings…" className="w-full pl-9 pr-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
            </div>
            <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="text-sm bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
              {['All','Upcoming','Past',...STATUS_OPTIONS].map(s=><option key={s}>{s}</option>)}
            </select>
            <span className="text-sm text-gray-400 ml-auto">{filteredMeetings.length} meetings</span>
          </div>

          {/* Meetings List */}
          {isLoading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"/></div>
          ) : filteredMeetings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No meetings found"
              description="Schedule a meeting to get started."
            />
          ) : (
            <div className="grid gap-4">
              {filteredMeetings.map(m => {
                const id = String(m.id??'');
                const isSelected = selectedIds.has(id);
                const isToday = String(m.date??'') === today;
                const attendeeCount = String(m.attendees??'').split(',').filter(a=>a.trim()).length;
                const agendaCount = String(m.agenda??'').split('\n').filter(a=>a.trim()).length;
                const actionCount = String(m.actions??'').split('\n').filter(a=>a.trim()).length;

                return (
                  <div key={id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors cursor-pointer" onClick={()=>openDetail(m)}>
                    <div className="flex items-start justify-between gap-4">
                      <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                        {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-display text-gray-100 truncate">{String(m.title??'Untitled')}</h3>
                          {isToday && <span className="text-xs bg-orange-900/30 text-orange-300 px-2 py-0.5 rounded-full flex-shrink-0">Today</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-3">
                          <span className="bg-gray-700/50 px-2 py-1 rounded">{String(m.meeting_type??'')}</span>
                          {!!m.project_id && <span className="bg-gray-700/50 px-2 py-1 rounded">{String(m.project_id)}</span>}
                          {String(m.date??'') && <span className="flex items-center gap-1"><Calendar size={12}/>{String(m.date??'').slice(5)}</span>}
                          {String(m.time??'') && <span className="flex items-center gap-1"><Clock size={12}/>{String(m.time)}</span>}
                          {String(m.location??'') && <span className="flex items-center gap-1"><Building2 size={12}/>{String(m.location)}</span>}
                          {!!m.link && <span className="flex items-center gap-1"><Video size={12}/>Online</span>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          {attendeeCount > 0 && <span className="flex items-center gap-1"><Users size={12}/>{attendeeCount} attendee{attendeeCount!==1?'s':''}</span>}
                          {agendaCount > 0 && <span>{agendaCount} agenda item{agendaCount!==1?'s':''}</span>}
                          {actionCount > 0 && <span className="text-orange-400">{actionCount} action{actionCount!==1?'s':''}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(m.status??'')] ?? 'bg-gray-700/50 text-gray-300'}`}>{String(m.status??'')}</span>
                        <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                          {m.status==='Upcoming' && <button type="button" onClick={()=>markMeetingComplete(m)} className="p-1.5 text-green-400 hover:bg-green-900/30 rounded transition-colors" title="Mark Complete"><CheckCircle2 size={16}/></button>}
                          <button type="button" onClick={()=>openEdit(m)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded transition-colors"><Edit2 size={16}/></button>
                          <button type="button" onClick={()=>handleDelete(id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 size={16}/></button>
                          <button className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition-colors"><MoreVertical size={16}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <BulkActionsBar
                selectedIds={Array.from(selectedIds)}
                actions={[
                  { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
                ]}
                onClearSelection={clearSelection}
              />
            </div>
          )}
        </div>
      )}

      {/* Minutes Tab */}
      {activeTab === 'minutes' && (
        <MeetingMinutesTab meetings={meetings} updateMutation={updateMutation} />
      )}

      {/* Action Tracker Tab */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['All','Open','In Progress','Completed','Overdue'].map(status=>(
              <button type="button"  key={status} onClick={()=>setActionFilter(status)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                actionFilter===status?'bg-orange-600 text-white':'bg-gray-800 border border-gray-700 text-gray-300 hover:text-gray-100'
              }`}>
                {status}
              </button>
            ))}
            <span className="ml-auto text-sm text-gray-400 py-1.5">{filteredActions.length} item{filteredActions.length!==1?'s':''}</span>
          </div>

          {/* Actions Table */}
          {filteredActions.length === 0 ? (
            <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700"><FileText size={40} className="mx-auto mb-3 opacity-30 text-gray-600"/><p className="text-gray-400">No action items</p></div>
          ) : (
            <div className="cb-table-scroll touch-pan-x bg-gray-800 rounded-xl border border-gray-700">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700 bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-display text-gray-300 tracking-widest">Task</th>
                    <th className="text-left px-4 py-3 font-display text-gray-300 tracking-widest">Owner</th>
                    <th className="text-left px-4 py-3 font-display text-gray-300 tracking-widest">Meeting</th>
                    <th className="text-left px-4 py-3 font-display text-gray-300 tracking-widest">Due</th>
                    <th className="text-left px-4 py-3 font-display text-gray-300 tracking-widest">Priority</th>
                    <th className="text-left px-4 py-3 font-display text-gray-300 tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredActions.map(action => {
                    const isOverdue = action.dueDate < today && action.status !== 'Completed';
                    return (
                      <tr key={action.id} className={`hover:bg-gray-700/50 transition-colors ${isOverdue?'bg-red-900/20':''}`}>
                        <td className="px-4 py-3 text-gray-200">{action.task}</td>
                        <td className="px-4 py-3 text-gray-300">{action.owner}</td>
                        <td className="px-4 py-3"><span className="text-blue-400 hover:underline cursor-pointer" onClick={()=>{setSelectedMeeting(meetings.find(m=>String(m.id)===action.meetingId)??null); setShowDetailModal(true);}}>{action.meetingTitle}</span></td>
                        <td className="px-4 py-3 text-gray-400">{action.dueDate}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${priorityColour[action.priority]??''}`}>{action.priority}</span></td>
                        <td className="px-4 py-3">
                          <select value={action.status} onChange={(e)=>{
                            const newStatus = e.target.value as 'Open'|'In Progress'|'Completed';
                            const meeting = meetings.find(m=>String(m.id)===action.meetingId);
                            if (meeting) {
                              const lines = String(meeting.actions??'').split('\n');
                              lines[parseInt(action.id.split('-')[2])] = `${action.task}|${action.owner}|${action.dueDate}|${newStatus}|${action.priority}`;
                              updateMutation.mutateAsync({ id:action.meetingId, data:{ actions:lines.join('\n') } }).then(()=>toast.success('Action updated'));
                            }
                          }} className={`text-xs px-2 py-1 rounded-full font-medium border-0 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer ${
                            action.status==='Open'?'bg-blue-900/30 text-blue-300':
                            action.status==='In Progress'?'bg-yellow-900/30 text-yellow-300':
                            'bg-green-900/30 text-green-300'
                          }`}>
                            {['Open','In Progress','Completed'].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-display text-gray-100">{calendarMonth.toLocaleString('default',{month:'long',year:'numeric'})}</h3>
            <div className="flex gap-2">
              <button type="button" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1))} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronDown size={18} className="text-gray-400"/>
              </button>
              <button type="button" onClick={()=>setCalendarMonth(new Date())} className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 rounded-lg transition-colors">Today</button>
              <button type="button" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1))} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronUp size={18} className="text-gray-400"/>
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({length:getFirstDayOfMonth(calendarMonth)}).map((_,i)=><div key={`empty-${i}`} className="aspect-square bg-gray-700/30 rounded-lg"/>)}
              {Array.from({length:getDaysInMonth(calendarMonth)}).map((_,i)=>{
                const date = new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),i+1);
                const dateStr = date.toISOString().slice(0,10);
                const dayMeetings = getMeetingsForDate(dateStr);
                const isToday = dateStr === today;

                return (
                  <div key={i} className={`aspect-square rounded-lg border-2 p-1 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isToday?'bg-orange-900/30 border-orange-600':'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                  }`} onClick={()=>{if(dayMeetings.length>0) setSelectedMeeting(dayMeetings[0]); setShowDetailModal(true);}}>
                    <p className={`text-sm font-semibold ${isToday?'text-orange-300':'text-gray-300'}`}>{i+1}</p>
                    {dayMeetings.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center w-full">
                        {dayMeetings.slice(0,3).map((m,idx)=><div key={idx} className="w-1.5 h-1.5 rounded-full bg-orange-400"/>)}
                        {dayMeetings.length > 3 && <span className="text-xs text-gray-400">+{dayMeetings.length-3}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Meeting Detail Modal */}
      {showDetailModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-gray-100">Meeting Details</h2>
              <button type="button" onClick={()=>setShowDetailModal(false)} className="p-2 hover:bg-gray-700 rounded-lg transition-colors"><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="space-y-3">
                <div><h3 className="text-2xl font-bold text-gray-100">{String(selectedMeeting.title??'')}</h3></div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColour[String(selectedMeeting.status??'')] ?? 'bg-gray-700/50 text-gray-300'}`}>{String(selectedMeeting.status??'')}</span>
                  <span className="bg-gray-700/50 text-gray-300 text-xs px-2 py-1 rounded-full">{String(selectedMeeting.meeting_type??'')}</span>
                  {!!selectedMeeting.project_id && <span className="bg-gray-700/50 text-gray-300 text-xs px-2 py-1 rounded-full">{String(selectedMeeting.project_id)}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {!!selectedMeeting.date && <div><p className="text-xs text-gray-400 font-semibold mb-1">DATE</p><p className="text-gray-200">{String(selectedMeeting.date)}</p></div>}
                {!!selectedMeeting.time && <div><p className="text-xs text-gray-400 font-semibold mb-1">TIME</p><p className="text-gray-200">{String(selectedMeeting.time)}</p></div>}
                {!!selectedMeeting.location && <div><p className="text-xs text-gray-400 font-semibold mb-1">LOCATION</p><p className="text-gray-200">{String(selectedMeeting.location)}</p></div>}
                {!!selectedMeeting.link && <div><p className="text-xs text-gray-400 font-semibold mb-1">MEETING LINK</p><a href={String(selectedMeeting.link)} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all text-xs">{String(selectedMeeting.link)}</a></div>}
              </div>

              {!!selectedMeeting.attendees && (
                <div><p className="text-xs text-gray-400 font-semibold mb-2">ATTENDEES</p><p className="text-gray-200">{String(selectedMeeting.attendees)}</p></div>
              )}

              {!!selectedMeeting.agenda && (
                <div><p className="text-xs text-gray-400 font-semibold mb-2">AGENDA</p><p className="text-gray-200 whitespace-pre-wrap">{String(selectedMeeting.agenda)}</p></div>
              )}

              {!!selectedMeeting.minutes && (
                <div><p className="text-xs text-gray-400 font-semibold mb-2">MINUTES</p><p className="text-gray-200 whitespace-pre-wrap">{String(selectedMeeting.minutes)}</p></div>
              )}

              {!!selectedMeeting.actions && (
                <div><p className="text-xs text-orange-400 font-semibold mb-2">ACTION ITEMS</p><p className="text-gray-200 whitespace-pre-wrap">{String(selectedMeeting.actions)}</p></div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button type="button" onClick={()=>{openEdit(selectedMeeting); setShowDetailModal(false);}} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Edit Meeting</button>
                {selectedMeeting.status !== 'Completed' && <button type="button" onClick={()=>{markMeetingComplete(selectedMeeting); setShowDetailModal(false);}} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Mark Complete</button>}
                <button type="button" onClick={()=>setShowDetailModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
              <h2 className="text-lg font-semibold text-gray-100">{editing?'Edit Meeting':'New Meeting'}</h2>
              <button type="button" onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-700 rounded-lg transition-colors"><X size={18} className="text-gray-400"/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Meeting Title *</label>
                  <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select value={form.meeting_type} onChange={e=>setForm(f=>({...f,meeting_type:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {MEETING_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Time</label>
                  <input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                  <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Site Office" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
                  <input value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))} placeholder="Project ID or name" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Attendees</label>
                  <input value={form.attendees} onChange={e=>setForm(f=>({...f,attendees:e.target.value}))} placeholder="e.g. John Smith, Sarah Jones" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Agenda</label>
                  <textarea rows={3} value={form.agenda} onChange={e=>setForm(f=>({...f,agenda:e.target.value}))} placeholder="One item per line" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Minutes</label>
                  <textarea rows={3} value={form.minutes} onChange={e=>setForm(f=>({...f,minutes:e.target.value}))} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Action Items</label>
                  <textarea rows={3} value={form.actions} onChange={e=>setForm(f=>({...f,actions:e.target.value}))} placeholder="Format: Task|Owner|DueDate|Status|Priority (one per line)" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Meeting Link</label>
                  <input type="url" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))} placeholder="https://teams.microsoft.com/…" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-700">
                <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending||updateMutation.isPending} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
                  {editing?'Update':'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
function MeetingMinutesTab({ meetings, updateMutation }: { meetings: AnyRow[]; updateMutation: any }) {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [minutesContent, setMinutesContent] = useState('');
  const [actionItems, setActionItems] = useState<Array<{ id: string; who: string; what: string; byWhen: string }>>([]);
  const [newAction, setNewAction] = useState({ who: '', what: '', byWhen: '' });

  const meetingsWithMinutes = meetings.filter(m => String(m.minutes ?? '').trim());

  const handleSelectMeeting = (meetingId: string) => {
    const meeting = meetings.find(m => String(m.id) === meetingId);
    if (meeting) {
      setSelectedMeetingId(meetingId);
      setMinutesContent(String(meeting.minutes ?? ''));
      const actions: Array<{ id: string; who: string; what: string; byWhen: string }> = [];
      const actionLines = String(meeting.actions ?? '').split('\n').filter(l => l.trim());
      actionLines.forEach((line, idx) => {
        const parts = line.split('|').map(p => p.trim());
        actions.push({
          id: `${meetingId}-action-${idx}`,
          what: parts[0] || '',
          who: parts[1] || '',
          byWhen: parts[2] || '',
        });
      });
      setActionItems(actions);
    }
  };

  const handleAddAction = () => {
    if (!newAction.who.trim() || !newAction.what.trim() || !newAction.byWhen.trim()) {
      toast.error('All action fields are required');
      return;
    }
    setActionItems([...actionItems, {
      id: `action-${Date.now()}`,
      ...newAction,
    }]);
    setNewAction({ who: '', what: '', byWhen: '' });
  };

  const handleRemoveAction = (id: string) => {
    setActionItems(actionItems.filter(a => a.id !== id));
  };

  const handleSaveMinutes = async () => {
    if (!selectedMeetingId) return;
    const actionStr = actionItems.map(a => `${a.what}|${a.who}|${a.byWhen}|Open|High`).join('\n');
    try {
      await updateMutation.mutateAsync({
        id: selectedMeetingId,
        data: { minutes: minutesContent, actions: actionStr },
      });
      toast.success('Minutes saved');
    } catch {
      toast.error('Failed to save minutes');
    }
  };

  const handleFinaliseAndSend = () => {
    if (!selectedMeetingId) return;
    toast.success('Minutes finalised and sent to attendees');
    handleSaveMinutes();
  };

  if (!selectedMeetingId) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {meetingsWithMinutes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>No meetings with minutes yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {meetingsWithMinutes.map(m => (
                <button
                  key={String(m.id)}
                  onClick={() => handleSelectMeeting(String(m.id))}
                  className="w-full text-left p-4 hover:bg-gray-700/50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-gray-100">{String(m.title ?? '')}</h4>
                    <p className="text-sm text-gray-400 mt-1">{String(m.date ?? '')} · {String(m.location ?? 'Online')}</p>
                  </div>
                  <span className="px-2 py-1 bg-green-900/30 text-green-300 text-xs rounded-full">Finalised</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentMeeting = meetings.find(m => String(m.id) === selectedMeetingId);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setSelectedMeetingId(null)}
        className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
      >
        <ChevronDown className="h-4 w-4 rotate-90" />
        Back to Minutes List
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-100">{String(currentMeeting?.title ?? '')}</h3>
              <p className="text-sm text-gray-400 mt-1">{String(currentMeeting?.date ?? '')} · Attendees: {String(currentMeeting?.attendees ?? 'N/A')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Minutes</label>
              <textarea
                value={minutesContent}
                onChange={e => setMinutesContent(e.target.value)}
                placeholder="Document the key points, decisions, and outcomes from the meeting..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-gray-100 text-sm h-80 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <button className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
              <Download size={16} />
              Export to Word
            </button>
            <button className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
              <Download size={16} />
              Export to PDF
            </button>
          </div>
        </div>

        {/* Action Items Sidebar */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 h-fit">
          <h4 className="font-semibold text-gray-100 mb-3">Action Items</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {actionItems.map(action => (
              <div key={action.id} className="bg-gray-700/50 rounded p-3 border border-gray-600">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-200">{action.what}</p>
                  <button
                    onClick={() => handleRemoveAction(action.id)}
                    className="text-gray-400 hover:text-red-400 text-xs"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-1">Owner: <span className="text-gray-300">{action.who}</span></p>
                <p className="text-xs text-gray-400">Due: <span className="text-gray-300">{action.byWhen}</span></p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-700 mt-4 pt-4 space-y-2">
            <label className="block text-xs text-gray-400 font-semibold mb-2">ADD ACTION ITEM</label>
            <input
              type="text"
              value={newAction.what}
              onChange={e => setNewAction({ ...newAction, what: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="text"
              value={newAction.who}
              onChange={e => setNewAction({ ...newAction, who: e.target.value })}
              placeholder="Who is responsible?"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="date"
              value={newAction.byWhen}
              onChange={e => setNewAction({ ...newAction, byWhen: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={handleAddAction}
              className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium text-white transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Save Buttons */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setSelectedMeetingId(null)}
          className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveMinutes}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Save Minutes
        </button>
        <button
          onClick={handleFinaliseAndSend}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Finalise & Send
        </button>
      </div>
    </div>
  );
}

export default React.memo(Meetings);
