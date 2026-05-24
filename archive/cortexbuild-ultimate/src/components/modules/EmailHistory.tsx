import { useState, useEffect } from 'react';
import { Search, Mail, CheckCircle, X, Bell, Send, FileText } from 'lucide-react';
import { emailApi } from '../../services/api';
import { toast } from 'sonner';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type AnyRow = Record<string, unknown>;
type SubTab = 'inbox' | 'sent' | 'threads' | 'notifications' | 'templates';

const EMAIL_TEMPLATES = [
  { name: 'Contract Award', subject: 'Contract Award Notice — [Project Name]', body: 'Dear [Recipient],\n\nPlease find attached the contract award documentation for [Project Name]...' },
  { name: 'Payment Application', subject: 'Payment Application [Month/Period]', body: 'Please see attached payment application for [Project Name]...' },
  { name: 'RFI Acknowledgement', subject: 'RFI [Number] — Acknowledged', body: 'Thank you for your RFI. We acknowledge receipt of RFI [Number]...' },
  { name: 'Defect Notice', subject: 'Defect Notice — [Project]', body: 'The following defects have been identified and require rectification...' },
  { name: 'Meeting Invite', subject: '[Type] Meeting — [Date]', body: 'Please see attached for details of the forthcoming [Type] meeting...' },
];

