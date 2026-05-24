import { CloudRain, Sun, Wind, Cloud, CloudSnow, CloudFog, CloudLightning, AlertTriangle } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Report data from the generic CRUD router.
 * apiFetch camelizes all responses, so runtime keys are camelCase (e.g., projectId, reportDate).
 * Using AnyRow matches the parent component's convention.
 */
type AnyRow = Record<string, unknown>;

type WeatherWidgetProps = {
  reports: AnyRow[];
  projectFilter: string;
  isLoading?: boolean;
  error?: string | null;
};

function WeatherIcon({ weather }: { weather: string }) {
  if (!weather) return <span className="text-xs text-gray-500">--</span>;
  const w = weather.toLowerCase();
  if (w.includes('rain') || w.includes('drizzle') || w.includes('shower')) return <CloudRain size={16} className="text-blue-400" />;
  if (w.includes('sun') || w.includes('clear')) return <Sun size={16} className="text-yellow-400" />;
  if (w.includes('wind') || w.includes('gale')) return <Wind size={16} className="text-gray-400" />;
  if (w.includes('snow') || w.includes('frost') || w.includes('ice')) return <CloudSnow size={16} className="text-blue-200" />;
  if (w.includes('fog') || w.includes('mist')) return <CloudFog size={16} className="text-gray-300" />;
  if (w.includes('thunder') || w.includes('storm')) return <CloudLightning size={16} className="text-purple-400" />;
  return <Cloud size={16} className="text-gray-400" />;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  return !isNaN(new Date(value).getTime());
}

export function WeatherWidget({ reports, projectFilter, isLoading, error }: WeatherWidgetProps) {
  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl border border-red-500/30 p-8 text-center text-red-400" role="alert">
        <Cloud size={32} className="mx-auto text-red-400 mb-3" />
        Failed to load weather data: {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-pulse h-80" />
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-pulse h-40" />
      </div>
    );
  }

  const safeReports = reports ?? [];
  const filtered = safeReports.filter(r => !projectFilter || String(r.projectId ?? '') === projectFilter);

  if (filtered.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <Cloud size={32} className="mx-auto text-gray-500 mb-3" />
        <p className="text-gray-400">No weather data available for the selected filters.</p>
      </div>
    );
  }

  const last14 = [...filtered]
    .filter(r => isValidDate(r.reportDate))
    .sort((a, b) => {
      const aDate = new Date(String(a.reportDate)).getTime();
      const bDate = new Date(String(b.reportDate)).getTime();
      return aDate - bDate;
    })
    .slice(-14);

  const chartData = last14.map(r => ({
    date: String(r.reportDate ?? '').slice(-5),
    temp: r.temperature !== null && r.temperature !== undefined && r.temperature !== '' ? Number(r.temperature) : null,
  }));

  const sunnyCount = filtered.filter(r => String(r.weather ?? '').toLowerCase().includes('sunny')).length;
  const rainyCount = filtered.filter(r => String(r.weather ?? '').toLowerCase().includes('rain')).length;
  const delayCount = filtered.filter(r => String(r.issuesDelays ?? '').toLowerCase().includes('weather')).length;

  return (
    <>
      {/* Temperature Trend */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Temperature Trend (Last 14 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af' }} />
            <YAxis tick={{ fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Weather Grid */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Weather (Last 14 Days)</h3>
        <div className="grid grid-cols-7 gap-3">
          {last14.map(r => {
            const hasWeatherDelay = String(r.issuesDelays ?? '').toLowerCase().includes('weather');
            return (
              <div key={String(r.id)} className="bg-gray-700/50 rounded-lg p-3 border border-gray-700 text-center">
                <p className="text-xs text-gray-400 mb-2">
                  {(r.reportDate) ? String(r.reportDate).slice(-5) : 'N/A'}
                </p>
                <div className="flex justify-center mb-2">
                  <WeatherIcon weather={String(r.weather ?? '')} />
                </div>
                <p className="text-xs text-gray-300 font-medium">
                  {r.temperature !== null && r.temperature !== undefined && r.temperature !== '' ? `${Number(r.temperature)}°C` : '--°C'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {hasWeatherDelay
                    ? <AlertTriangle size={12} className="inline text-orange-400" />
                    : <Cloud size={12} className="inline text-gray-500" />
                  }
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weather Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sunny Days</p>
          <p className="text-2xl font-bold text-yellow-400">{sunnyCount}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Rainy Days</p>
          <p className="text-2xl font-bold text-blue-400">{rainyCount}</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Weather Delays</p>
          <p className="text-2xl font-bold text-orange-400">{delayCount}</p>
        </div>
      </div>
    </>
  );
}