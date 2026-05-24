import { useState, useEffect } from 'react';
import { Search, ChevronRight, BarChart3, Database } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { CardSkeleton } from '../../ui/Skeleton';
import { Modal, StatusBadge } from '../shared';
import { apiFetch, type Row } from '../../../services/api';
import { PLAN_COLORS, PLAN_LABELS, fmtDate, fmtBytes, type Company } from '../types';

interface CompaniesTabProps {
  companies?: Company[];
  loading?: boolean;
}

export default function CompaniesTab({ companies: propCompanies = [], loading: propLoading = false }: CompaniesTabProps) {
  const [fetchedCompanies, setFetchedCompanies] = useState<Company[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    if (propCompanies.length > 0) { setFetchLoading(false); return; }
    apiFetch<Row[]>('/admin/stats/organizations')
      .then(rows => {
        if (!Array.isArray(rows)) return;
        setFetchedCompanies(rows.map(r => ({
          id: String(r.id ?? ''),
          name: String(r.name ?? ''),
          status: 'active' as const,
          subscriptionPlan: 'included' as const,
          userCount: Number(r.user_count ?? 0),
          userLimit: 100,
          projectCount: Number(r.project_count ?? 0),
          storageUsed: 0,
          storageLimit: 10 * 1024 * 1024 * 1024,
          createdAt: String(r.created_at ?? ''),
        })));
      })
      .catch(e => console.warn('[CompaniesTab] failed to load:', e))
      .finally(() => setFetchLoading(false));
  }, [propCompanies.length]);

  const companies = propCompanies.length > 0 ? propCompanies : fetchedCompanies;
  const loading = propLoading || fetchLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const filteredCompanies = companies.filter(company => {
    if (searchQuery && !company.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== 'all' && company.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full">
            <EmptyState title="No companies found" description="Try adjusting your search or filters" />
          </div>
        ) : (
          filteredCompanies.map(company => (
            <div
              key={company.id}
              onClick={() => { setSelectedCompany(company); setShowDetailsModal(true); }}
              className="card p-5 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">{company.name}</h3>
                    <p className="text-xs text-gray-500">Since {fmtDate(company.createdAt)}</p>
                  </div>
                </div>
                <StatusBadge status={company.status} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Product</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_COLORS[company.subscriptionPlan] ?? PLAN_COLORS.included}`}>
                    {PLAN_LABELS[company.subscriptionPlan] ?? company.subscriptionPlan}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Users</span>
                  <span className="text-sm text-white">{company.userCount} / {company.userLimit}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${(company.userCount / company.userLimit) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      {company.projectCount} projects
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {fmtBytes(company.storageUsed)}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Company Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedCompany(null); }}
        title="Company Details"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowDetailsModal(false); setSelectedCompany(null); }} className="btn btn-secondary">Close</button>
            <button className="btn btn-primary">Edit Settings</button>
          </div>
        }
      >
        {selectedCompany && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-800">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                {selectedCompany.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedCompany.name}</h3>
                <p className="text-sm text-gray-500">Created {fmtDate(selectedCompany.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Workspace</p>
                <p className="text-lg font-bold text-white">{PLAN_LABELS[selectedCompany.subscriptionPlan] ?? 'Full access'}</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Users</p>
                <p className="text-lg font-bold text-white">{selectedCompany.userCount}/{selectedCompany.userLimit}</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Projects</p>
                <p className="text-lg font-bold text-white">{selectedCompany.projectCount}</p>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Storage</p>
                <p className="text-lg font-bold text-white">{fmtBytes(selectedCompany.storageUsed)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">User Limit Usage</span>
                  <span className="text-sm text-white">{((selectedCompany.userCount / selectedCompany.userLimit) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(selectedCompany.userCount / selectedCompany.userLimit) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Storage Usage</span>
                  <span className="text-sm text-white">{((selectedCompany.storageUsed / selectedCompany.storageLimit) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(selectedCompany.storageUsed / selectedCompany.storageLimit) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg">
              <h4 className="font-medium text-white mb-3">Workspace</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  <StatusBadge status={selectedCompany.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Organisation since</span>
                  <span className="text-white">{fmtDate(selectedCompany.createdAt)}</span>
                </div>
                {selectedCompany.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Reference date</span>
                    <span className="text-white">{fmtDate(selectedCompany.expiresAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
