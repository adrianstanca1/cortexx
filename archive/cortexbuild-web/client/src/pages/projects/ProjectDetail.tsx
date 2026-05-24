import { useParams, Link } from "wouter";
import DashboardShell from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Briefcase, DollarSign, Calendar, Clock, MapPin, User, Edit, ArrowLeft } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/30",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "on-hold": "bg-orange-500/10 text-orange-400 border-orange-500/30",
  planning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const { data: project, isLoading } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: !isNaN(projectId) }
  );

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
  };

  const formatBudget = (budget: number | null) => {
    if (!budget) return "—";
    return `£${budget.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <DashboardShell title="Project Detail" subtitle="Loading...">
        <div className="space-y-4">
          <div className="h-24 bg-card rounded-xl animate-pulse border border-border" />
          <div className="h-64 bg-card rounded-xl animate-pulse border border-border" />
        </div>
      </DashboardShell>
    );
  }

  if (!project) {
    return (
      <DashboardShell title="Project Detail" subtitle="Not found">
        <p className="text-muted-foreground text-sm">The requested project could not be found.</p>
      </DashboardShell>
    );
  }

  const remaining = (project.budget ?? 0) - (project.spent ?? 0);
  const spendRate = project.budget ? ((project.spent ?? 0) / project.budget) * 100 : 0;

  return (
    <DashboardShell title={project.name} subtitle="Project overview, budget, and details">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/projects">
            <div className="inline-flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </div>
          </Link>
          <Link href={`/projects/${project.id}/edit`}>
            <Button size="sm" variant="outline" className="gap-2 border-border">
              <Edit className="w-4 h-4" />
              Edit Project
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Status</span>
                <Briefcase className="w-4 h-4 text-primary" />
              </div>
              <Badge variant="outline" className={`text-xs ${STATUS_COLOR[project.status]}`}>
                {project.status}
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Budget</span>
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">{formatBudget(project.budget)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Progress</span>
                <Calendar className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex items-center gap-2">
                <Progress value={project.progress} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">{project.progress}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Due Date</span>
                <Clock className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">{formatDate(project.endDate)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="border border-border bg-card">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground">Project Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm text-foreground">{project.description || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="text-sm text-foreground">{project.client || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm text-foreground">{project.location || "—"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm text-foreground">{project.manager || "—"}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="text-sm text-foreground">{formatDate(project.startDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm text-foreground">{formatDate(project.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budget">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-foreground">Budget Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Budget</p>
                    <p className="text-lg font-bold text-foreground">{formatBudget(project.budget)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="text-lg font-bold text-red-400">{formatBudget(project.spent)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="text-lg font-bold text-green-400">{formatBudget(remaining)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Spend Rate</p>
                  <Progress value={spendRate} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{Math.round(spendRate)}%</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
