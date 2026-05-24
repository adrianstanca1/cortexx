'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, Wrench, Activity, AlertTriangle, Settings, MapPin, Calendar } from 'lucide-react';

interface EquipmentItem {
  id: string;
  name: string;
  type: string | null;
  status: string;
  location: string | null;
  lastService: string | null;
  nextService: string | null;
}

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'maintenance' | 'inactive'>('all');

  useEffect(() => {
    apiFetch('/equipment').then(r => r.json()).then(data => {
      setEquipment(data.equipment || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const active = equipment.filter(e => e.status === 'active').length;
  const maintenance = equipment.filter(e => e.status === 'maintenance').length;
  const inactive = equipment.filter(e => e.status === 'inactive').length;
  const filtered = filter === 'all' ? equipment : equipment.filter(e => e.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-slate-500" />
          <h1 className="text-2xl font-bold">Equipment</h1>
        </div>
        <Button size="sm"><Settings className="mr-1 h-4 w-4" />Add Equipment</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Active</p><p className="text-2xl font-bold">{active}</p></div>
            <Activity className="h-8 w-8 text-emerald-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Maintenance</p><p className="text-2xl font-bold">{maintenance}</p></div>
            <AlertTriangle className="h-8 w-8 text-amber-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-slate-400">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Inactive</p><p className="text-2xl font-bold">{inactive}</p></div>
            <Settings className="h-8 w-8 text-slate-400 opacity-70" />
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        {(['all','active','maintenance','inactive'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(e => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${e.status === 'active' ? 'bg-emerald-500' : e.status === 'maintenance' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <p className="font-semibold">{e.name}</p>
              </div>
              <Badge variant={e.status === 'active' ? 'success' : e.status === 'maintenance' ? 'warning' : 'secondary'}>{e.status}</Badge>
            </div>
            {e.type && <p className="text-xs text-slate-500 mb-2">{e.type}</p>}
            <div className="space-y-1 text-xs text-slate-400">
              {e.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</div>}
              {e.lastService && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Last: {e.lastService}</div>}
              {e.nextService && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Next: {e.nextService}</div>}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8 md:col-span-2 lg:col-span-3">No equipment found</p>}
      </div>
    </div>
  );
}
