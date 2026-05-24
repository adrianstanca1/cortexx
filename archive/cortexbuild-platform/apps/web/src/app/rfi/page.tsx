'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface RFI {
  id: string;
  subject: string;
  status: string;
  priority: string;
  projectId: string | null;
  requestedBy: string | null;
  createdAt: string | null;
}

export default function RFIPage() {
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/rfi').then(r => r.json()).then(data => {
      setRfis(data.rfis || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">RFI</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4"><div className="text-sm text-slate-500">Total</div><div className="text-2xl font-bold">{rfis.length}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">Open</div><div className="text-2xl font-bold">{rfis.filter(r => r.status !== 'resolved').length}</div></Card>
        <Card className="p-4"><div className="text-sm text-slate-500">High Priority</div><div className="text-2xl font-bold text-red-600">{rfis.filter(r => r.priority === 'high').length}</div></Card>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rfis.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.subject}</TableCell>
                <TableCell><Badge variant={r.status === 'resolved' ? 'success' : r.status === 'open' ? 'warning' : 'secondary'}>{r.status}</Badge></TableCell>
                <TableCell><Badge variant={r.priority === 'high' ? 'destructive' : 'outline'}>{r.priority}</Badge></TableCell>
                <TableCell>{r.requestedBy || '-'}</TableCell>
                <TableCell>{r.createdAt || '-'}</TableCell>
              </TableRow>
            ))}
            {rfis.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500">No RFIs found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
