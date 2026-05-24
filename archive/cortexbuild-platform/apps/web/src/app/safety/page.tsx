'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, ShieldAlert, TrendingDown, AlertTriangle, AlertOctagon, FileText, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  location: string | null;
  date: string | null;
  reportedBy: string | null;
  description: string | null;
}

export default function SafetyPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => {
    apiFetch('/safety').then(r => r.json()).then(data => {
      setIncidents(data.incidents || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const openCount = incidents.filter(i => i.status !== 'resolved').length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const highCount = incidents.filter(i => i.severity === 'high').length;
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

  const byWeek = [
    { week: 'W1', critical: 1, high: 3, medium: 2, low: 5 },
    { week: 'W2', critical: 0, high: 2, medium: 4, low: 3 },
    { week: 'W3', critical: 2, high: 1, medium: 3, low: 4 },
    { week: 'W4', critical: 0, high: 1, medium: 2, low: 2 },
  ];

  const filtered = filter === 'all' ? incidents : incidents.filter(i => filter === 'open' ? i.status !== 'resolved' : i.status === 'resolved');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold">Safety</h1>
        </div>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Report Incident</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Critical</p><p className="text-2xl font-bold text-red-600">{criticalCount}</p></div>
            <AlertOctagon className="h-8 w-8 text-red-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">High</p><p className="text-2xl font-bold text-amber-600">{highCount}</p></div>
            <AlertTriangle className="h-8 w-8 text-amber-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Open</p><p className="text-2xl font-bold">{openCount}</p></div>
            <TrendingDown className="h-8 w-8 text-blue-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Resolved</p><p className="text-2xl font-bold">{resolvedCount}</p></div>
            <FileText className="h-8 w-8 text-emerald-500 opacity-70" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Incidents by Severity (4 weeks)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byWeek}>
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Bar dataKey="critical" fill="#ef4444" radius={[4,4,0,0]} />
              <Bar dataKey="high" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="medium" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="low" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Quick Stats</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Total Incidents</span><span className="font-bold">{incidents.length}</span></li>
            <li className="flex justify-between"><span>Open Critical</span><span className="font-bold text-red-600">{incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length}</span></li>
            <li className="flex justify-between"><span>Avg Resolution</span><span className="font-bold">2.3 days</span></li>
            <li className="flex justify-between"><span>This Week</span><span className="font-bold">{incidents.filter(i => i.date && new Date(i.date) > new Date(Date.now() - 7*864e5)).length}</span></li>
          </ul>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        {(['all','open','resolved'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Resolved'}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(i => (
          <Card key={i.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{i.title}</h3>
                  <Badge variant={i.severity === 'critical' ? 'destructive' : i.severity === 'high' ? 'warning' : 'outline'}>{i.severity}</Badge>
                  <Badge variant={i.status === 'resolved' ? 'success' : 'outline'}>{i.status}</Badge>
                </div>
                {i.description && <p className="mt-1 text-sm text-slate-500">{i.description}</p>}
                <div className="mt-2 flex gap-4 text-xs text-slate-400">
                  {i.location && <span>📍 {i.location}</span>}
                  {i.reportedBy && <span>👤 {i.reportedBy}</span>}
                  {i.date && <span>🕐 {i.date}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8">No incidents found</p>}
      </div>
    </div>
  );
}
