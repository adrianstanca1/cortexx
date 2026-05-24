import { Search, CheckCircle } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import type { Subcontractor } from './types';
import { TierBadge, TRADES } from './shared';

interface ApprovedTabProps {
  approvedList: Subcontractor[];
  searchTerm: string;
  selectedTrade: string;
  onSearchChange: (term: string) => void;
  onTradeChange: (trade: string) => void;
}

export function ApprovedTab({
  approvedList,
  searchTerm,
  selectedTrade,
  onSearchChange,
  onTradeChange,
}: ApprovedTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search approved subcontractors..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
          <select
            value={selectedTrade}
            onChange={(e) => onTradeChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">All Trades</option>
            {TRADES.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
        </div>

        {approvedList.length === 0 ? (
          <div className="py-12 text-center">
            <EmptyState
              icon={CheckCircle}
              title="No approved subcontractors"
              description="No subcontractors match your filters"
              variant="documents"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedList.map((sub) => (
              <div
                key={sub.id}
                className="bg-gray-700 rounded-lg p-4 space-y-3 border border-gray-600"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-bold">{sub.company}</h4>
                    <p className="text-gray-400 text-sm">{sub.trade}</p>
                  </div>
                  {sub.tier && <TierBadge tier={sub.tier} />}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Score</p>
                    <p className="text-amber-400 font-bold">{sub.score}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Contact</p>
                    <p className="text-white">{sub.contact}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Location</p>
                    <p className="text-white">{sub.location}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Insurance</p>
                    <p className="text-white">{sub.insurance}</p>
                  </div>
                </div>

                {sub.expiryDate && (
                  <div className="pt-2 border-t border-gray-600">
                    <p className="text-gray-500 text-xs">
                      Expires:{' '}
                      {new Date(sub.expiryDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
