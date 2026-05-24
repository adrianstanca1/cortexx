'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getOne, updateOne, removeOne } from '@/lib/api';

// Project detail + edit + delete for cortexbuild-platform/web.
// Backend: GET / PUT / DELETE /api/projects/:id, plus GET /:id/stats.

interface Project {
  id: string;
  name: string;
  description?: string | null;
  location: string;
  status: string;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  owner: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOne<Project>(`/projects/${id}`)
      .then((p) => {
        setProject(p);
        setForm({
          name: p.name,
          description: p.description ?? '',
          location: p.location,
          status: p.status,
          budget: p.budget,
          startDate: p.startDate?.slice(0, 10) ?? null,
          endDate: p.endDate?.slice(0, 10) ?? null,
        });
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateOne<Project>(`/projects/${id}`, {
        ...form,
        budget: form.budget === null || form.budget === undefined || String(form.budget) === ''
          ? null
          : Number(form.budget),
      });
      setProject(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    try {
      await removeOne(`/projects/${id}`);
      router.push('/projects');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not delete.');
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!project) {
    return (
      <div className="space-y-4 p-6">
        <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to projects
        </Link>
        <Card className="p-12 text-center text-gray-500">
          Project not found, or you don&apos;t have access.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/projects" className="inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Back to projects
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <div className="flex gap-2">
          {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button variant="outline" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <Card className="p-6 space-y-4">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={form.name ?? ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                rows={3}
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.location ?? ''}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.status ?? ''}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on-hold">On hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Budget</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.budget ?? ''}
                  onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Owner</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.owner ?? ''}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Start date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.startDate ?? ''}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">End date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.endDate ?? ''}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(''); }}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={statusColors[project.status] || 'bg-gray-100 text-gray-700'}>
                {project.status}
              </Badge>
            </div>
            {project.description && (
              <div>
                <div className="text-xs font-medium uppercase text-gray-400">Description</div>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">{project.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-xs uppercase text-gray-400">Location</div><div className="mt-1 text-gray-700">{project.location || '—'}</div></div>
              <div><div className="text-xs uppercase text-gray-400">Budget</div><div className="mt-1 text-gray-700">{project.budget != null ? `£${project.budget.toLocaleString()}` : '—'}</div></div>
              <div><div className="text-xs uppercase text-gray-400">Owner</div><div className="mt-1 text-gray-700">{project.owner || '—'}</div></div>
              <div><div className="text-xs uppercase text-gray-400">Start</div><div className="mt-1 text-gray-700">{project.startDate || '—'}</div></div>
              <div><div className="text-xs uppercase text-gray-400">End</div><div className="mt-1 text-gray-700">{project.endDate || '—'}</div></div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
