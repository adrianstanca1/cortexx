import React from 'react';
import { Calendar, MapPin, Users, DollarSign } from 'lucide-react';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
    location?: string;
    clientName?: string;
    budget?: number;
    startDate?: string;
    endDate?: string;
    progress?: number;
    teamSize?: number;
    taskCount?: { total: number; completed: number };
  };
  onClick?: () => void;
  onEdit?: () => void;
}

const statusColors: Record<string, string> = {
  PLANNING: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      className={`bg-white rounded-lg shadow border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 border-b border-gray-100">{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-gray-900">{children}</h3>;
}

function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600 line-clamp-2 mt-1">{children}</p>;
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4 space-y-4">{children}</div>;
}

function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 border-t border-gray-100">{children}</div>;
}

function Badge({ children, variant }: { children: React.ReactNode; variant?: string }) {
  const variantClass = variant ? statusColors[variant] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClass}`}>{children}</span>;
}

function Progress({ value }: { value: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function Button({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function ProjectCard({ project, onClick, onEdit }: ProjectCardProps) {
  return (
    <Card onClick={onClick}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle>{project.name}</CardTitle>
            {project.description && <CardDescription>{project.description}</CardDescription>}
          </div>
          <Badge variant={project.status}>{statusLabels[project.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {project.progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{project.progress}%</span>
            </div>
            <Progress value={project.progress} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {project.location && (
            <div className="flex items-center text-gray-600">
              <MapPin className="h-4 w-4 mr-2" />
              <span className="truncate">{project.location}</span>
            </div>
          )}
          {project.budget && (
            <div className="flex items-center text-gray-600">
              <DollarSign className="h-4 w-4 mr-2" />
              <span>{(project.budget / 1000).toFixed(0)}K</span>
            </div>
          )}
          {project.startDate && (
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              <span>{new Date(project.startDate).toLocaleDateString()}</span>
            </div>
          )}
          {project.teamSize !== undefined && (
            <div className="flex items-center text-gray-600">
              <Users className="h-4 w-4 mr-2" />
              <span>{project.teamSize} team</span>
            </div>
          )}
        </div>

        {project.taskCount && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tasks</span>
              <span className="font-medium">
                {project.taskCount.completed}/{project.taskCount.total} completed
              </span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="w-full"
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
