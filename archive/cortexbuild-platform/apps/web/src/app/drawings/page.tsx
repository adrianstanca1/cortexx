'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface Drawing {
  id: string;
  name: string;
  version: string;
  status: string;
  discipline: string | null;
  projectId: string | null;
  uploadedAt: string | null;
}

export default function DrawingsPage() {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/drawings').then(r => r.json()).then(data => {
      setDrawings(data.drawings || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Drawings</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Discipline</TableHead>
              <TableHead>Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drawings.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.version}</TableCell>
                <TableCell><Badge variant={d.status === 'approved' ? 'default' : 'secondary'}>{d.status}</Badge></TableCell>
                <TableCell>{d.discipline || '-'}</TableCell>
                <TableCell>{d.uploadedAt || '-'}</TableCell>
              </TableRow>
            ))}
            {drawings.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500">No drawings found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
