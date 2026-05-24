'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, AlertTriangle, Plus, Search } from 'lucide-react';

interface Defect {
  id: string;
  title: string;
  priority: string;
  status: string;
  location: string | null;
  trade: string | null;
  dueDate: string | null;
  estimatedCost: number | null;
}

export default function DefectsPage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'critical'>('all');

  useEffect(() => {
    apiFetch('/defects').then(r => r.json()).then(data => {
      setDefects(data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const filtered = defects
    .filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
    .filter(d => filter === 'all' || (filter === 'open' ? d.status === 'open' : d.priority === 'critical'));

  const openCount = defects.filter(d => d.status === 'open').length;
  const criticalCount = defects.filter(d => d.priority === 'critical').length;
  const totalCost = defects.reduce((s, d) => s + (d.estimatedCost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Defects</h1>
        </div>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Log Defect</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 border-l-4 border-amber-500">
          <div><p className="text-sm text-slate-500">Open</p><p className="text-2xl font-bold">{openCount}</p></div>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <div><p className="text-sm text-slate-500">Critical</p><p className="text-2xl font-bold text-red-600">{criticalCount}</p></div>
        </Card>
        <Card className="p-4 border-l-4 border-violet-500">
          <div><p className="text-sm text-slate-500">Est. Cost</p><p className="text-2xl font-bold">${totalCost.toLocaleString()}</p></div>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Search defects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(['all','open','critical'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(d => (
          <Card key={d.id} className="p-4 hover:shadow-sm transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <Badge variant={d.priority === 'critical' ? 'destructive' : d.priority === 'high' ? 'warning' : 'outline'}>{d.priority}</Badge>
              <Badge variant={d.status === 'open' ? 'warning' : 'success'}>{d.status}</Badge>
            </div>
            <p className="font-semibold">{d.title}</p>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              {d.location && <p>📍 {d.location}</p>}
              {d.trade && <p>🔧 {d.trade}</p>}
              {d.dueDate && <p>📅 Due: {d.dueDate}</p>}
              {d.estimatedCost !== null && <p>💰 ${d.estimatedCost.toLocaleString()}</p>}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8 md:col-span-2 lg:col-span-3">No defects found</p>}
      </div>
    </div>
  );
}
