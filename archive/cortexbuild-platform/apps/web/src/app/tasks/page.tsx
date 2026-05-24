'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, Search, ArrowUpDown, LayoutGrid, List } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string | null;
  assignee: string | null;
  dueDate: string | null;
}

const columns = ['todo', 'in_progress', 'done'];
const colLabels: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const colColors: Record<string, string> = { todo: 'bg-slate-100 dark:bg-slate-800', in_progress: 'bg-blue-50 dark:bg-blue-900/20', done: 'bg-emerald-50 dark:bg-emerald-900/20' };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [sort, setSort] = useState<{ key: keyof Task; dir: 'asc' | 'desc' }>({ key: 'priority', dir: 'desc' });

  useEffect(() => {
    apiFetch('/tasks').then(r => r.json()).then(data => {
      setTasks(data.tasks || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || (t.assignee || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex items-center gap-2">
          <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}><LayoutGrid className="mr-1 h-4 w-4" />Board</Button>
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}><List className="mr-1 h-4 w-4" />List</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map(col => (
            <div key={col} className={`rounded-xl p-3 ${colColors[col]}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold">{colLabels[col]}</span>
                <Badge variant="outline">{filtered.filter(t => t.status === col).length}</Badge>
              </div>
              <div className="space-y-2">
                {filtered.filter(t => t.status === col).map(t => (
                  <Card key={t.id} className="p-3 cursor-pointer hover:shadow-sm transition-shadow">
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.assignee && <p className="mt-1 text-xs text-slate-500">{t.assignee}</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={t.priority === 'high' ? 'destructive' : 'outline'} className="text-[10px]">{t.priority}</Badge>
                      {t.dueDate && <span className="text-[10px] text-slate-400">{t.dueDate}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left font-medium cursor-pointer" onClick={() => setSort({ key: 'title', dir: sort.dir === 'asc' ? 'desc' : 'asc' })} >Title <ArrowUpDown className="inline h-3 w-3" /></th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Priority</th>
                <th className="px-4 py-2 text-left font-medium">Assignee</th>
                <th className="px-4 py-2 text-left font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2 font-medium">{t.title}</td>
                  <td className="px-4 py-2"><Badge variant={t.status === 'done' ? 'default' : t.status === 'in_progress' ? 'secondary' : 'outline'}>{t.status}</Badge></td>
                  <td className="px-4 py-2"><Badge variant={t.priority === 'high' ? 'destructive' : 'outline'}>{t.priority}</Badge></td>
                  <td className="px-4 py-2">{t.assignee || '-'}</td>
                  <td className="px-4 py-2">{t.dueDate || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
