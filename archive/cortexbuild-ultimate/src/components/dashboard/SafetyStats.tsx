import React from 'react';
import { AlertTriangle, TrendingUp, Shield, Activity, Users } from 'lucide-react';

interface SafetyStatsProps {
  stats: {
    totalIncidents: number;
    openIncidents: number;
    resolvedIncidents: number;
    daysSinceLastIncident: number;
    safetyScore: number;
    toolboxTalksCompleted: number;
    toolboxTalksTotal: number;
    toolChecksPassed: number;
    toolChecksTotal: number;
    activeWorkers: number;
    incidentsBySeverity?: {
      LOW: number;
      MEDIUM: number;
      HIGH: number;
      CRITICAL: number;
    };
  };
}

const severityColors: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-200 text-red-900',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-gray-700">{children}</h3>;
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 overflow-hidden ${className}`}>
      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function Badge({ children, variant = 'secondary' }: { children: React.ReactNode; variant?: string }) {
  const variants: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    secondary: 'bg-gray-100 text-gray-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800',
  };
  return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variants[variant] || variants.secondary}`}>{children}</span>;
}

export function SafetyStats({ stats }: SafetyStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Safety Score</CardTitle>
          <Shield className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.safetyScore}%</div>
          <Progress value={stats.safetyScore} className="mt-2" />
          <p className="text-xs text-gray-500 mt-2">
            {stats.safetyScore >= 90 ? 'Excellent' : stats.safetyScore >= 75 ? 'Good' : 'Needs Improvement'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Days Without Incident</CardTitle>
          <TrendingUp className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.daysSinceLastIncident}</div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.daysSinceLastIncident > 30 ? 'Great safety record!' : 'Keep up the good work'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Incidents</CardTitle>
          <AlertTriangle className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.openIncidents}</div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="success">{stats.resolvedIncidents} resolved</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            of {stats.totalIncidents} total incidents
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Workers</CardTitle>
          <Users className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeWorkers}</div>
          <p className="text-xs text-gray-500 mt-2">On site today</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toolbox Talks</CardTitle>
          <Activity className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.toolboxTalksCompleted}/{stats.toolboxTalksTotal}
          </div>
          <Progress
            value={(stats.toolboxTalksCompleted / stats.toolboxTalksTotal) * 100}
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tool Checks</CardTitle>
          <Shield className="h-4 w-4 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.toolChecksPassed}/{stats.toolChecksTotal}
          </div>
          <Progress
            value={(stats.toolChecksPassed / stats.toolChecksTotal) * 100}
            className="mt-2"
          />
          <p className="text-xs text-gray-500 mt-2">
            {((stats.toolChecksPassed / stats.toolChecksTotal) * 100).toFixed(0)}% pass rate
          </p>
        </CardContent>
      </Card>

      {stats.incidentsBySeverity && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Incidents by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {Object.entries(stats.incidentsBySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center gap-2">
                  <Badge variant={severityColors[severity] ? 'secondary' : 'secondary'}>
                    {severity}
                  </Badge>
                  <span className="text-lg font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
