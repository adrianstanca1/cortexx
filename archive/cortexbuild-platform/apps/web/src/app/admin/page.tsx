'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  status: string;
}

export default function AdminPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/workers').then(r => r.json()).then(data => {
      setWorkers(data.workers || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-slate-500">Workers</div><div className="text-2xl font-bold">{workers.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Active</div><div className="text-2xl font-bold">{workers.filter(w => w.status === 'active').length}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Roles</div><div className="text-2xl font-bold">{new Set(workers.map(w => w.role).filter(Boolean)).size}</div></Card>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.map(w => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell>{w.role || '-'}</TableCell>
                <TableCell>{w.email || '-'}</TableCell>
                <TableCell><Badge variant={w.status === 'active' ? 'success' : 'secondary'}>{w.status}</Badge></TableCell>
              </TableRow>
            ))}
            {workers.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-slate-500">No workers found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