export function EmailHistory() {
  const [emails, setEmails] = useState<AnyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    emailApi.getHistory(50, page * 50)
      .then(data => {
        setEmails(data.emails as AnyRow[]);
        setTotal(data.total);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [page]);

  const _refetch = () => setPage(p => p);

  const [subTab, setSubTab] = useState<SubTab>('inbox');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [, _setShowModal] = useState(false);
  const [, setSelectedEmail] = useState<AnyRow | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [compose, setCompose] = useState({ to: '', cc: '', subject: '', body: '', project: '', attachments: '', priority: false });
  const [, _setShowTemplateModal] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const inboxEmails = emails.filter((e) => String(e.direction ?? '') !== 'sent');
  const sentEmails = emails.filter((e) => String(e.direction ?? '') === 'sent');
  const unreadEmails = emails.filter((e) => !e.read_at);
  const notificationEmails = emails.filter((e) =>
    ['rfi_response', 'invoice_due', 'approval_required', 'document_shared', 'deadline_approaching'].includes(
      String(e.type ?? '')
    )
  );

  const filtered = inboxEmails.filter((e) => {
    const matchSearch = String(e.subject ?? '')
      .toLowerCase()
      .includes(search.toLowerCase()) ||
      String(e.from ?? '')
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchProject = projectFilter === 'All' || String(e.project ?? '') === projectFilter;
    return matchSearch && matchProject;
  });

  const [sending, setSending] = useState(false);

  async function handleCompose(e: React.FormEvent) {
    e.preventDefault();
    if (!compose.to || !compose.subject || !compose.body) {
      toast.error('Recipient, subject, and body are required');
      return;
    }
    setSending(true);
    try {
      await emailApi.sendCustom({ to: compose.to, cc: compose.cc, subject: compose.subject, body: compose.body, project: compose.project });
      toast.success('Email sent successfully');
      setShowComposeModal(false);
      setCompose({ to: '', cc: '', subject: '', body: '', project: '', attachments: '', priority: false });
      // Refresh inbox
      setPage(0);
      const data = await emailApi.getHistory(50, 0);
      setEmails(data.emails as AnyRow[]);
      setTotal(data.total);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  const projects = Array.from(new Set(emails.map((e) => String(e.project ?? '')).filter((p) => p)));

  return (
    <>
      <ModuleBreadcrumbs currentModule="email-history" />
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-white">Email</h1>
          <p className="text-sm text-gray-500 mt-1">Project correspondence & document sharing</p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Mail size={16} />
          <span>Compose</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Unread', value: unreadEmails.length, colour: 'text-blue-400', bg: 'bg-blue-500/20' },
          { label: 'Sent Today', value: sentEmails.filter((e) => String(e.date ?? '').startsWith(today)).length, colour: 'text-green-400', bg: 'bg-green-500/20' },
          { label: 'Active Threads', value: emails.filter((e) => Boolean(e.thread_id)).length, colour: 'text-purple-400', bg: 'bg-purple-500/20' },
          { label: 'Notifications', value: notificationEmails.length, colour: 'text-orange-400', bg: 'bg-orange-500/20' },
        ].map((kpi, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-700 p-4">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-display ${kpi.colour}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-700 cb-table-scroll touch-pan-x">
        {(['inbox', 'sent', 'threads', 'notifications', 'templates'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              subTab === tab
                ? 'border-orange-600 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {subTab !== 'templates' && (
        <div className="flex flex-wrap gap-3 items-center bg-gray-900 rounded-xl border border-gray-700 p-4">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emails…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-sm bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option>All</option>
            {projects.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 ml-auto">{filtered.length} found</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      ) : (
        <>
          {subTab === 'inbox' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Mail size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No emails</p>
                </div>
              ) : (
                filtered.map((e) => {
                  const isUnread = !e.read_at;
                  return (
                    <div
                      key={String(e.id)}
                      onClick={() => setSelectedEmail(e)}
                      className={`p-4 hover:bg-gray-800 cursor-pointer transition-colors ${isUnread ? 'bg-gray-800/50' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {isUnread && <div className="w-2 h-2 rounded-full bg-orange-400 mt-2" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`font-medium truncate ${isUnread ? 'text-white font-semibold' : 'text-gray-300'}`}>
                              {String(e.from ?? '—')}
                            </p>
                            {!!e.priority && <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">Priority</span>}
                          </div>
                          <p className={`text-sm truncate ${isUnread ? 'text-white font-medium' : 'text-gray-400'}`}>
                            {String(e.subject ?? '(No subject)')}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span>{String(e.date ?? '—')}</span>
                            {!!e.project && <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded">{String(e.project)}</span>}
                            {Number(e.attachment_count ?? 0) > 0 && <span className="flex items-center gap-1"><FileText size={10} />Attachment</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {subTab === 'sent' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {sentEmails.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Send size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No sent emails</p>
                </div>
              ) : (
                sentEmails.map((e) => (
                  <div key={String(e.id)} className="p-4 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">To: {String(e.to ?? '—')}</p>
                        <p className="text-sm text-gray-400 truncate">{String(e.subject ?? '(No subject)')}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>{String(e.date ?? '—')}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-medium ${
                              String(e.status ?? '') === 'read'
                                ? 'bg-green-500/20 text-green-300'
                                : String(e.status ?? '') === 'delivered'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {String(e.status ?? 'Sent')}
                          </span>
                        </div>
                      </div>
                      {Number(e.attachment_count ?? 0) > 0 && <FileText size={16} className="text-gray-400 flex-shrink-0" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'threads' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {emails.filter((e) => Boolean(e.thread_id)).length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Mail size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No email threads</p>
                </div>
              ) : (
                Array.from(
                  new Map(
                    emails
                      .filter((e) => Boolean(e.thread_id))
                      .map((e) => [
                        String(e.thread_id),
                        {
                          id: String(e.thread_id),
                          subject: String(e.subject ?? ''),
                          participants: [String(e.from ?? ''), String(e.to ?? '')],
                          messageCount: emails.filter((x) => String(x.thread_id) === String(e.thread_id)).length,
                          lastActivity: String(e.date ?? ''),
                        },
                      ])
                  ).values()
                ).map((thread) => (
                  <div key={thread.id} className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{thread.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">{thread.participants.slice(0, 2).join(', ')}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full font-medium">
                          {thread.messageCount} messages
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{thread.lastActivity}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'notifications' && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 divide-y divide-gray-700">
              {notificationEmails.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Bell size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No notifications</p>
                </div>
              ) : (
                notificationEmails.map((n) => {
                  const typeColour = {
                    rfi_response: 'bg-blue-500/20 text-blue-300',
                    invoice_due: 'bg-orange-500/20 text-orange-300',
                    approval_required: 'bg-purple-500/20 text-purple-300',
                    document_shared: 'bg-green-500/20 text-green-300',
                    deadline_approaching: 'bg-red-500/20 text-red-300',
                  };
                  return (
                    <div key={String(n.id)} className="p-4 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                typeColour[String(n.type ?? '') as keyof typeof typeColour] || 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {String(n.type ?? '').replace(/_/g, ' ')}
                            </span>
                            {!n.read_at && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                          </div>
                          <p className="text-sm text-gray-300">{String(n.subject ?? n.message ?? '—')}</p>
                          <p className="text-xs text-gray-500 mt-1">{String(n.date ?? '—')}</p>
                        </div>
                        <button className="flex-shrink-0 p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/20 rounded">
                          <CheckCircle size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {subTab === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {EMAIL_TEMPLATES.map((t, i) => (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                  <h3 className="font-semibold text-white mb-2">{t.name}</h3>
                  <p className="text-sm text-gray-400 mb-4">Subject: {t.subject}</p>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2">{t.body}</p>
                  <button
                    onClick={() => {
                      setCompose((c) => ({ ...c, subject: t.subject, body: t.body }));
                      setShowComposeModal(true);
                    }}
                    className="w-full px-3 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 font-medium"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showComposeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
              <h2 className="text-lg font-semibold text-white">Compose Email</h2>
              <button type="button" onClick={() => setShowComposeModal(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCompose} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">To *</label>
                  <input
                    required
                    value={compose.to}
                    onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                    placeholder="recipient@example.com"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CC</label>
                  <input
                    value={compose.cc}
                    onChange={(e) => setCompose((c) => ({ ...c, cc: e.target.value }))}
                    placeholder="cc@example.com"
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Subject *</label>
                    <input
                      required
                      value={compose.subject}
                      onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Project</label>
                    <input
                      value={compose.project}
                      onChange={(e) => setCompose((c) => ({ ...c, project: e.target.value }))}
                      placeholder="e.g. ABC Building"
                      className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
                  <textarea
                    rows={6}
                    value={compose.body}
                    onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="priority"
                    checked={compose.priority}
                    onChange={(e) => setCompose((c) => ({ ...c, priority: e.target.checked }))}
                    className="h-4 w-4 rounded"
                  />
                  <label htmlFor="priority" className="text-sm text-gray-300">
                    Mark as priority
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  Send Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
export default EmailHistory;
