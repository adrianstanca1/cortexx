'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { Loader2, TrendingUp, Users, Briefcase, AlertTriangle, Clock, DollarSign, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface Stats {
  projects: number;
  tasks: number;
  safetyIncidents: number;
  invoices: number;
  workers: number;
  budget: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch('/projects').then(r => r.json()),
      apiFetch('/tasks').then(r => r.json()),
      apiFetch('/safety').then(r => r.json()),
      apiFetch('/invoices').then(r => r.json()),
      apiFetch('/workers').then(r => r.json()),
    ]).then(([p, t, s, i, w]) => {
      const projects = p.projects?.length ?? 0;
      const tasks = t.tasks?.length ?? 0;
      const safety = s.incidents?.length ?? 0;
      const invoices = i.invoices?.length ?? 0;
      const workers = w.workers?.length ?? 0;
      const budget = (p.projects ?? []).reduce((sum: number, x: any) => sum + (x.budget || 0), 0);
      setStats({ projects, tasks, safetyIncidents: safety, invoices, workers, budget });
      setActivity([
        { type: 'project', text: `${projects} active projects`, time: 'now' },
        { type: 'task', text: `${(t.tasks ?? []).filter((x: any) => x.status === 'done').length} tasks completed`, time: 'today' },
        { type: 'safety', text: `${safety} open safety incidents`, time: 'active' },
        { type: 'invoice', text: `$${((i.invoices ?? []).reduce((sum: number, x: any) => sum + (x.amount || 0), 0) / 1000).toFixed(1)}k total invoices`, time: 'this month' },
      ]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const chartData = [
    { name: 'Projects', value: stats?.projects ?? 0, fill: '#3b82f6' },
    { name: 'Tasks', value: stats?.tasks ?? 0, fill: '#10b981' },
    { name: 'Safety', value: stats?.safetyIncidents ?? 0, fill: '#ef4444' },
    { name: 'Invoices', value: stats?.invoices ?? 0, fill: '#f59e0b' },
    { name: 'Workers', value: stats?.workers ?? 0, fill: '#8b5cf6' },
  ];

  const budgetData = [
    { name: 'Q1', budget: 120000, spent: 95000 },
    { name: 'Q2', budget: 150000, spent: 110000 },
    { name: 'Q3', budget: 180000, spent: 140000 },
    { name: 'Q4', budget: 200000, spent: 160000 },
  ];

  const taskTrend = [
    { day: 'Mon', completed: 12, created: 8 },
    { day: 'Tue', completed: 18, created: 10 },
    { day: 'Wed', completed: 15, created: 12 },
    { day: 'Thu', completed: 22, created: 9 },
    { day: 'Fri', completed: 20, created: 11 },
    { day: 'Sat', completed: 8, created: 4 },
    { day: 'Sun', completed: 5, created: 3 },
  ];

  if (loading || !stats) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Badge variant="default" className="px-3 py-1">{new Date().toLocaleDateString()}</Badge>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Projects</p><p className="text-2xl font-bold">{stats.projects}</p></div>
            <Briefcase className="h-8 w-8 text-blue-500 opacity-80" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Tasks</p><p className="text-2xl font-bold">{stats.tasks}</p></div>
            <CheckCircle className="h-8 w-8 text-emerald-500 opacity-80" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Safety</p><p className="text-2xl font-bold">{stats.safetyIncidents}</p></div>
            <AlertTriangle className="h-8 w-8 text-red-500 opacity-80" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Invoices</p><p className="text-2xl font-bold">{stats.invoices}</p></div>
            <DollarSign className="h-8 w-8 text-amber-500 opacity-80" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-violet-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Workers</p><p className="text-2xl font-bold">{stats.workers}</p></div>
            <Users className="h-8 w-8 text-violet-500 opacity-80" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-cyan-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Budget</p><p className="text-2xl font-bold">${(stats.budget / 1000).toFixed(0)}k</p></div>
            <TrendingUp className="h-8 w-8 text-cyan-500 opacity-80" />
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Task Velocity (7 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={taskTrend}>
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Entity Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={2} stroke="#fff">
                {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Budget vs Spend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={budgetData}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v: number) => `$${v / 1000}k`} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spent" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Recent Activity</h3>
          <ul className="space-y-3">
            {activity.map((item, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">{item.text}</span>
                <Badge variant="outline" className="ml-auto text-xs">{item.time}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
