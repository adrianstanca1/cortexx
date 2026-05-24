import { Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Subcontractor, Stats, TradeCount } from './types';

interface ReportsTabProps {
  stats: Stats;
  approvedList: Subcontractor[];
  totalSubcontractors: number;
  onExport: () => void;
}

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'];

export function ReportsTab({
  stats,
  approvedList: _approvedList,
  totalSubcontractors,
  onExport,
}: ReportsTabProps) {
  const pieData = [
    { name: 'Pending', value: stats.statusCounts.pending },
    { name: 'Under Review', value: stats.statusCounts.under_review },
    { name: 'Approved', value: stats.statusCounts.approved },
    { name: 'Rejected', value: stats.statusCounts.rejected },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-xs font-semibold mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-400">{stats.approved}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-xs font-semibold mb-1">Avg Score</p>
            <p className="text-3xl font-bold text-amber-400">
              {Math.round(stats.avgScore)}%
            </p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-xs font-semibold mb-1">Total</p>
            <p className="text-3xl font-bold text-blue-400">{totalSubcontractors}</p>
          </div>
        </div>

        {/* By Trade */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-white font-bold mb-4">Approved by Trade</h3>
          <div className="space-y-2">
            {stats.byTrade.length === 0 ? (
              <p className="text-gray-500">No approved subcontractors</p>
            ) : (
              stats.byTrade.map((trade: TradeCount) => (
                <div key={trade.name} className="flex items-center justify-between">
                  <p className="text-gray-300">{trade.name}</p>
                  <p className="text-white font-semibold">{trade.value}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-white font-bold mb-4">Status Distribution</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-12">No data available</p>
        )}
      </div>

      {/* Export */}
      <div className="lg:col-span-3">
        <button
          onClick={onExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition"
        >
          <Download className="w-4 h-4" />
          Export Report as CSV
        </button>
      </div>
    </div>
  );
}
