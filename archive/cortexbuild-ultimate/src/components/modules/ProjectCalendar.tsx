import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  User,
  Flag,
  X,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

interface CalendarEvent {
  id: string;
  title: string;
  type: 'milestone' | 'inspection' | 'safety' | 'meeting' | 'delivery' | 'site_visit';
  start: string;
  end?: string;
  time?: string;
  location?: string;
  project?: string;
  assignee?: string;
  notes?: string;
  color?: string;
}

interface GanttTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  milestone: '#F59E0B',
  inspection: '#3B82F6',
  safety: '#EF4444',
  meeting: '#A855F7',
  delivery: '#10B981',
  site_visit: '#06B6D4',
};

const TYPE_LABELS: Record<string, string> = {
  milestone: 'Milestone',
  inspection: 'Inspection',
  safety: 'Safety',
  meeting: 'Meeting',
  delivery: 'Delivery',
  site_visit: 'Site Visit',
};

const _MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Foundation Inspection',
    type: 'inspection',
    start: '2026-04-08T10:00:00',
    location: 'Manchester Site',
    project: 'Riverside Plaza',
    assignee: 'John Smith',
    notes: 'Check concrete curing and rebar placement',
  },
  {
    id: '2',
    title: 'Project Kickoff',
    type: 'meeting',
    start: '2026-04-07T09:00:00',
    location: 'Virtual',
    project: 'High Street Development',
    assignee: 'Sarah Johnson',
    notes: 'All teams present',
  },
  {
    id: '3',
    title: 'Steel Delivery',
    type: 'delivery',
    start: '2026-04-10T08:00:00',
    location: 'Birmingham Site',
    project: 'Industrial Complex',
    assignee: 'Mike Chen',
    notes: 'Confirm loading dock access',
  },
  {
    id: '4',
    title: 'Safety Induction',
    type: 'safety',
    start: '2026-04-09T14:00:00',
    location: 'Site Office',
    project: 'Riverside Plaza',
    assignee: 'Helen Davies',
    notes: 'New team members required',
  },
  {
    id: '5',
    title: 'Milestone: Structural Complete',
    type: 'milestone',
    start: '2026-04-15T00:00:00',
    project: 'Riverside Plaza',
    assignee: 'Project Team',
    notes: 'Mark completion of structural phase',
  },
  {
    id: '6',
    title: 'Building Control Visit',
    type: 'site_visit',
    start: '2026-04-12T11:00:00',
    location: 'High Street Site',
    project: 'High Street Development',
    assignee: 'Inspection Team',
    notes: 'BC approval required for next phase',
  },
  {
    id: '7',
    title: 'MEP Installation Review',
    type: 'meeting',
    start: '2026-04-14T10:00:00',
    location: 'Site Office',
    project: 'Industrial Complex',
    assignee: 'Engineering Team',
    notes: 'Review M/E/P schedule and coordination',
  },
  {
    id: '8',
    title: 'Electrical Equipment Delivery',
    type: 'delivery',
    start: '2026-04-11T09:00:00',
    location: 'London Site',
    project: 'Tower Block Refurb',
    assignee: 'Stores Manager',
    notes: 'Secure parking for delivery vehicle',
  },
  {
    id: '9',
    title: 'Site Inspection - Foundations',
    type: 'inspection',
    start: '2026-04-13T13:00:00',
    location: 'Manchester Site',
    project: 'Industrial Complex',
    assignee: 'Quality Inspector',
    notes: 'Final check before concreting',
  },
  {
    id: '10',
    title: 'Subcontractor Safety Briefing',
    type: 'safety',
    start: '2026-04-16T09:30:00',
    location: 'High Street Site',
    project: 'High Street Development',
    assignee: 'Safety Officer',
    notes: 'Mandatory for all new subs',
  },
  {
    id: '11',
    title: 'Weekly Toolbox Talk',
    type: 'meeting',
    start: '2026-04-18T08:00:00',
    location: 'Riverside Plaza',
    project: 'Riverside Plaza',
    assignee: 'Site Manager',
    notes: 'Focus on working at heights',
  },
  {
    id: '12',
    title: 'Plumbing Materials Delivery',
    type: 'delivery',
    start: '2026-04-17T07:00:00',
    location: 'Birmingham Site',
    project: 'Tower Block Refurb',
    assignee: 'Site Supervisor',
    notes: 'Coordinate with plumber on-site',
  },
  {
    id: '13',
    title: 'Milestone: M&E First Fix Complete',
    type: 'milestone',
    start: '2026-04-22T00:00:00',
    project: 'High Street Development',
    assignee: 'Project Team',
    notes: 'All first fix inspections passed',
  },
  {
    id: '14',
    title: 'Client Site Walk',
    type: 'site_visit',
    start: '2026-04-20T10:00:00',
    location: 'Industrial Complex',
    project: 'Industrial Complex',
    assignee: 'Project Director',
    notes: 'Monthly progress review with client',
  },
  {
    id: '15',
    title: 'Final Certification Inspection',
    type: 'inspection',
    start: '2026-04-25T09:00:00',
    location: 'Tower Block Site',
    project: 'Tower Block Refurb',
    assignee: 'Building Control',
    notes: 'Sign-off inspection for completion',
  },
];

