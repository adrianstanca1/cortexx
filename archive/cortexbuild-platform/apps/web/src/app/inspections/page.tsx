'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, ClipboardCheck, Plus, Search, Filter } from 'lucide-react';

interface Inspection {
  id: string;
  title: string;
  type: string;
  status: string;
  inspectionDate: string | null;
  dueDate: string | null;
  inspector: string | null;
  score: number | null;
}

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter] = useState<'all' | 'pending' | 'passed' | 'failed'>('all');

  useEffect(() => {
    apiFetch('/inspections').then(r => r.json()).then(data => {
      setInspections(data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const filtered = inspections
    .filter(i => i.title.toLowerCase().includes(search.toLowerCase()))
    .filter(i => filter === 'all' || i.status === filter);

  const passed = inspections.filter(i => i.status === 'passed').length;
  const failed = inspections.filter(i => i.status === 'failed').length;
  const pending = inspections.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-emerald-500" />
          <h1 className="text-2xl font-bold">Inspections</h1>
        </div>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Inspection</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 border-l-4 border-emerald-500">
          <div><p className="text-sm text-slate-500">Passed</p><p className="text-2xl font-bold">{passed}</p></div>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <div><p className="text-sm text-slate-500">Failed</p><p className="text-2xl font-bold">{failed}</p></div>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <div><p className="text-sm text-slate-500">Pending</p><p className="text-2xl font-bold">{pending}</p></div>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Search inspections..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm"><Filter className="mr-1 h-4 w-4" />Filter</Button>
      </div>

      <div className="space-y-2">
        {filtered.map(i => (
          <Card key={i.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{i.title}</h3>
                  <Badge variant={i.status === 'passed' ? 'success' : i.status === 'failed' ? 'destructive' : 'warning'}>{i.status}</Badge>
                </div>
                <p className="text-sm text-slate-500">{i.type}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{i.inspector || 'No inspector'}</p>
                <p className="text-xs text-slate-400">Due: {i.dueDate || '-'}</p>
                {i.score !== null && <p className="text-xs font-bold">Score: {i.score}%</p>}
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8">No inspections found</p>}
      </div>
    </div>
  );
}
