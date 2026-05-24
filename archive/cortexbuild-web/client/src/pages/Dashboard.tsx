import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  MessageSquare,
  AlertTriangle,
  Image,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Briefcase,
  ListChecks,
  DollarSign,
} from "lucide-react";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/10 text-green-400 border-green-500/30",
};

// Placeholder mini chart using simple SVG bars
function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-primary/60 hover:bg-primary transition-colors"
          style={{ height: `${(v / max) * 100}%` }}
          title={`Value: ${v}`}
        />
      ))}
    </div>
  );
}

function MiniLineChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 100;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        points={points}
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1 || 1)) * width;
        const y = height - ((v - min) / range) * height;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const kpiCards = [
    {
      label: "Projects",
      value: stats?.totalConversations ?? 12,
      icon: Briefcase,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Active Tasks",
      value: stats?.openIssues ?? 0,
      icon: ListChecks,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
    },
    {
      label: "Budget",
      value: `$${(stats?.totalReports ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
    },
    {
      label: "Issues",
      value: stats?.criticalIssues ?? 0,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
    },
  ];

  const statCards = [
    {
      label: "Conversations",
      value: stats?.totalConversations ?? 0,
      icon: MessageSquare,
      color: "text-blue-400",
    },
    {
      label: "Open Issues",
      value: stats?.openIssues ?? 0,
      icon: AlertTriangle,
      color: "text-orange-400",
    },
    {
      label: "Critical Issues",
      value: stats?.criticalIssues ?? 0,
      icon: XCircle,
      color: "text-red-400",
    },
    {
      label: "Site Images",
      value: stats?.totalImages ?? 0,
      icon: Image,
      color: "text-purple-400",
    },
    {
      label: "Analyzed Images",
      value: stats?.analyzedImages ?? 0,
      icon: TrendingUp,
      color: "text-green-400",
    },
    {
      label: "Reports Generated",
      value: stats?.totalReports ?? 0,
      icon: FileText,
      color: "text-primary",
    },
  ];

  return (
    <DashboardShell title="Dashboard" subtitle="Construction site overview">
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-card rounded-xl animate-pulse border border-border"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.label}
                  className={`${card.bg} border bg-transparent`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        {card.label}
                      </span>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className={`text-3xl font-bold ${card.color}`}>
                      {card.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts Placeholder Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Budget Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={[30, 45, 60, 55, 70, 85, 72]} />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  Progress Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MiniLineChart data={[20, 35, 30, 55, 60, 75, 82]} />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                  <span>Week 1</span>
                  <span>Week 2</span>
                  <span>Week 3</span>
                  <span>Week 4</span>
                  <span>Week 5</span>
                  <span>Week 6</span>
                  <span>Week 7</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        {card.label}
                      </span>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className={`text-3xl font-bold ${card.color}`}>
                      {card.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Bottom Row - Activity + Upcoming */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.recentIssues?.length === 0 && (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    No recent activity
                  </div>
                )}
                {stats?.recentIssues?.map((issue) => (
                  <div key={issue.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {issue.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {issue.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${SEVERITY_COLOR[issue.severity]}`}
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                <Link href="/issues">
                  <p className="text-xs text-primary hover:underline cursor-pointer pt-1">
                    View all →
                  </p>
                </Link>
              </CardContent>
            </Card>

            {/* Upcoming Tasks */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-green-400" />
                  Upcoming Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Site safety inspection
                    </p>
                    <p className="text-xs text-muted-foreground">Due in 2 days</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    In progress
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Review subcontractor bid
                    </p>
                    <p className="text-xs text-muted-foreground">Due in 4 days</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Pending
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Concrete pour - East Wing
                    </p>
                    <p className="text-xs text-muted-foreground">Due in 6 days</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Scheduled
                  </Badge>
                </div>
                <Link href="/tasks">
                  <p className="text-xs text-primary hover:underline cursor-pointer pt-1">
                    View all →
                  </p>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Issues */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                  Recent Issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.recentIssues?.length === 0 && (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    No issues detected yet
                  </div>
                )}
                {stats?.recentIssues?.map((issue) => (
                  <Link key={issue.id} href="/issues">
                    <div
                      className={`p-3 rounded-lg border cursor-pointer hover:border-primary/40 transition-colors ${SEVERITY_COLOR[issue.severity] ?? ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground line-clamp-1">
                          {issue.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${SEVERITY_COLOR[issue.severity]}`}
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {issue.description}
                      </p>
                    </div>
                  </Link>
                ))}
                <Link href="/issues">
                  <p className="text-xs text-primary hover:underline cursor-pointer pt-1">
                    View all issues →
                  </p>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Images */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Image className="w-4 h-4 text-purple-400" />
                  Recent Site Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.recentMedia?.length === 0 && (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                    <Clock className="w-4 h-4" />
                    No images received yet
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {stats?.recentMedia?.map((m) => (
                    <Link key={m.id} href="/gallery">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity border border-border">
                        <img
                          src={m.s3Url}
                          alt={m.visionDescription ?? "Site image"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/gallery">
                  <p className="text-xs text-primary hover:underline cursor-pointer pt-3">
                    View all images →
                  </p>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/reports">
                <div className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg px-4 py-2 cursor-pointer transition-colors">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">
                    Generate Report
                  </span>
                </div>
              </Link>
              <Link href="/conversations">
                <div className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg px-4 py-2 cursor-pointer transition-colors">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400 font-medium">
                    View Conversations
                  </span>
                </div>
              </Link>
              <Link href="/settings">
                <div className="flex items-center gap-2 bg-muted hover:bg-muted/80 border border-border rounded-lg px-4 py-2 cursor-pointer transition-colors">
                  <span className="text-sm text-muted-foreground font-medium">
                    Configure WhatsApp
                  </span>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
