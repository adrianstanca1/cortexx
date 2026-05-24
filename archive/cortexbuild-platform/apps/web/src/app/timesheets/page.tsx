'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, Clock, Plus, Search } from 'lucide-react';

interface Timesheet {
  id: string;
  workerId: number | null;
  date: string | null;
  hoursWorked: number | null;
  overtimeHours: number | null;
  status: string;
  costCode: string | null;
  notes: string | null;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch('/timesheets').then(r => r.json()).then(data => {
      setTimesheets(data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const totalHours = timesheets.reduce((s, t) => s + (t.hoursWorked || 0), 0);
  const totalOvertime = timesheets.reduce((s, t) => s + (t.overtimeHours || 0), 0);
  const pending = timesheets.filter(t => t.status === 'submitted').length;

  const filtered = timesheets.filter(t =>
    (t.notes || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.costCode || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Timesheets</h1>
        </div>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Log Time</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 border-l-4 border-blue-500">
          <div><p className="text-sm text-slate-500">Total Hours</p><p className="text-2xl font-bold">{totalHours.toFixed(1)}</p></div>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <div><p className="text-sm text-slate-500">Overtime</p><p className="text-2xl font-bold">{totalOvertime.toFixed(1)}</p></div>
        </Card>
        <Card className="p-4 border-l-4 border-emerald-500">
          <div><p className="text-sm text-slate-500">Pending Approval</p><p className="text-2xl font-bold">{pending}</p></div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Search timesheets..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Hours</th>
              <th className="px-4 py-2 text-left font-medium">OT</th>
              <th className="px-4 py-2 text-left font-medium">Cost Code</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(t => (
              <tr key={t.id}>
                <td className="px-4 py-2">{t.date || '-'}</td>
                <td className="px-4 py-2">{t.hoursWorked || 0}</td>
                <td className="px-4 py-2">{t.overtimeHours || 0}</td>
                <td className="px-4 py-2">{t.costCode || '-'}</td>
                <td className="px-4 py-2"><Badge variant={t.status === 'approved' ? 'success' : t.status === 'submitted' ? 'warning' : 'outline'}>{t.status}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-500 py-8">No timesheets found</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
