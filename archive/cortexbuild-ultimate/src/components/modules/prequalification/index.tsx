import { useState, useMemo } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { ModuleBreadcrumbs } from '../../ui/Breadcrumbs';
import { usePrequalification } from '../../../hooks/useData';
import type { Subcontractor, TabId, AppFormData, Stats } from './types';
import { SCORING_CRITERIA, TRADES } from './types';
import { QuickStats, ModalWrapper } from './shared';
import { ApplicationsTab } from './ApplicationsTab';
import { AssessmentTab } from './AssessmentTab';
import { ApprovedTab } from './ApprovedTab';
import { ExpiringTab } from './ExpiringTab';
import { ReportsTab } from './ReportsTab';
import type { Row } from '../../../services/api';

function mapApiToSubcontractor(row: Row): Subcontractor {
  return {
    id: String(row.id ?? ''),
    company: String(row.companyName ?? row.company ?? ''),
    trade: String(row.trade ?? ''),
    submissionDate: String(row.submissionDate ?? row.createdAt ?? new Date().toISOString().split('T')[0]),
    status: (row.status as Subcontractor['status']) ?? 'pending',
    score: Number(row.score ?? 0),
    overallScore: Number(row.overallScore ?? row.score ?? 0),
    approvalDate: row.approval_date ? String(row.approval_date) : undefined,
    expiryDate: row.expiry_date ? String(row.expiry_date) : undefined,
    tier: (row.tier as Subcontractor['tier']) ?? undefined,
    contact: row.contactPerson ?? row.contact ? String(row.contactPerson ?? row.contact) : undefined,
    location: row.location ? String(row.location) : undefined,
    insurance: row.insurance ? String(row.insurance) : undefined,
  };
}

function mapToApiPayload(form: AppFormData): Row {
  return {
    company_name: form.company,
    trade: form.trade,
    contact: form.contact,
    location: form.location,
    insurance: form.insurance,
    status: 'pending',
    score: 0,
  } as unknown as Row;
}

