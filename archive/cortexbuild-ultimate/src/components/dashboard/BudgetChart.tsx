import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface BudgetData {
  date: string;
  planned: number;
  actual: number;
  cumulativePlanned: number;
  cumulativeActual: number;
}

interface BudgetChartProps {
  projectId: string;
  months?: number;
  height?: number;
}

export default function BudgetChart({ projectId, months = 12, height = 300 }: BudgetChartProps) {
  const [data, setData] = useState<BudgetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/analytics?action=budget-trends&projectId=${projectId}&months=${months}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch budget data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId, months]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-pulse text-gray-500">Loading budget data...</div>
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
        No budget data available
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => format(new Date(value + '-01'), 'MMM yy')}
          stroke="#6b7280"
          fontSize={12}
        />
        <YAxis
          tickFormatter={formatCurrency}
          stroke="#6b7280"
          fontSize={12}
        />
        <Tooltip
          formatter={(value) => formatCurrency(value as number)}
          labelFormatter={(label) => format(new Date(label + '-01'), 'MMMM yyyy')}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px',
          }}
        />
        <Legend />
        <ReferenceLine y={0} stroke="#9ca3af" />
        <Bar
          dataKey="cumulativePlanned"
          name="Planned"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="cumulativeActual"
          name="Actual"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
