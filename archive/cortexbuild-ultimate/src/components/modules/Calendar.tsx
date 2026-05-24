import React, { useMemo, useState } from 'react';
import { useMeetings, useTeam, useEquipment } from '../../hooks/useData';
import { useSyncedPreference } from '../../hooks/useSyncedPreference';
import { toast } from 'sonner';
import {
  Plus, X, ChevronLeft, ChevronRight, MapPin, Users, AlertTriangle, Calendar as CalendarIcon, Flag, Zap, CheckSquare, Square, Trash2, HardHat
} from 'lucide-react';
import { BulkActionsBar, useBulkSelection } from '../ui/BulkActions';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type AnyRow = Record<string, unknown>;
type SubTab = 'month' | 'week' | 'events' | 'deadlines' | 'resources';

const EVENT_TYPES: Record<string, string> = {
  meeting: 'bg-blue-500/20 text-blue-300',
  deadline: 'bg-orange-500/20 text-orange-300',
  site_visit: 'bg-green-500/20 text-green-300',
  urgent: 'bg-red-500/20 text-red-300',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 13 }, (_, i) => `${7 + i}:00`);

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** True if this person appears on a calendar entry for the given day (meetings / site visits, not bare deadlines). */
function personBookedOnDay(personName: string, dayStr: string, meetingRows: AnyRow[]): boolean {
  const trimmed = personName.trim();
  if (!trimmed) return false;
  const full = trimmed.toLowerCase();
  const tokens = trimmed
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  return meetingRows.some((e) => {
    if (String(e.date ?? '') !== dayStr) return false;
    if (String(e.type ?? '') === 'deadline') return false;
    const hay = `${e.attendees ?? ''} ${e.title ?? ''} ${e.description ?? ''}`.toLowerCase();
    if (hay.includes(full)) return true;
    return tokens.some((t) => hay.includes(t));
  });
}

/** True if plant name appears in meeting title, notes, or location that day. */
function equipmentReferencedOnDay(eqName: string, dayStr: string, meetingRows: AnyRow[]): boolean {
  const n = eqName.trim().toLowerCase();
  if (!n) return false;
  return meetingRows.some((e) => {
    if (String(e.date ?? '') !== dayStr) return false;
    const hay = `${e.title ?? ''} ${e.description ?? ''} ${e.location ?? ''}`.toLowerCase();
    return hay.includes(n);
  });
}

