'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOne, updateOne, removeOne } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Reusable detail+edit+delete page for any tenant-scoped CRUD entity
// in cortexbuild-platform's apps/web. Adapted from buildtrack-web's
// EntityDetail component (commit 48b72c8) to use this app's axios
// helpers (getOne/updateOne/removeOne) and shadcn-style UI primitives
// (Card/Button/Badge — no Input/Select components in this UI kit, so
// the form renders raw <input>/<textarea>/<select> styled with the
// same Tailwind classes the existing pages use).
//
// Expected backend convention:
//   GET    /api/<resource>/:id  → { data: T }
//   PUT    /api/<resource>/:id  → partial update
//   DELETE /api/<resource>/:id

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  serverKey?: string;
}

export interface MetaField {
  label: string;
  render: (record: any) => ReactNode;
}

export interface PillSpec {
  field: string;
  colors: Record<string, string>;
}

export interface EntityDetailConfig {
  entityName: string;
  pluralName: string;
  apiPath: string;
  backHref: string;
  titleField?: string;
  fields: FieldDef[];
  metaFields?: MetaField[];
  pills?: PillSpec[];
  longTextFields?: Array<{ key: string; label: string }>;
}

export function EntityDetail({ config }: { config: EntityDetailConfig }) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const titleField = config.titleField || 'title';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getOne<Record<string, any>>(`${config.apiPath}/${id}`)
      .then((r) => {
        setRecord(r);
        const next: Record<string, string> = {};
        for (const f of config.fields) {
          const v = r[f.serverKey ?? f.key];
          if (v === null || v === undefined) next[f.key] = '';
          else if (f.type === 'date') next[f.key] = String(v).slice(0, 10);
          else next[f.key] = String(v);
        }
        setForm(next);
      })
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [id, config.apiPath, config.fields]);

  const save = async () => {
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      const raw = form[f.key];
      if (f.type === 'number') {
        payload[f.key] = raw === '' ? null : Number(raw);
      } else if (raw === '' && !f.required) {
        payload[f.key] = null;
      } else {
        payload[f.key] = raw;
      }
    }
    try {
      const updated = await updateOne<Record<string, any>>(`${config.apiPath}/${id}`, payload);
      setRecord(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete this ${config.entityName.toLowerCase()}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await removeOne(`${config.apiPath}/${id}`);
      router.push(config.backHref);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not delete.');
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!record) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href={config.backHref} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <Card className="p-12 text-center text-gray-500">
          {config.entityName} not found, or you don&apos;t have access.
        </Card>
      </div>
    );
  }

  const title = record[titleField] ?? `${config.entityName} ${id.slice(0, 8)}`;

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href={config.backHref} className="inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Back to {config.pluralName.toLowerCase()}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex gap-2">
          {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
          <Button variant="outline" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <Card className="space-y-4 p-6">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
            {config.fields.map((f) => {
              const value = form[f.key] ?? '';
              const setValue = (v: string) => setForm({ ...form, [f.key]: v });
              if (f.type === 'textarea') {
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">{f.label}</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      required={f.required}
                    />
                  </div>
                );
              }
              if (f.type === 'select') {
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">{f.label}</label>
                    <select
                      className={inputCls}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      required={f.required}
                    >
                      {!f.required && <option value="">—</option>}
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div key={f.key} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">{f.label}</label>
                  <input
                    type={f.type}
                    className={inputCls}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required={f.required}
                  />
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(''); }}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {config.pills && config.pills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.pills.map((p) => {
                  const v = String(record[p.field] ?? '');
                  if (!v) return null;
                  const cls = p.colors[v] || 'bg-gray-100 text-gray-700';
                  return (
                    <Badge key={p.field} className={cls}>{v}</Badge>
                  );
                })}
              </div>
            )}

            {config.longTextFields?.map(({ key, label }) => {
              const v = record[key];
              if (!v) return null;
              return (
                <div key={key}>
                  <div className="text-xs font-medium uppercase text-gray-400">{label}</div>
                  <p className="mt-1 whitespace-pre-wrap text-gray-700">{v}</p>
                </div>
              );
            })}

            {config.metaFields && config.metaFields.length > 0 && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {config.metaFields.map((m) => (
                  <div key={m.label}>
                    <div className="text-xs font-medium uppercase text-gray-400">{m.label}</div>
                    <div className="mt-1 text-gray-700">{m.render(record) ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
