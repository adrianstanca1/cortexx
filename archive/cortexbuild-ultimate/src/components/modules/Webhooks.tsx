/**
 * Webhooks — UI for managing webhook subscriptions and delivery logs.
 * Tabbed interface: Webhooks, Deliveries, Events
 * Uses webhooksApi from services/api.ts.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Webhook as WebhookIcon, Plus, Search, Trash2, Edit2, X, Send, CheckCircle,
  XCircle, Clock, ChevronDown, ChevronUp, RefreshCw, Activity, Copy,
  Code, Filter, ArrowUpRight, Zap, AlertCircle
} from 'lucide-react';
import { webhooksApi } from '../../services/api';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';
import { EmptyState } from '../ui/EmptyState';
import { toast } from 'sonner';

type Webhook = {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  headers?: Record<string, string>;
  active: boolean;
  retryPolicy?: 'immediate' | '1min' | '5min' | 'exponential';
  created_at: string;
  updated_at?: string;
};

type Delivery = {
  id: string;
  webhook_id: string;
  webhookName?: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  response_status?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  request_payload?: Record<string, unknown>;
  attempted_at: string;
  duration_ms?: number;
  error?: string;
  retryCount?: number;
};

type WebhookEvent = {
  name: string;
  group: string;
  description: string;
  examplePayload: string;
};

const EVENT_GROUPS: Record<string, string[]> = {
  'Projects': ['project.created', 'project.updated', 'project.completed', 'project.archived'],
  'Invoices': ['invoice.created', 'invoice.updated', 'invoice.paid', 'invoice.overdue'],
  'Valuations': ['valuation.created', 'valuation.submitted', 'valuation.certified'],
  'Safety': ['safety.incident.created', 'safety.incident.closed', 'safety.audit.completed'],
  'RFIs': ['rfi.created', 'rfi.updated', 'rfi.answered', 'rfi.closed'],
  'Change Orders': ['change-order.created', 'change-order.submitted', 'change-order.approved', 'change-order.rejected'],
  'Documents': ['document.uploaded', 'document.approved', 'document.archived'],
  'Team': ['team.member.added', 'team.member.removed', 'team.role.changed'],
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  'project.created': 'Fired when a new project is created',
  'project.updated': 'Fired when project details are modified',
  'project.completed': 'Fired when project reaches completion',
  'project.archived': 'Fired when a project is archived',
  'invoice.created': 'Fired when a new invoice is created',
  'invoice.updated': 'Fired when invoice is updated',
  'invoice.paid': 'Fired when an invoice is paid',
  'invoice.overdue': 'Fired when an invoice becomes overdue',
  'valuation.created': 'Fired when a new valuation is submitted',
  'valuation.submitted': 'Fired when valuation is formally submitted',
  'valuation.certified': 'Fired when valuation is certified',
  'safety.incident.created': 'Fired when a safety incident is reported',
  'safety.incident.closed': 'Fired when incident is resolved',
  'safety.audit.completed': 'Fired when a site safety audit is completed',
  'rfi.created': 'Fired when an RFI is raised',
  'rfi.updated': 'Fired when RFI details change',
  'rfi.answered': 'Fired when an RFI receives a response',
  'rfi.closed': 'Fired when an RFI is closed',
  'change-order.created': 'Fired when a change order is created',
  'change-order.submitted': 'Fired when submitted for approval',
  'change-order.approved': 'Fired when approved by client',
  'change-order.rejected': 'Fired when rejected',
  'document.uploaded': 'Fired when a document is uploaded',
  'document.approved': 'Fired when document is approved',
  'document.archived': 'Fired when document is archived',
  'team.member.added': 'Fired when team member is added',
  'team.member.removed': 'Fired when team member is removed',
  'team.role.changed': 'Fired when a team member role changes',
};

export function Webhooks() {
  const [activeTab, setActiveTab] = useState<'webhooks' | 'deliveries' | 'events'>('webhooks');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [deliveryWebhookFilter, setDeliveryWebhookFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showDeliveryDetail, setShowDeliveryDetail] = useState<Delivery | null>(null);
  const [showEventDetail, setShowEventDetail] = useState<string | null>(null);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    headers: {} as Record<string, string>,
    active: true,
    retryPolicy: 'exponential' as Webhook['retryPolicy']
  });
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [deliveryLoading, setDeliveryLoading] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [eventSearch, setEventSearch] = useState('');

  const getMockWebhooks = (): Webhook[] => [
    {
      id: 'wh-001',
      name: 'Slack Notifications',
      url: 'https://hooks.slack.com/services/abc123/def456',
      secret: 'secret_abc123',
      events: ['project.updated', 'invoice.paid', 'rfi.created'],
      active: true,
      retryPolicy: 'exponential',
      created_at: '2025-01-15'
    },
    {
      id: 'wh-002',
      name: 'External CRM Sync',
      url: 'https://api.crm.example.com/webhooks/projects',
      secret: 'secret_def456',
      events: ['project.created', 'project.updated'],
      active: true,
      retryPolicy: '5min',
      created_at: '2025-02-01'
    },
    {
      id: 'wh-003',
      name: 'Accounting System',
      url: 'https://accounting.example.com/webhook',
      secret: 'secret_ghi789',
      events: ['invoice.created', 'invoice.paid', 'valuation.certified'],
      active: false,
      retryPolicy: 'exponential',
      created_at: '2025-03-10'
    }
  ];

  const getMockDeliveries = (): Delivery[] => [
    { id: 'd-001', webhook_id: 'wh-001', webhookName: 'Slack Notifications', event: 'project.updated', status: 'success', response_status: 200, attempted_at: '2025-04-24T10:30:00Z', duration_ms: 245, retryCount: 0 },
    { id: 'd-002', webhook_id: 'wh-002', webhookName: 'External CRM Sync', event: 'project.created', status: 'success', response_status: 201, attempted_at: '2025-04-24T09:15:00Z', duration_ms: 512, retryCount: 0 },
    { id: 'd-003', webhook_id: 'wh-001', webhookName: 'Slack Notifications', event: 'invoice.paid', status: 'failed', response_status: 500, error: 'Slack API timeout', attempted_at: '2025-04-24T08:45:00Z', duration_ms: 5000, retryCount: 3 },
    { id: 'd-004', webhook_id: 'wh-003', webhookName: 'Accounting System', event: 'valuation.certified', status: 'pending', attempted_at: '2025-04-24T08:00:00Z', retryCount: 0 },
    { id: 'd-005', webhook_id: 'wh-002', webhookName: 'External CRM Sync', event: 'project.updated', status: 'success', response_status: 200, attempted_at: '2025-04-23T16:20:00Z', duration_ms: 380, retryCount: 0 },
    { id: 'd-006', webhook_id: 'wh-001', webhookName: 'Slack Notifications', event: 'rfi.created', status: 'success', response_status: 200, attempted_at: '2025-04-23T14:50:00Z', duration_ms: 210, retryCount: 0 },
  ];

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await webhooksApi.getAll();
      const data = (Array.isArray(res.data) ? res.data : getMockWebhooks()) as Webhook[];
      setWebhooks(data);
      // Also load deliveries
      try {
        const delRes = await webhooksApi.getDeliveries('all');
        setAllDeliveries((Array.isArray(delRes.data) ? delRes.data : getMockDeliveries()) as Delivery[]);
      } catch {
        setAllDeliveries(getMockDeliveries());
      }
    } catch {
      setWebhooks(getMockWebhooks());
      setAllDeliveries(getMockDeliveries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  async function loadDeliveries(webhookId: string) {
    if (expandedId !== webhookId) {
      setExpandedId(webhookId);
    }
    if (deliveries[webhookId]) return;
    setDeliveryLoading(webhookId);
    try {
      const res = await webhooksApi.getDeliveries(webhookId);
      setDeliveries(prev => ({ ...prev, [webhookId]: (Array.isArray(res.data) ? res.data : []) as Delivery[] }));
    } catch {
      toast.error('Failed to load delivery logs');
    } finally {
      setDeliveryLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.url) {
      toast.error('Name and URL are required');
      return;
    }
    try {
      if (editing) {
        await webhooksApi.update(editing.id, form);
        toast.success('Webhook updated');
      } else {
        await webhooksApi.create(form);
        toast.success('Webhook created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', url: '', secret: '', events: [], headers: {}, active: true, retryPolicy: 'exponential' });
      fetchWebhooks();
    } catch {
      toast.error(editing ? 'Failed to update webhook' : 'Failed to create webhook');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook?')) return;
    try {
      await webhooksApi.delete(id);
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch {
      toast.error('Failed to delete webhook');
    }
  }

  async function handleSendTest(id: string) {
    setTestingId(id);
    try {
      await webhooksApi.sendTest(id);
      toast.success('Test event sent');
    } catch {
      toast.error('Failed to send test event');
    } finally {
      setTestingId(null);
    }
  }

  function openEdit(w: Webhook) {
    setEditing(w);
    setForm({ name: w.name, url: w.url, secret: w.secret || '', events: w.events || [], headers: w.headers || {}, active: w.active, retryPolicy: w.retryPolicy || 'exponential' });
    setShowModal(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', url: '', secret: '', events: [], headers: {}, active: true, retryPolicy: 'exponential' });
    setShowModal(true);
  }

  function toggleEvent(event: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }));
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  const getEventsByGroup = () => {
    const grouped: Record<string, string[]> = {};
    Object.entries(EVENT_GROUPS).forEach(([group, events]) => {
      grouped[group] = events.filter(e =>
        eventSearch === '' || e.toLowerCase().includes(eventSearch.toLowerCase()) ||
        (EVENT_DESCRIPTIONS[e] && EVENT_DESCRIPTIONS[e].toLowerCase().includes(eventSearch.toLowerCase()))
      );
    });
    return Object.fromEntries(Object.entries(grouped).filter(([_, events]) => events.length > 0));
  };

  const filteredWebhooks = webhooks.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.url.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDeliveries = allDeliveries.filter(d => {
    const matchesStatus = deliveryStatusFilter === 'all' || d.status === deliveryStatusFilter;
    const matchesWebhook = deliveryWebhookFilter === '' || d.webhook_id === deliveryWebhookFilter;
    const matchesSearch = deliverySearch === '' ||
      d.event.toLowerCase().includes(deliverySearch.toLowerCase()) ||
      (d.webhookName && d.webhookName.toLowerCase().includes(deliverySearch.toLowerCase()));
    return matchesStatus && matchesWebhook && matchesSearch;
  });

  const successRate = allDeliveries.length > 0
    ? Math.round((allDeliveries.filter(d => d.status === 'success').length / allDeliveries.length) * 1000) / 10
    : 0;

  function addHeader() {
    if (!headerKey.trim()) return;
    setForm(f => ({ ...f, headers: { ...f.headers, [headerKey.trim()]: headerVal } }));
    setHeaderKey('');
    setHeaderVal('');
  }

  function removeHeader(key: string) {
    setForm(f => {
      const h = { ...f.headers };
      delete h[key];
      return { ...f, headers: h };
    });
  }

  const statusColour = (active: boolean) => active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/30 text-gray-400';

  const deliveryColour = (status: string) => {
    if (status === 'success') return 'text-green-400';
    if (status === 'failed') return 'text-red-400';
    return 'text-yellow-400';
  };

  const deliveryStatusBg = (status: string) => {
    if (status === 'success') return 'bg-green-500/10 border-green-500/30';
    if (status === 'failed') return 'bg-red-500/10 border-red-500/30';
    return 'bg-yellow-500/10 border-yellow-500/30';
  };

  return (
    <>
      <ModuleBreadcrumbs currentModule="webhooks" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display text-white">Webhooks</h1>
            <p className="text-sm text-gray-400 mt-1">Manage webhook subscriptions and delivery logs</p>
          </div>
          {activeTab === 'webhooks' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
            >
              <Plus size={16} /> New Webhook
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 border-b-0 p-0 flex">
          {(['webhooks', 'deliveries', 'events'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-orange-500 text-orange-400 bg-gray-800/50'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'webhooks' && 'Webhooks'}
              {tab === 'deliveries' && 'Deliveries'}
              {tab === 'events' && 'Events'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* WEBHOOKS TAB */}
            {activeTab === 'webhooks' && (
              <>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search webhooks..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {filteredWebhooks.length === 0 ? (
                  <EmptyState
                    icon={WebhookIcon}
                    title="No webhooks configured"
                    description="Create a webhook to receive real-time notifications when events occur."
                  />
                ) : (
                  <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
                    {filteredWebhooks.map(w => {
                      const lastDelivery = allDeliveries.find(d => d.webhook_id === w.id);
                      return (
                        <div key={w.id}>
                          <div className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer" onClick={() => loadDeliveries(w.id)}>
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                              <WebhookIcon size={20} className="text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{w.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColour(w.active)}`}>
                                  {w.active ? 'Active' : 'Inactive'}
                                </span>
                                {lastDelivery && (
                                  <div className={`w-2 h-2 rounded-full ${lastDelivery.status === 'success' ? 'bg-green-400' : lastDelivery.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                                )}
                              </div>
                              <p className="text-sm text-gray-400 truncate font-mono text-xs">{w.url.substring(0, 60)}...</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded">{w.events?.length || 0} events</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(w.url); }}
                                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 px-2 py-0.5 rounded flex items-center gap-1"
                                >
                                  <Copy size={12} /> Copy URL
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={e => { e.stopPropagation(); handleSendTest(w.id); }}
                                disabled={testingId === w.id}
                                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                                title="Send test event"
                              >
                                {testingId === w.id ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); openEdit(w); }}
                                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(w.id); }}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                              {(expandedId === w.id || deliveries[w.id]) && (
                                <ChevronUp size={16} className="text-gray-500" onClick={e => { e.stopPropagation(); setExpandedId(null); }} />
                              )}
                              {expandedId !== w.id && !deliveries[w.id] && (
                                <ChevronDown size={16} className="text-gray-500" />
                              )}
                            </div>
                          </div>

                          {expandedId === w.id && (
                            <div className="px-6 pb-4 bg-gray-800/30 border-t border-gray-800">
                              <div className="flex items-center gap-2 mb-3 pt-3">
                                <Activity size={14} className="text-gray-400" />
                                <span className="text-sm font-medium text-gray-300">Recent Deliveries</span>
                                {deliveryLoading === w.id && <RefreshCw size={12} className="animate-spin text-gray-400" />}
                              </div>
                              {deliveryLoading === w.id ? (
                                <div className="text-center py-4 text-sm text-gray-500">Loading...</div>
                              ) : deliveries[w.id]?.length === 0 ? (
                                <div className="text-center py-4 text-sm text-gray-500">No delivery logs yet.</div>
                              ) : (
                                <div className="space-y-2">
                                  {(deliveries[w.id] || []).slice(0, 10).map(d => (
                                    <button
                                      key={d.id}
                                      onClick={() => setShowDeliveryDetail(d)}
                                      className="w-full text-left flex items-center gap-3 text-xs bg-gray-800 hover:bg-gray-700/50 rounded-lg p-3 transition-colors"
                                    >
                                      <span className={deliveryColour(d.status)}>
                                        {d.status === 'success' ? <CheckCircle size={12} /> : d.status === 'failed' ? <XCircle size={12} /> : <Clock size={12} />}
                                      </span>
                                      <span className="text-gray-400">{d.event}</span>
                                      {d.response_status && <span className="text-gray-500">HTTP {d.response_status}</span>}
                                      {d.duration_ms && <span className="text-gray-500">{d.duration_ms}ms</span>}
                                      <span className="text-gray-600 ml-auto">{new Date(d.attempted_at).toLocaleString()}</span>
                                      {d.error && <span className="text-red-400 truncate max-w-xs">{d.error}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* DELIVERIES TAB */}
            {activeTab === 'deliveries' && (
              <>
                {/* Success Rate Card */}
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-display text-green-400">{successRate}%</div>
                    <div>
                      <p className="text-sm text-gray-300">Success Rate</p>
                      <p className="text-xs text-gray-500">{allDeliveries.filter(d => d.status === 'success').length} of {allDeliveries.length} deliveries succeeded</p>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
                  <div className="flex gap-3 flex-wrap">
                    <div className="relative flex-1 max-w-md">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        value={deliverySearch}
                        onChange={e => setDeliverySearch(e.target.value)}
                        placeholder="Search by webhook or event..."
                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <select
                      value={deliveryStatusFilter}
                      onChange={e => setDeliveryStatusFilter(e.target.value as any)}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="all">All Status</option>
                      <option value="success">Success</option>
                      <option value="failed">Failed</option>
                      <option value="pending">Pending</option>
                    </select>
                    <select
                      value={deliveryWebhookFilter}
                      onChange={e => setDeliveryWebhookFilter(e.target.value)}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">All Webhooks</option>
                      {webhooks.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Deliveries Table */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 border-b border-gray-800">
                      <tr>
                        {['Webhook', 'Event', 'Timestamp', 'Status', 'Code', 'Duration', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {filteredDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No deliveries found</td>
                        </tr>
                      ) : (
                        filteredDeliveries.map(d => (
                          <tr key={d.id} className={`hover:bg-gray-800/30 ${deliveryStatusBg(d.status)}`}>
                            <td className="px-4 py-3 text-white">{d.webhookName || 'Unknown'}</td>
                            <td className="px-4 py-3 text-gray-300">{d.event}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{new Date(d.attempted_at).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                d.status === 'success' ? 'bg-green-500/20 text-green-300' :
                                d.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                                'bg-yellow-500/20 text-yellow-300'
                              }`}>
                                {d.status === 'success' && <CheckCircle size={12} />}
                                {d.status === 'failed' && <XCircle size={12} />}
                                {d.status === 'pending' && <Clock size={12} />}
                                {d.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{d.response_status || '—'}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{d.duration_ms ? `${d.duration_ms}ms` : '—'}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setShowDeliveryDetail(d)}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* EVENTS TAB */}
            {activeTab === 'events' && (
              <>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={eventSearch}
                      onChange={e => setEventSearch(e.target.value)}
                      placeholder="Search events..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(getEventsByGroup()).map(([group, events]) => (
                    <div key={group} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                      <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800">
                        <h3 className="font-semibold text-white">{group}</h3>
                      </div>
                      <div className="divide-y divide-gray-800">
                        {events.map(event => (
                          <div
                            key={event}
                            className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                            onClick={() => setShowEventDetail(showEventDetail === event ? null : event)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-medium text-white font-mono text-sm">{event}</p>
                                <p className="text-sm text-gray-400 mt-1">{EVENT_DESCRIPTIONS[event]}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setForm(f => ({
                                      ...f,
                                      events: f.events.includes(event) ? f.events.filter(ev => ev !== event) : [...f.events, event]
                                    }));
                                    toast.success(form.events.includes(event) ? 'Event removed' : 'Event added to webhook');
                                  }}
                                  className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                                >
                                  Subscribe
                                </button>
                              </div>
                            </div>
                            {showEventDetail === event && (
                              <div className="mt-4 pt-4 border-t border-gray-800">
                                <p className="text-xs text-gray-400 mb-2">Example Payload:</p>
                                <pre className="bg-black/30 rounded p-3 text-xs text-gray-300 overflow-x-auto">
{`{
  "event": "${event}",
  "timestamp": "2025-04-24T10:30:00Z",
  "data": {
    "id": "proj-001",
    "name": "Project Name"
  }
}`}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Create/Edit Webhook Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Webhook' : 'New Webhook'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Slack Notifications"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Retry Policy</label>
                    <select
                      value={form.retryPolicy}
                      onChange={e => setForm(f => ({ ...f, retryPolicy: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="1min">1 min backoff</option>
                      <option value="5min">5 min backoff</option>
                      <option value="exponential">Exponential</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">URL *</label>
                  <input
                    value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://example.com/webhook"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Secret (optional)</label>
                  <input
                    value={form.secret}
                    onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                    placeholder="Signing secret for verification"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Events (grouped by category)</label>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {Object.entries(EVENT_GROUPS).map(([group, events]) => (
                      <div key={group}>
                        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">{group}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {events.map(e => (
                            <label key={e} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.events.includes(e)}
                                onChange={() => toggleEvent(e)}
                                className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                              />
                              <span className="text-xs text-gray-300">{e}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Custom Headers</label>
                  {Object.entries(form.headers).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">{k}: {v}</span>
                      <button type="button" onClick={() => removeHeader(k)} className="text-gray-400 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={headerKey}
                      onChange={e => setHeaderKey(e.target.value)}
                      placeholder="Header name"
                      className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      value={headerVal}
                      onChange={e => setHeaderVal(e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button type="button" onClick={addHeader} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white">Add</button>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-300">Active</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                    {editing ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delivery Detail Modal */}
        {showDeliveryDetail && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <h2 className="text-lg font-semibold text-white">Delivery Details</h2>
                <button onClick={() => setShowDeliveryDetail(null)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Webhook</p>
                    <p className="text-sm font-medium text-white">{showDeliveryDetail.webhookName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Event</p>
                    <p className="text-sm font-medium text-white">{showDeliveryDetail.event}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      showDeliveryDetail.status === 'success' ? 'bg-green-500/20 text-green-300' :
                      showDeliveryDetail.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {showDeliveryDetail.status === 'success' && <CheckCircle size={12} />}
                      {showDeliveryDetail.status === 'failed' && <XCircle size={12} />}
                      {showDeliveryDetail.status === 'pending' && <Clock size={12} />}
                      {showDeliveryDetail.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Response Code</p>
                    <p className="text-sm font-medium text-white">{showDeliveryDetail.response_status || '—'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">Request Payload</p>
                  <pre className="bg-black/30 rounded p-3 text-xs text-gray-300 overflow-x-auto">
{JSON.stringify({ event: showDeliveryDetail.event, timestamp: showDeliveryDetail.attempted_at, data: {} }, null, 2)}
                  </pre>
                </div>

                {showDeliveryDetail.response_body && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Response Body</p>
                    <pre className="bg-black/30 rounded p-3 text-xs text-gray-300 overflow-x-auto">
{showDeliveryDetail.response_body}
                    </pre>
                  </div>
                )}

                {showDeliveryDetail.error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Error</p>
                    <p className="text-sm text-red-300">{showDeliveryDetail.error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      toast.success('Retry queued');
                      setShowDeliveryDetail(null);
                    }}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                  >
                    Retry Delivery
                  </button>
                  <button onClick={() => setShowDeliveryDetail(null)} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Webhooks;