export function Calendar() {
  const { useList, useCreate, useUpdate, useDelete } = useMeetings;
  const { data: raw = [], isLoading: meetingsLoading } = useList();
  const { data: teamMembers = [], isLoading: teamLoading } = useTeam.useList();
  const { data: equipmentRows = [], isLoading: equipmentLoading } = useEquipment.useList();
  const events = raw as AnyRow[];
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const [subTab, setSubTab] = useSyncedPreference<SubTab>('calendar.subTab', 'month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState({
    title: '',
    type: 'meeting',
    date: new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '10:00',
    location: '',
    attendees: '',
    description: '',
    recurring: false,
  });

  const { selectedIds, toggle, clearSelection } = useBulkSelection();

  async function handleBulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} item(s)?`)) return;
    try {
      await Promise.all(ids.map(id => deleteMutation.mutateAsync(id)));
      toast.success(`Deleted ${ids.length} item(s)`);
      clearSelection();
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y: number, m: number) =>
    new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) =>
    new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = (getFirstDayOfMonth(year, month) + 6) % 7;
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => String(e.date ?? '') === dateStr);
  };

  const upcomingEvents = events
    .filter((e) => String(e.date ?? '') >= today)
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
    .slice(0, 10);

  const thisMonthDeadlines = events
    .filter(
      (e) =>
        String(e.type ?? '') === 'deadline' &&
        String(e.date ?? '').startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
    )
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));

  const overdue = thisMonthDeadlines.filter((d) => String(d.date ?? '') < today);
  const upcoming = thisMonthDeadlines.filter((d) => String(d.date ?? '') >= today);

  const daysRemaining = (dateStr: string) => {
    const target = new Date(String(dateStr));
    const diff = Math.ceil((target.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const workWeekDates = useMemo(() => {
    const mon = startOfWeekMonday(currentDate);
    return [0, 1, 2, 3, 4].map((i) => toYMD(addDays(mon, i)));
  }, [currentDate]);

  const workWeekLabels = useMemo(() => {
    const mon = startOfWeekMonday(currentDate);
    return [0, 1, 2, 3, 4].map((i) => {
      const d = addDays(mon, i);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    });
  }, [currentDate]);

  const tabLoading =
    subTab === 'resources'
      ? meetingsLoading || teamLoading || equipmentLoading
      : meetingsLoading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await updateMutation.mutateAsync({ id: String(editing.id), data: form });
      toast.success('Event updated');
    } else {
      await createMutation.mutateAsync(form);
      toast.success('Event created');
    }
    setShowModal(false);
    setForm({
      title: '',
      type: 'meeting',
      date: today,
      start_time: '09:00',
      end_time: '10:00',
      location: '',
      attendees: '',
      description: '',
      recurring: false,
    });
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    await deleteMutation.mutateAsync(id);
    toast.success('Event deleted');
  }

  const monthName = new Date(year, month).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <ModuleBreadcrumbs currentModule="calendar" />
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white">Calendar</h1>
          <p className="text-sm text-gray-400 mt-1">Meetings, deadlines & resources</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm({
              title: '',
              type: 'meeting',
              date: today,
              start_time: '09:00',
              end_time: '10:00',
              location: '',
              attendees: '',
              description: '',
              recurring: false,
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Plus size={16} />
          <span>Add Event</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'This Week',
            value: events.filter((e) => {
              const d = new Date(String(e.date ?? ''));
              const weekStart = new Date();
              weekStart.setDate(weekStart.getDate() - weekStart.getDay());
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 6);
              return d >= weekStart && d <= weekEnd;
            }).length,
            colour: 'text-blue-400',
            bg: 'bg-blue-500/20',
          },
          { label: 'Deadlines This Month', value: thisMonthDeadlines.length, colour: 'text-orange-400', bg: 'bg-orange-500/20' },
          { label: 'Overdue', value: overdue.length, colour: 'text-red-400', bg: 'bg-red-500/20' },
          { label: 'Next Milestone', value: upcoming.length > 0 ? daysRemaining(String(upcoming[0].date ?? '')) + 'd' : '—', colour: 'text-green-400', bg: 'bg-green-500/20' },
        ].map((kpi, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-700 p-4">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-display ${kpi.colour}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-700">
        {(['month', 'week', 'events', 'deadlines', 'resources'] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === t
                ? 'border-orange-600 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tabLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : (
        <>
          {subTab === 'month' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-display text-white">{monthName}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentDate(new Date(year, month - 1))}
                    className="p-2 hover:bg-gray-800 rounded-lg"
                  >
                    <ChevronLeft size={16} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="px-3 py-1 text-xs text-gray-400 hover:bg-gray-800 rounded-lg"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date(year, month + 1))}
                    className="p-2 hover:bg-gray-800 rounded-lg"
                  >
                    <ChevronRight size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-display tracking-widest text-gray-500 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array(firstDay)
                  .fill(null)
                  .map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square bg-gray-800/50 rounded-lg" />
                  ))}
                {monthDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === today;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setForm({
                          title: '',
                          type: 'meeting',
                          date: dateStr,
                          start_time: '09:00',
                          end_time: '10:00',
                          location: '',
                          attendees: '',
                          description: '',
                          recurring: false,
                        });
                        setShowModal(true);
                      }}
                      className={`aspect-square rounded-lg border p-1 text-xs font-medium transition-colors ${
                        isToday
                          ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-semibold">{day}</div>
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayEvents.map((e, i) => (
                          <div
                            key={i}
                            className={`w-1 h-1 rounded-full ${
                              String(e.type ?? '') === 'meeting'
                                ? 'bg-blue-400'
                                : String(e.type ?? '') === 'deadline'
                                  ? 'bg-orange-400'
                                  : String(e.type ?? '') === 'site_visit'
                                    ? 'bg-green-400'
                                    : 'bg-red-400'
                            }`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {subTab === 'week' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 cb-table-scroll touch-pan-x">
              <div className="inline-block min-w-full">
                <div className="grid" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
                  <div className="bg-gray-800 p-2 text-xs font-semibold text-gray-400" />
                  {WEEKDAYS.map((day, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - date.getDay() + i + 1);
                    return (
                      <div key={day} className="bg-gray-800 p-2 text-xs font-semibold text-center text-gray-300">
                        <div>{day}</div>
                        <div className="text-gray-500">{date.getDate()}</div>
                      </div>
                    );
                  })}

                  {HOURS.map((hour) => (
                    <>
                      <div key={`hour-${hour}`} className="bg-gray-850 border-b border-gray-700 p-2 text-xs text-gray-500 text-right pr-3">
                        {hour}
                      </div>
                      {WEEKDAYS.map((day) => (
                        <div
                          key={`${day}-${hour}`}
                          className="border-b border-r border-gray-700 bg-gray-800/30 min-h-12 hover:bg-gray-800/60 transition-colors"
                        />
                      ))}
                    </>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'events' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <CalendarIcon size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No upcoming events</p>
                </div>
              ) : (
                upcomingEvents.map((e) => {
                  const id = String(e.id);
                  const isSelected = selectedIds.has(id);
                  return (
                    <div key={id} className="p-4 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center">
                          <button type="button" onClick={e => { e.stopPropagation(); toggle(id); }}>
                            {isSelected ? <CheckSquare size={16} className="text-blue-400"/> : <Square size={16} className="text-gray-500"/>}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-display text-white truncate">{String(e.title ?? 'Event')}</h3>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                EVENT_TYPES[String(e.type ?? '')] || 'bg-gray-800 text-gray-300'
                              }`}
                            >
                              {String(e.type ?? '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span>{String(e.date ?? '')}</span>
                            {!!e.start_time && <span>{String(e.start_time)}</span>}
                            {!!e.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {String(e.location)}
                              </span>
                            )}
                            {!!e.attendees && (
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {String(e.attendees).split(',').length}
                              </span>
                            )}
                          </div>
                          {!!e.description && (
                            <p className="text-sm text-gray-400 mt-2">{String(e.description)}</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditing(e);
                              setForm({
                                title: String(e.title ?? ''),
                                type: String(e.type ?? 'meeting'),
                                date: String(e.date ?? ''),
                                start_time: String(e.start_time ?? '09:00'),
                                end_time: String(e.end_time ?? '10:00'),
                                location: String(e.location ?? ''),
                                attendees: String(e.attendees ?? ''),
                                description: String(e.description ?? ''),
                                recurring: Boolean(e.recurring),
                              });
                              setShowModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded"
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(String(e.id))}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {subTab === 'deadlines' && (
            <div className="space-y-4">
              {overdue.length > 0 && (
                <div className="bg-gray-900 rounded-xl border border-red-700 divide-y divide-gray-700">
                  <div className="px-4 py-3 flex items-center gap-2 bg-red-900/20">
                    <AlertTriangle size={16} className="text-red-400" />
                    <h3 className="font-semibold text-red-300">{overdue.length} Overdue</h3>
                  </div>
                  {overdue.map((d) => (
                    <div key={String(d.id)} className="p-4 hover:bg-gray-800/50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-display text-white">{String(d.title ?? 'Deadline')}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Due: {String(d.date ?? '')} · Owner: {String(d.owner ?? '—')}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded-full whitespace-nowrap font-medium">
                          {daysRemaining(String(d.date ?? ''))}d ago
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-700">
                {upcoming.length === 0 && overdue.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Flag size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No deadlines this month</p>
                  </div>
                ) : (
                  upcoming.map((d) => {
                    const daysLeft = daysRemaining(String(d.date ?? ''));
                    return (
                      <div key={String(d.id)} className="p-4 hover:bg-gray-800/50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-display text-white">{String(d.title ?? 'Deadline')}</p>
                            <p className="text-sm text-gray-400 mt-1">
                              Due: {String(d.date ?? '')} · Owner: {String(d.owner ?? '—')}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap font-medium ${
                              daysLeft <= 3
                                ? 'bg-red-500/20 text-red-300'
                                : daysLeft <= 7
                                  ? 'bg-orange-500/20 text-orange-300'
                                  : 'bg-green-500/20 text-green-300'
                            }`}
                          >
                            {daysLeft}d
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {subTab === 'resources' && (
            <div className="space-y-8">
              <p className="text-sm text-gray-400">
                Week of{' '}
                <span className="text-gray-200 font-medium">
                  {workWeekLabels[0]} – {workWeekLabels[4]}
                </span>
                . People and plant rows use your{' '}
                <strong className="text-gray-300">Team</strong> and <strong className="text-gray-300">Equipment</strong>{' '}
                registers; cells show when someone or kit appears on a meeting, site visit, or urgent entry that day
                (matched from attendees, title, description, or location).
              </p>

              <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-gray-800/80">
                  <Users className="h-4 w-4 text-blue-400" aria-hidden />
                  <h2 className="text-sm font-display text-white">People — team roster</h2>
                  <span className="text-xs text-gray-500 ml-auto">{teamMembers.length} on file</span>
                </div>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th scope="col" className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                          Name
                        </th>
                        <th scope="col" className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide hidden sm:table-cell">
                          Role / trade
                        </th>
                        <th scope="col" className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                          Status
                        </th>
                        {workWeekLabels.map((label, idx) => (
                          <th
                            key={workWeekDates[idx]}
                            scope="col"
                            className="text-center px-2 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide min-w-[4.5rem]"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {teamMembers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                            No team members yet — add people under{' '}
                            <strong className="text-gray-400">Teams & Labour</strong> to plan labour against the calendar.
                          </td>
                        </tr>
                      ) : (
                        teamMembers.map((m) => {
                          const name = String(m.name ?? '—');
                          const role = [m.role, m.trade].filter(Boolean).join(' · ') || '—';
                          const status = String(m.status ?? '—');
                          return (
                            <tr key={String(m.id)} className="hover:bg-gray-800/40">
                              <td className="px-4 py-3 text-gray-200 font-medium">{name}</td>
                              <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{role}</td>
                              <td className="px-4 py-3">
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300 capitalize">
                                  {status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              {workWeekDates.map((dayStr) => {
                                const booked = personBookedOnDay(name, dayStr, events);
                                return (
                                  <td key={dayStr} className="text-center px-2 py-3">
                                    {booked ? (
                                      <div
                                        className="h-6 mx-auto max-w-[3.5rem] bg-blue-500/25 rounded text-xs text-blue-200 flex items-center justify-center"
                                        aria-label={`${name} booked ${dayStr}`}
                                        title="On programme this day"
                                      >
                                        ✓
                                      </div>
                                    ) : (
                                      <div
                                        className="h-6 mx-auto max-w-[3.5rem] bg-gray-800/80 rounded"
                                        aria-label={`${name} free ${dayStr}`}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-gray-800/80">
                  <HardHat className="h-4 w-4 text-amber-400" aria-hidden />
                  <h2 className="text-sm font-display text-white">Plant & equipment</h2>
                  <span className="text-xs text-gray-500 ml-auto">{equipmentRows.length} items</span>
                </div>
                <div className="cb-table-scroll touch-pan-x">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th scope="col" className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                          Asset
                        </th>
                        <th scope="col" className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide hidden md:table-cell">
                          Type
                        </th>
                        <th scope="col" className="text-left px-4 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide">
                          Status
                        </th>
                        {workWeekLabels.map((label, idx) => (
                          <th
                            key={workWeekDates[idx]}
                            scope="col"
                            className="text-center px-2 py-3 text-xs font-display tracking-widest text-gray-400 uppercase tracking-wide min-w-[4.5rem]"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {equipmentRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                            No equipment yet — register plant under{' '}
                            <strong className="text-gray-400">{'Plant & Equipment'}</strong>
                            {' '}({'Site & Operations'}).
                          </td>
                        </tr>
                      ) : (
                        equipmentRows.map((eq) => {
                          const label = String(eq.name ?? '—');
                          const typ = String(eq.type ?? '—');
                          const st = String(eq.status ?? '—').replace(/_/g, ' ');
                          return (
                            <tr key={String(eq.id)} className="hover:bg-gray-800/40">
                              <td className="px-4 py-3 text-gray-200 font-medium">{label}</td>
                              <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{typ}</td>
                              <td className="px-4 py-3">
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300 capitalize">{st}</span>
                              </td>
                              {workWeekDates.map((dayStr) => {
                                const ref = equipmentReferencedOnDay(label, dayStr, events);
                                return (
                                  <td key={dayStr} className="text-center px-2 py-3">
                                    {ref ? (
                                      <div
                                        className="h-6 mx-auto max-w-[3.5rem] bg-amber-500/20 rounded text-xs text-amber-200 flex items-center justify-center"
                                        aria-label={`${label} referenced ${dayStr}`}
                                        title="Named on programme this day"
                                      >
                                        ✓
                                      </div>
                                    ) : (
                                      <div
                                        className="h-6 mx-auto max-w-[3.5rem] bg-gray-800/80 rounded"
                                        aria-label={`${label} not on diary ${dayStr}`}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-display text-white">{editing ? 'Edit Event' : 'New Event'}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Event Title *
                  </label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option>meeting</option>
                    <option>deadline</option>
                    <option>site_visit</option>
                    <option>urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Site Office"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Attendees</label>
                  <input
                    value={form.attendees}
                    onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
                    placeholder="Comma-separated names"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={form.recurring}
                    onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
                    className="h-4 w-4 rounded"
                  />
                  <label htmlFor="recurring" className="text-sm text-gray-300">
                    Recurring event
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        actions={[
          { id: 'delete', label: 'Delete Selected', icon: Trash2, variant: 'danger', onClick: handleBulkDelete, confirm: 'This action cannot be undone.' },
        ]}
        onClearSelection={clearSelection}
      />
    </div>
    </>
  );
}
export default React.memo(Calendar);
