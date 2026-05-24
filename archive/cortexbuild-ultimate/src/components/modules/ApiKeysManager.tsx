import React, { useState, useMemo } from 'react';
import { Key, Plus, X, Copy, Trash2, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiKeysApi } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

function randomColor(name: string) {
  const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  return colors[name.length % colors.length];
}

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  key?: string;
};

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', scopes: [] as string[] });
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const SCOPE_OPTIONS = [
    { label: 'Read Projects', value: 'projects:read' },
    { label: 'Write Projects', value: 'projects:write' },
    { label: 'Read Tasks', value: 'tasks:read' },
    { label: 'Write Tasks', value: 'tasks:write' },
    { label: 'Read Invoices', value: 'invoices:read' },
    { label: 'Write Invoices', value: 'invoices:write' },
    { label: 'Read Safety', value: 'safety:read' },
    { label: 'Write Safety', value: 'safety:write' },
    { label: 'Webhook', value: 'webhook:receive' },
    { label: 'Reports', value: 'reports:read' },
  ];

  async function load() {
    setLoading(true);
    try {
      const data = await apiKeysApi.getAll();
      setKeys(data as ApiKey[]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const res = await apiKeysApi.create({ name: form.name.trim(), scopes: form.scopes });
      const created = (res as unknown as ApiKey);
      setKeys([created, ...keys]);
      setShowCreate(false);
      setForm({ name: '', scopes: [] });
      setVisibleKey(created.key || null);
      toast.success('API key created — copy it now, it won\'t be shown again');
    } catch (err: any) {
      toast.error(err?.message || 'Create failed');
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      const res = await apiKeysApi.update(id, { isActive: !active });
      const updated = res as ApiKey;
      setKeys(keys.map(k => (k.id === id ? { ...k, ...updated } : k)));
      toast.success(updated.isActive ? 'Key activated' : 'Key deactivated');
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this API key? Apps using this key will break.')) return;
    try {
      await apiKeysApi.delete(id);
      setKeys(keys.filter(k => k.id !== id));
      toast.success('API key deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  }

  function copy(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Copied to clipboard');
  }

  const activeCount = useMemo(() => keys.filter(k => k.isActive).length, [keys]);

  return (
    <div className="space-y-6">
      <ModuleBreadcrumbs currentModule="api-keys" />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key size={24} className="text-orange-500" />
            API Keys
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage keys for integrations and third-party access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary bg-orange-600 hover:bg-orange-700 border-none text-white flex items-center gap-2">
          <Plus size={18} /> New Key
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <p className="text-sm text-gray-400">Active Keys</p>
          <p className="text-3xl font-bold text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <p className="text-sm text-gray-400">Total Keys</p>
          <p className="text-3xl font-bold text-white mt-1">{keys.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <p className="text-sm text-gray-400">Scopes Offered</p>
          <p className="text-3xl font-bold text-white mt-1">{SCOPE_OPTIONS.length}</p>
        </div>
      </div>

      {loading && <div className="text-gray-400 text-center py-12">Loading API keys…</div>}

      {!loading && keys.length === 0 && (
        <div className="border border-gray-700 rounded-xl p-8 text-center bg-gray-900">
          <Key size={40} className="text-gray-600 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-1">No API keys yet</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
            Create an API key to let external services securely access data in CortexBuild.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary bg-orange-600 text-white">Create First Key</button>
        </div>
      )}

      {!loading && keys.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Prefix</th>
                <th className="px-3 py-2 text-left">Scopes</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Last Used</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-gray-800/40">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: randomColor(k.name) }}>
                        {k.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-gray-200 font-medium">{k.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <code className="text-xs bg-gray-800 px-2 py-1 rounded text-orange-400 border border-orange-500/20">{k.keyPrefix}***</code>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes || []).slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-400 bg-gray-800">{s}</span>
                      ))}
                      {(k.scopes || []).length > 3 && <span className="text-[10px] text-gray-500">+{(k.scopes || []).length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => toggleActive(k.id, k.isActive)} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${k.isActive ? 'bg-green-900/20 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-500'}`}>
                      {k.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-gray-400 max-w-[140px] truncate">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-3 text-gray-400">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {k.key && (
                        <button onClick={() => { if (visibleKey === k.key) setVisibleKey(null); else setVisibleKey(k.key || null); }} className="text-gray-500 hover:text-orange-400" title="Show/Hide key">
                          {visibleKey === k.key ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                      {k.key && (
                        <button onClick={() => copy(k.key!)} className="text-gray-500 hover:text-orange-400" title="Copy">
                          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      )}
                      <button onClick={() => handleDelete(k.id)} className="text-gray-500 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reveal created key row */}
      {visibleKey && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 border border-orange-500/30 rounded-xl p-4 shadow-2xl max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-orange-400" />
            <h4 className="text-sm font-semibold text-white">New API Key Created</h4>
          </div>
          <p className="text-xs text-gray-400 mb-2">Copy this now. You won’t be able to view it again.</p>
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 mb-2">
            <code className="text-xs text-orange-300 flex-1 truncate">{visibleKey}</code>
            <button onClick={() => copy(visibleKey)} className="text-gray-400 hover:text-white">{copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
          </div>
          <button onClick={() => setVisibleKey(null)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1"><X size={12} /> Close</button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">New API Key</h3>
              <button onClick={() => setShowCreate(false)}><X size={20} className="text-gray-400 hover:text-white" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full input input-bordered bg-gray-800 border-gray-700 text-white" placeholder="e.g. Zapier Production" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Scopes</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {SCOPE_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(opt.value)}
                        onChange={() => setForm(prev => {
                          const exists = prev.scopes.includes(opt.value);
                          return { ...prev, scopes: exists ? prev.scopes.filter(s => s !== opt.value) : [...prev.scopes, opt.value] };
                        })}
                        className="accent-orange-500"
                      />
                      <span className="text-xs">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-orange-900/20 border border-orange-500/20 rounded-lg text-xs text-orange-200">
                <strong className="text-orange-400">Security note:</strong> Keep this key secure. API keys grant access to organization data.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost text-gray-300">Cancel</button>
                <button type="submit" className="btn btn-primary bg-orange-600 hover:bg-orange-700 border-none text-white">Create Key</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
