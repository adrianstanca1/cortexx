import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { API_BASE } from '../../lib/auth-storage';

interface SafetyTrendData {
  date: string;
  incidents: number;
  nearMisses: number;
  injuries: number;
}

interface SafetyTrendChartProps {
  projectId?: string;
  days?: number;
  height?: number;
  showNearMisses?: boolean;
  showInjuries?: boolean;
}

export default function SafetyTrendChart({
  projectId,
  days = 90,
  height = 300,
  showNearMisses = true,
  showInjuries = true,
}: SafetyTrendChartProps) {
  const [data, setData] = useState<SafetyTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const url = `${API_BASE}/analytics?action=safety-trends&days=${days}${projectId ? `&projectId=${projectId}` : ''}`;
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch safety trends');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-pulse text-gray-500">Loading safety data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center text-red-500" style={{ height }}>
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500" style={{ height }}>
        No safety data available
      </div>
    );
  }

  const totalIncidents = data.reduce((sum, d) => sum + d.incidents, 0);
  const totalNearMisses = data.reduce((sum, d) => sum + d.nearMisses, 0);
  const totalInjuries = data.reduce((sum, d) => sum + d.injuries, 0);

  const recentData = data.slice(-30);
  const hasRecentIncidents = recentData.some(d => d.incidents > 0 || d.nearMisses > 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Incidents ({totalIncidents})</span>
        </div>
        {showNearMisses && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Near Misses ({totalNearMisses})</span>
          </div>
        )}
        {showInjuries && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Injuries ({totalInjuries})</span>
          </div>
        )}
      </div>

      {hasRecentIncidents && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Recent safety incidents detected. Review required.
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNearMisses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorInjuries" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), 'MMM d')}
            stroke="#6b7280"
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            allowDecimals={false}
          />
          <Tooltip
            labelFormatter={(label) => format(new Date(label), 'MMMM d, yyyy')}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="incidents"
            name="Incidents"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorIncidents)"
          />
          {showNearMisses && (
            <Area
              type="monotone"
              dataKey="nearMisses"
              name="Near Misses"
              stroke="#eab308"
              fillOpacity={1}
              fill="url(#colorNearMisses)"
            />
          )}
          {showInjuries && (
            <Area
              type="monotone"
              dataKey="injuries"
              name="Injuries"
              stroke="#f97316"
              fillOpacity={1}
              fill="url(#colorInjuries)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
