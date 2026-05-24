import { Bell, Clock } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import type { Subcontractor } from './types';
import { getDaysUntilExpiry, getExpiryColor } from './shared';

interface ExpiringTabProps {
  expiringList: Subcontractor[];
}

export function ExpiringTab({ expiringList }: ExpiringTabProps) {
  if (expiringList.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
        <EmptyState
          icon={Clock}
          title="No expiring prequalifications"
          description="No subcontractors are expiring within the next 90 days"
          variant="documents"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expiringList.map((sub) => {
        const daysLeft = getDaysUntilExpiry(sub.expiryDate!);
        return (
          <div
            key={sub.id}
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex-1">
              <h4 className="text-white font-bold">{sub.company}</h4>
              <p className="text-gray-400 text-sm">{sub.trade}</p>
              <p className="text-gray-500 text-xs mt-1">
                Expires:{' '}
                {new Date(sub.expiryDate!).toLocaleDateString('en-GB')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`px-3 py-2 rounded-lg text-center font-bold ${getExpiryColor(daysLeft)}`}
              >
                <p>{daysLeft} days</p>
              </div>
              <button
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                title="Send reminder email"
              >
                <Bell className="w-4 h-4" />
                Remind
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
