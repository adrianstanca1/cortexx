'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, FileText, Plus, Search, Calendar } from 'lucide-react';

interface DailyReport {
  id: string;
  reportDate: string | null;
  progressSummary: string | null;
  issues: string | null;
  weather: string | null;
  siteConditions: string | null;
  status: string;
  createdAt: string | null;
}

export default function DailyReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch('/daily-reports').then(r => r.json()).then(data => {
      setReports(data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const filtered = reports.filter(r =>
    (r.progressSummary || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.issues || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Daily Reports</h1>
        </div>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Report</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Search reports..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(r => (
          <Card key={r.id} className="p-4 hover:shadow-sm transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{r.reportDate || 'No date'}</span>
              </div>
              <Badge variant={r.status === 'approved' ? 'success' : r.status === 'submitted' ? 'warning' : 'outline'}>{r.status}</Badge>
            </div>
            <p className="text-sm text-slate-600 line-clamp-2">{r.progressSummary || 'No summary'}</p>
            {r.issues && <p className="mt-2 text-xs text-red-500">Issues: {r.issues}</p>}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              {r.weather && <span>🌤️ {r.weather}</span>}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8 md:col-span-2 lg:col-span-3">No reports found</p>}
      </div>
    </div>
  );
}
