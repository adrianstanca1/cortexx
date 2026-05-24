'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { apiFetch } from '@/lib/api';
import { Loader2, Plus, Search, Filter, ArrowUpDown } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  location: string;
  status: string;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  owner: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: keyof Project; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [newProject, setNewProject] = useState({ name: '', location: '', budget: '' });

  useEffect(() => {
    apiFetch('/projects').then(r => r.json()).then(data => {
      setProjects(data.projects || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const createProject = async () => {
    await apiFetch('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: newProject.name, location: newProject.location, budget: Number(newProject.budget) || 0 }),
    });
    setShowCreate(false);
    setNewProject({ name: '', location: '', budget: '' });
    const r = await apiFetch('/projects');
    const d = await r.json();
    setProjects(d.projects || []);
  };

  const sorted = [...projects]
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ak = a[sort.key] ?? '';
      const bk = b[sort.key] ?? '';
      if (ak < bk) return sort.dir === 'asc' ? -1 : 1;
      if (ak > bk) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Project</Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm"><Filter className="mr-1 h-4 w-4" />Filter</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => setSort({ key: 'name', dir: sort.dir === 'asc' ? 'desc' : 'asc' })} >Name <ArrowUpDown className="inline h-3 w-3" /></TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="cursor-pointer" onClick={() => setSort({ key: 'budget', dir: sort.dir === 'asc' ? 'desc' : 'asc' })} >Budget <ArrowUpDown className="inline h-3 w-3" /></TableHead>
              <TableHead>Timeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.location}</TableCell>
                <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                <TableCell>{p.budget ? `$${p.budget.toLocaleString()}` : '-'}</TableCell>
                <TableCell>{p.startDate || '-'} → {p.endDate || '-'}</TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500">No projects found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Project">
        <div className="space-y-3">
          <input className="w-full rounded-md border px-3 py-2" placeholder="Name" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
          <input className="w-full rounded-md border px-3 py-2" placeholder="Location" value={newProject.location} onChange={e => setNewProject({ ...newProject, location: e.target.value })} />
          <input className="w-full rounded-md border px-3 py-2" placeholder="Budget" type="number" value={newProject.budget} onChange={e => setNewProject({ ...newProject, budget: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createProject}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
