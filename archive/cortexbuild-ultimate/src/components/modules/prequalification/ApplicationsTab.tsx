import { Search, Building2, Trash2 } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import type { Subcontractor } from './types';
import { StatusBadge } from './shared';

interface ApplicationsTabProps {
  applications: Subcontractor[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onStartAssessment: (sub: Subcontractor) => void;
  onDelete?: (id: string) => void;
}

export function ApplicationsTab({
  applications,
  searchTerm,
  onSearchChange,
  onStartAssessment,
  onDelete,
}: ApplicationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="cb-table-scroll touch-pan-x">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">
                  Company
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">
                  Trade
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">
                  Submission Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">
                  Score
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <EmptyState
                      icon={Building2}
                      title="No applications found"
                      description="No subcontractor applications match your search."
                      variant="documents"
                    />
                  </td>
                </tr>
              ) : (
                applications.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-gray-700/50 transition"
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{sub.company}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-sm">{sub.trade}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-sm">
                        {new Date(sub.submissionDate).toLocaleDateString('en-GB')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3">
                      {sub.score > 0 ? (
                        <p className="text-white font-semibold">{sub.score}%</p>
                      ) : (
                        <p className="text-gray-500">-</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onStartAssessment(sub)}
                          className="text-amber-400 hover:text-amber-300 text-sm font-medium transition"
                        >
                          Assess
                        </button>
                        {onDelete && (
                          <button
                            onClick={() => onDelete(sub.id)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