export default function Prequalification() {
  const [activeTab, setActiveTab] = useState<TabId>('applications');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [scoringData, setScoringData] = useState<Record<string, number>>({});
  const [appForm, setAppForm] = useState<AppFormData>({
    company: '',
    trade: 'Groundworks',
    contact: '',
    location: '',
    insurance: '',
  });

  const { useList, useCreate, useUpdate, useDelete } = usePrequalification;
  const { data: apiData = [], isLoading } = useList() as { data: Row[]; isLoading: boolean };
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  // Map API rows to Subcontractor type
  const effectiveSubcontractors = useMemo(() => {
    if (apiData && apiData.length > 0) {
      return apiData.map(mapApiToSubcontractor);
    }
    return [];
  }, [apiData]);

  // Filter and search
  const filteredApplications = useMemo(
    () =>
      effectiveSubcontractors.filter((s) => {
        const matchesSearch =
          s.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.contact?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      }),
    [effectiveSubcontractors, searchTerm]
  );

  const approvedList = useMemo(
    () =>
      effectiveSubcontractors
        .filter((s) => s.status === 'approved')
        .filter((s) => !selectedTrade || s.trade === selectedTrade)
        .filter(
          (s) =>
            s.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.contact?.toLowerCase().includes(searchTerm.toLowerCase())
        ),
    [effectiveSubcontractors, searchTerm, selectedTrade]
  );

  const expiringList = useMemo(
    () =>
      effectiveSubcontractors
        .filter((s) => s.status === 'approved' && s.expiryDate)
        .filter((s) => {
          const expiryDate = new Date(s.expiryDate!);
          const daysUntilExpiry = Math.ceil(
            (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
        })
        .sort((a, b) => {
          const aExpiry = new Date(a.expiryDate!).getTime();
          const bExpiry = new Date(b.expiryDate!).getTime();
          return aExpiry - bExpiry;
        }),
    [effectiveSubcontractors]
  );

  const stats = useMemo((): Stats => {
    const approved = effectiveSubcontractors.filter((s) => s.status === 'approved').length;
    const avgScore =
      effectiveSubcontractors
        .filter((s) => s.status === 'approved' && s.score > 0)
        .reduce((sum, s) => sum + s.score, 0) /
        (effectiveSubcontractors.filter((s) => s.status === 'approved' && s.score > 0)
          .length || 1) || 0;
    const byTrade = TRADES.map((trade) => ({
      name: trade,
      value: effectiveSubcontractors.filter(
        (s) => s.status === 'approved' && s.trade === trade
      ).length,
    })).filter((t) => t.value > 0);

    const statusCounts = {
      pending: effectiveSubcontractors.filter((s) => s.status === 'pending').length,
      under_review: effectiveSubcontractors.filter((s) => s.status === 'under_review')
        .length,
      approved: approved,
      rejected: effectiveSubcontractors.filter((s) => s.status === 'rejected').length,
    };

    return { approved, avgScore, byTrade, statusCounts };
  }, [effectiveSubcontractors]);

  const calculateWeightedScore = (): number => {
    let totalScore = 0;
    let totalWeight = 0;
    SCORING_CRITERIA.forEach((criteria, index) => {
      const score = scoringData[index.toString()] || 3;
      totalScore += score * criteria.weight;
      totalWeight += criteria.weight;
    });
    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  };

  const handleAddApplication = () => {
    if (!appForm.company) return;
    const payload = mapToApiPayload(appForm);
    createMutation.mutate(payload as unknown as Parameters<typeof createMutation.mutate>[0], {
      onSuccess: () => {
        setShowApplicationModal(false);
        setAppForm({
          company: '',
          trade: 'Groundworks',
          contact: '',
          location: '',
          insurance: '',
        });
      },
    });
  };

  const handleStartAssessment = (sub: Subcontractor) => {
    setSelectedSubcontractor(sub);
    const initialScoring: Record<string, number> = {};
    SCORING_CRITERIA.forEach((c, i) => {
      initialScoring[i.toString()] = sub.score || 3;
    });
    setScoringData(initialScoring);
    setShowAssessmentModal(true);
  };

  const handleScoreChange = (index: string, value: number) => {
    setScoringData({
      ...scoringData,
      [index]: value,
    });
  };

  const handleSaveAssessment = () => {
    if (!selectedSubcontractor) return;
    const newScore = calculateWeightedScore();
    const status =
      newScore >= 80 ? 'approved' : newScore >= 60 ? 'under_review' : 'rejected';
    const now = new Date().toISOString().split('T')[0];
    const expiryDate =
      status === 'approved'
        ? new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        : null;

    updateMutation.mutate({
      id: selectedSubcontractor.id,
      data: {
        score: newScore,
        status,
        approval_date: status === 'approved' ? now : selectedSubcontractor.approvalDate || null,
        expiry_date: expiryDate,
      } as unknown as Row,
    });
    setShowAssessmentModal(false);
    setSelectedSubcontractor(null);
  };

  const handleExportReport = () => {
    const csv = [
      ['Company', 'Trade', 'Status', 'Score', 'Approval Date', 'Expiry Date'],
      ...approvedList.map((s) => [
        s.company,
        s.trade,
        s.status,
        s.score,
        s.approvalDate || '',
        s.expiryDate || '',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prequalification-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    deleteMutation.mutate(id);
  };

  const _getDaysUntilExpiry = (expiryDate: string): number => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const _getExpiryColor = (days: number): string => {
    if (days <= 30) return 'text-red-400 bg-red-500/10';
    if (days <= 60) return 'text-amber-400 bg-amber-500/10';
    return 'text-green-400 bg-green-500/10';
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'applications', label: 'Applications' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'approved', label: 'Approved List' },
    { id: 'expiring', label: 'Expiring Soon' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <>
      <ModuleBreadcrumbs currentModule="prequalification" />
      <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">
              Subcontractor Prequalification
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Manage and assess subcontractor applications
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowApplicationModal(true)}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            New Application
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-amber-500" />
            <span className="ml-3 text-gray-400">Loading prequalification data...</span>
          </div>
        ) : effectiveSubcontractors.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No prequalification applications yet.</p>
            <p className="text-gray-600 text-sm mt-2">Click "New Application" to get started.</p>
          </div>
        ) : (
          <>

        {/* Quick Stats */}
        <QuickStats stats={stats} expiringCount={expiringList.length} />

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700 cb-table-scroll touch-pan-x">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'applications' && (
            <ApplicationsTab
              applications={filteredApplications}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onStartAssessment={handleStartAssessment}
              onDelete={handleDelete}
            />
          )}

          {activeTab === 'assessment' && (
            <AssessmentTab
              selectedSubcontractor={selectedSubcontractor}
              scoringData={scoringData}
              criteria={SCORING_CRITERIA}
              onScoreChange={handleScoreChange}
              weightedScore={calculateWeightedScore()}
              onSave={handleSaveAssessment}
              onCancel={() => {
                setShowAssessmentModal(false);
                setSelectedSubcontractor(null);
              }}
            />
          )}

          {activeTab === 'approved' && (
            <ApprovedTab
              approvedList={approvedList}
              searchTerm={searchTerm}
              selectedTrade={selectedTrade}
              onSearchChange={setSearchTerm}
              onTradeChange={setSelectedTrade}
            />
          )}

          {activeTab === 'expiring' && (
            <ExpiringTab expiringList={expiringList} />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              stats={stats}
              approvedList={approvedList}
              totalSubcontractors={effectiveSubcontractors.length}
              onExport={handleExportReport}
            />
          )}
        </div>
          </>
        )}

        {/* New Application Modal */}
        <ModalWrapper
          isOpen={showApplicationModal}
          onClose={() => setShowApplicationModal(false)}
          title="New Application"
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1 font-semibold">
                Company Name *
              </label>
              <input
                type="text"
                value={appForm.company}
                onChange={(e) => setAppForm({ ...appForm, company: e.target.value })}
                placeholder="Company name"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1 font-semibold">
                Trade *
              </label>
              <select
                value={appForm.trade}
                onChange={(e) => setAppForm({ ...appForm, trade: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-amber-500"
              >
                {TRADES.map((trade) => (
                  <option key={trade} value={trade}>
                    {trade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1 font-semibold">
                Contact
              </label>
              <input
                type="text"
                value={appForm.contact}
                onChange={(e) => setAppForm({ ...appForm, contact: e.target.value })}
                placeholder="Contact name"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1 font-semibold">
                Location
              </label>
              <input
                type="text"
                value={appForm.location}
                onChange={(e) => setAppForm({ ...appForm, location: e.target.value })}
                placeholder="Location"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1 font-semibold">
                Insurance Cover
              </label>
              <input
                type="text"
                value={appForm.insurance}
                onChange={(e) => setAppForm({ ...appForm, insurance: e.target.value })}
                placeholder="e.g., £10M"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-800">
            <button
              onClick={() => setShowApplicationModal(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddApplication}
              disabled={!appForm.company || createMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Adding...
                </span>
              ) : (
                'Add Application'
              )}
            </button>
          </div>
        </ModalWrapper>

        {/* Assessment Modal */}
        <ModalWrapper
          isOpen={showAssessmentModal && !!selectedSubcontractor}
          onClose={() => {
            setShowAssessmentModal(false);
            setSelectedSubcontractor(null);
          }}
          title={selectedSubcontractor ? `Assessment - ${selectedSubcontractor.company}` : 'Assessment'}
          maxWidth="max-w-2xl"
        >
          {selectedSubcontractor && (
            <>
              <div className="p-6 space-y-4">
                <div className="bg-gray-700 rounded p-4 space-y-2">
                  <p className="text-gray-400 text-xs font-semibold">Trade</p>
                  <p className="text-white">{selectedSubcontractor.trade}</p>
                </div>

                {SCORING_CRITERIA.map((criteria, index) => (
                  <div key={index} className="bg-gray-700 rounded p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-white font-semibold">
                        {criteria.name}
                      </label>
                      <span className="text-gray-400 text-sm">
                        Weight: {criteria.weight}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={scoringData[index.toString()] || 3}
                        onChange={(e) =>
                          setScoringData({
                            ...scoringData,
                            [index.toString()]: parseInt(e.target.value),
                          })
                        }
                        className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-amber-400 font-bold w-8 text-right">
                        {scoringData[index.toString()] || 3}/5
                      </span>
                    </div>
                  </div>
                ))}

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1">Weighted Total Score</p>
                  <p className="text-3xl font-bold text-amber-400">
                    {calculateWeightedScore()}%
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-gray-800">
                <button
                  onClick={() => {
                    setShowAssessmentModal(false);
                    setSelectedSubcontractor(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssessment}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Save Assessment'
                  )}
                </button>
              </div>
            </>
          )}
        </ModalWrapper>
      </div>
    </>
  );
}
