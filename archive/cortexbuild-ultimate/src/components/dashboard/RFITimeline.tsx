import React from 'react';
import { User, Clock, MessageSquare } from 'lucide-react';

interface RFI {
  id: string;
  number: string;
  title: string;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  dueDate?: string;
  createdAt: string;
  createdBy?: { name: string };
  assignedTo?: { name: string };
  answerCount?: number;
}

interface RFITimelineProps {
  rfis: RFI[];
  onRFIClick?: (rfi: RFI) => void;
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ANSWERED: 'bg-blue-100 text-blue-800 border-blue-300',
  CLOSED: 'bg-green-100 text-green-800 border-green-300',
};

const statusDotColors: Record<string, string> = {
  OPEN: 'bg-yellow-400 border-yellow-500',
  ANSWERED: 'bg-blue-400 border-blue-500',
  CLOSED: 'bg-green-400 border-green-500',
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg shadow border border-gray-200">{children}</div>;
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 border-b border-gray-100">{children}</div>;
}

function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>;
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>;
}

function Badge({ children, variant }: { children: React.ReactNode; variant?: string }) {
  const variantClass = variant && statusColors[variant] ? statusColors[variant] : 'bg-gray-100 text-gray-800 border-gray-300';
  return <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${variantClass}`}>{children}</span>;
}

export function RFITimeline({ rfis, onRFIClick }: RFITimelineProps) {
  const sortedRFIs = [...rfis].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">RFI Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300" />
          <div className="space-y-6">
            {sortedRFIs.map((rfi) => (
              <div
                key={rfi.id}
                className="relative pl-10 cursor-pointer group"
                onClick={() => onRFIClick?.(rfi)}
              >
                <div
                  className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 ${
                    statusDotColors[rfi.status] || 'bg-gray-400 border-gray-500'
                  }`}
                />
                <div className="group-hover:bg-gray-50 -ml-2 pl-2 pr-3 py-3 rounded-lg transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-600">{rfi.number}</span>
                        <Badge variant={rfi.status}>{rfi.status}</Badge>
                      </div>
                      <p className="font-medium mt-1 group-hover:text-blue-600 transition-colors text-gray-900">{rfi.title}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-600">
                    {rfi.createdBy && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {rfi.createdBy.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(rfi.createdAt).toLocaleDateString()}
                    </span>
                    {rfi.dueDate && (
                      <span className="flex items-center gap-1">
                        Due: {new Date(rfi.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    {rfi.answerCount !== undefined && rfi.answerCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {rfi.answerCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sortedRFIs.length === 0 && (
            <p className="text-center text-gray-500 py-8">No RFIs found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