const GANTT_TASKS: GanttTask[] = [
  {
    id: 'g1',
    name: 'Riverside Plaza - Foundations',
    startDate: '2026-04-01',
    endDate: '2026-04-15',
    progress: 85,
    color: '#F59E0B',
  },
  {
    id: 'g2',
    name: 'High Street Development - Superstructure',
    startDate: '2026-04-08',
    endDate: '2026-04-30',
    progress: 45,
    color: '#3B82F6',
  },
  {
    id: 'g3',
    name: 'Industrial Complex - MEP Install',
    startDate: '2026-04-10',
    endDate: '2026-05-05',
    progress: 30,
    color: '#10B981',
  },
  {
    id: 'g4',
    name: 'Tower Block Refurb - Finishes',
    startDate: '2026-04-05',
    endDate: '2026-04-28',
    progress: 60,
    color: '#A855F7',
  },
  {
    id: 'g5',
    name: 'Factory Extension - Structure',
    startDate: '2026-04-03',
    endDate: '2026-04-22',
    progress: 95,
    color: '#EF4444',
  },
];

export function ProjectCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 6));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<'month' | 'week' | 'timeline'>('month');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '09:00',
    type: 'meeting' as CalendarEvent['type'],
    project: '',
    assignee: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    apiFetch<unknown>('/calendar')
      .then((raw) => {
        // Generic CRUD routes wrap responses in { data, pagination }
        const payload = raw as Record<string, unknown>;
        type ApiEvent = { id: string; title: string; type: string; startDate: string; endDate?: string; project?: string };
        const arr: ApiEvent[] =
          Array.isArray(payload?.data) ? payload.data as ApiEvent[] :
          Array.isArray(raw) ? raw as ApiEvent[] : [];
        setEvents(arr.map((e) => ({
          id: e.id,
          title: e.title,
          type: (Object.keys(TYPE_COLORS).includes(e.type)
            ? e.type
            : 'meeting') as CalendarEvent['type'],
          start: e.startDate,
          end: e.endDate,
          project: e.project,
          color: TYPE_COLORS[e.type] ?? TYPE_COLORS.meeting,
        })));
      })
      .catch((err: Error) => console.error('Failed to load calendar events:', err));
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDay = (date: Date | null) => {
    if (!date) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getEventsForWeek = (baseDate: Date) => {
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() - baseDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return eventDate >= weekStart && eventDate < weekEnd;
    });
  };

  const getWeekDays = (baseDate: Date) => {
    const days: Date[] = [];
    const weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() - baseDate.getDay());
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(
        prev.getDate() + (direction === 'next' ? 7 : -7)
      );
      return newDate;
    });
  };

  const handleAddEvent = () => {
    if (!formData.title || !formData.date) return;
    const newEvent: CalendarEvent = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.title,
      type: formData.type,
      start: `${formData.date}T${formData.time}:00`,
      project: formData.project,
      assignee: formData.assignee,
      location: formData.location,
      notes: formData.notes,
      color: TYPE_COLORS[formData.type],
    };
    setEvents([...events, newEvent]);
    setShowAddModal(false);
    setFormData({
      title: '',
      date: '',
      time: '09:00',
      type: 'meeting',
      project: '',
      assignee: '',
      location: '',
      notes: '',
    });
  };

  const upcomingEvents = events
    .filter((e) => new Date(e.start) >= new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 7);

  const eventsThisWeek = getEventsForWeek(currentDate).length;

  const milestoneDue = events.filter(
    (e) =>
      e.type === 'milestone' &&
      new Date(e.start) >= new Date() &&
      new Date(e.start) < new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)
  ).length;

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const weekDays = getWeekDays(currentDate);
  const weekEvents = getEventsForWeek(currentDate);

  const _parseDate = (dateStr: string): { date: string; time: string } => {
    const [date, time] = dateStr.split('T');
    return { date, time: time?.substring(0, 5) || '09:00' };
  };

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen">
      <ModuleBreadcrumbs currentModule="project-calendar" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-display text-white">
            {view === 'month'
              ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : view === 'week'
                ? `Week of ${weekDays[0].toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}`
                : 'Project Timeline'}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => (view === 'week' ? navigateWeek('prev') : navigateMonth('prev'))}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => (view === 'week' ? navigateWeek('next') : navigateMonth('next'))}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 text-sm font-medium rounded transition ${
                view === 'month'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1 text-sm font-medium rounded transition ${
                view === 'week'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`px-3 py-1 text-sm font-medium rounded transition ${
                view === 'timeline'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Calendar/View */}
        <div className="lg:col-span-3">
          {view === 'month' && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="grid grid-cols-7 gap-px bg-gray-700">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="bg-gray-800 p-3 text-center text-sm font-semibold text-gray-300"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-700">
                {days.map((date, index) => {
                  const dayEvents = getEventsForDay(date);
                  const isToday = date?.toDateString() === new Date().toDateString();
                  const isCurrentMonth =
                    date?.getMonth() === currentDate.getMonth();

                  return (
                    <div
                      key={index}
                      className={`min-h-[120px] p-2 ${
                        !date || !isCurrentMonth
                          ? 'bg-gray-900'
                          : 'bg-gray-800 hover:bg-gray-750 transition'
                      } border-b border-gray-700`}
                    >
                      {date && (
                        <>
                          <div
                            className={`text-sm font-semibold mb-2 ${
                              isToday
                                ? 'text-amber-500 bg-amber-600/20 rounded px-2 py-1 inline-block'
                                : isCurrentMonth
                                  ? 'text-white'
                                  : 'text-gray-500'
                            }`}
                          >
                            {date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 3).map((event) => (
                              <button
                                key={event.id}
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setShowEventDetail(true);
                                }}
                                className="w-full text-xs p-1 rounded text-white truncate hover:opacity-80 transition"
                                style={{ backgroundColor: event.color }}
                                title={event.title}
                              >
                                {event.title}
                              </button>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-xs text-gray-400 pl-1">
                                +{dayEvents.length - 3} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 cb-table-scroll touch-pan-x">
              <div className="grid" style={{ gridTemplateColumns: 'auto repeat(7, 1fr)' }}>
                {/* Time slots header */}
                <div className="bg-gray-700 p-2 text-xs font-semibold text-gray-300 border-r border-gray-600 min-w-[60px]"></div>
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-700 p-3 text-center border-r border-gray-600"
                  >
                    <div className="text-xs font-semibold text-gray-300">
                      {day.toLocaleDateString('en-GB', {
                        weekday: 'short',
                      })}
                    </div>
                    <div className="text-lg font-display text-white">
                      {day.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time slots */}
              {Array.from({ length: 13 }).map((_, hourIdx) => {
                const hour = 7 + hourIdx;
                return (
                  <div
                    key={hour}
                    className="grid border-b border-gray-700"
                    style={{ gridTemplateColumns: 'auto repeat(7, 1fr)' }}
                  >
                    <div className="bg-gray-900 p-2 text-xs text-gray-500 border-r border-gray-600 min-w-[60px] font-semibold text-right">
                      {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const slotEvents = weekEvents.filter((e) => {
                        const eventDate = new Date(e.start);
                        const eventHour = eventDate.getHours();
                        return (
                          eventDate.getDate() === day.getDate() &&
                          eventDate.getMonth() === day.getMonth() &&
                          eventHour === hour
                        );
                      });

                      return (
                        <div
                          key={`${dayIdx}-${hour}`}
                          className="bg-gray-800 border-r border-gray-700 min-h-[50px] p-1 hover:bg-gray-750 transition relative"
                        >
                          {slotEvents.map((event) => (
                            <button
                              key={event.id}
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowEventDetail(true);
                              }}
                              className="w-full text-xs p-1 rounded text-white truncate hover:opacity-80 transition block mb-1"
                              style={{ backgroundColor: event.color }}
                              title={event.title}
                            >
                              {event.title}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {view === 'timeline' && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 cb-table-scroll touch-pan-x p-4">
              <div className="space-y-4">
                {GANTT_TASKS.map((task) => {
                  const start = new Date(task.startDate);
                  const end = new Date(task.endDate);
                  const monthStart = new Date(2026, 3, 1);
                  const monthEnd = new Date(2026, 4, 30);

                  const startPercent =
                    ((start.getTime() - monthStart.getTime()) /
                      (monthEnd.getTime() - monthStart.getTime())) *
                    100;
                  const duration =
                    ((end.getTime() - start.getTime()) /
                      (monthEnd.getTime() - monthStart.getTime())) *
                    100;

                  return (
                    <div key={task.id} className="space-y-1">
                      <div className="text-sm font-medium text-white truncate">
                        {task.name}
                      </div>
                      <div className="relative h-8 bg-gray-700 rounded overflow-hidden">
                        <div
                          className="absolute h-full flex items-center pl-2 text-xs text-white font-semibold rounded"
                          style={{
                            backgroundColor: task.color,
                            left: `${startPercent}%`,
                            width: `${duration}%`,
                          }}
                        >
                          {task.progress}%
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {start.toLocaleDateString('en-GB')} -{' '}
                        {end.toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-3">
            <h3 className="text-lg font-display text-white flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" />
              Quick Stats
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">This Week</span>
                <span className="text-white font-semibold">{eventsThisWeek}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Milestones Due</span>
                <span className="text-amber-500 font-semibold">{milestoneDue}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Events</span>
                <span className="text-blue-400 font-semibold">{events.length}</span>
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-display text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Next 7 Days
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">No upcoming events</p>
              ) : (
                upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowEventDetail(true);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-gray-700 transition border-l-2 group"
                    style={{ borderColor: event.color }}
                  >
                    <p className="text-sm font-medium text-white group-hover:text-amber-400 transition truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.start).toLocaleDateString('en-GB')}{' '}
                      {event.time ||
                        new Date(event.start).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                    </p>
                    {event.project && (
                      <p className="text-xs text-gray-600">{event.project}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-display text-white mb-3">Event Types</h3>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[type] }}
                  ></div>
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800">
              <h3 className="text-xl font-display text-white">Add Event</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1 font-semibold">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Event title"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1 font-semibold">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1 font-semibold">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) =>
                      setFormData({ ...formData, time: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1 font-semibold">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as CalendarEvent['type'],
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
                >
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1 font-semibold">
                  Project
                </label>
                <input
                  type="text"
                  value={formData.project}
                  onChange={(e) =>
                    setFormData({ ...formData, project: e.target.value })
                  }
                  placeholder="Project name"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1 font-semibold">
                  Assignee
                </label>
                <input
                  type="text"
                  value={formData.assignee}
                  onChange={(e) =>
                    setFormData({ ...formData, assignee: e.target.value })
                  }
                  placeholder="Person name"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1 font-semibold">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="Location"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1 font-semibold">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                disabled={!formData.title || !formData.date}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold disabled:opacity-50 transition"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {showEventDetail && selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedEvent.color }}
                ></div>
                <h3 className="text-xl font-display text-white">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={() => setShowEventDetail(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">
                  TYPE
                </p>
                <p className="text-white">
                  {TYPE_LABELS[selectedEvent.type]}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    DATE
                  </p>
                  <p className="text-white">
                    {new Date(selectedEvent.start).toLocaleDateString(
                      'en-GB'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    TIME
                  </p>
                  <p className="text-white">
                    {selectedEvent.time ||
                      new Date(selectedEvent.start).toLocaleTimeString(
                        'en-GB',
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                  </p>
                </div>
              </div>

              {selectedEvent.project && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <Flag className="w-3 h-3" />
                    PROJECT
                  </p>
                  <p className="text-white">{selectedEvent.project}</p>
                </div>
              )}

              {selectedEvent.assignee && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    ASSIGNEE
                  </p>
                  <p className="text-white">{selectedEvent.assignee}</p>
                </div>
              )}

              {selectedEvent.location && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    LOCATION
                  </p>
                  <p className="text-white">{selectedEvent.location}</p>
                </div>
              )}

              {selectedEvent.notes && (
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    NOTES
                  </p>
                  <p className="text-gray-300 text-sm">
                    {selectedEvent.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setShowEventDetail(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(ProjectCalendar);
