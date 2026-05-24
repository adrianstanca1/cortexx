import DashboardShell from "@/components/DashboardShell";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { AlertTriangle, CheckCircle, Clock, MapPin, Bot } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/10 text-green-400 border-green-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-500/10 text-red-400 border-red-500/30",
  in_progress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  resolved: "bg-green-500/10 text-green-400 border-green-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function IssueTracker() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const {
    data: issues,
    isLoading,
    refetch,
  } = trpc.issues.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
    limit: 100,
  });

  const updateIssue = trpc.issues.update.useMutation({
    onSuccess: () => {
      toast.success("Issue updated");
      refetch();
    },
    onError: () => toast.error("Failed to update issue"),
  });

  return (
    <DashboardShell
      title="Issue Tracker"
      subtitle="Construction issues detected from chat and images"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-card border-border text-foreground">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40 bg-card border-border text-foreground">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-card rounded-xl animate-pulse border border-border"
              />
            ))}
          </div>
        ) : issues?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No issues found
            </h3>
            <p className="text-sm text-muted-foreground">
              Issues detected from WhatsApp messages and images will appear
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues?.map(issue => (
              <Card
                key={issue.id}
                className={`bg-card border-border ${issue.severity === "critical" ? "border-l-4 border-l-red-500" : issue.severity === "high" ? "border-l-4 border-l-orange-500" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <AlertTriangle
                      className={`w-5 h-5 mt-0.5 shrink-0 ${issue.severity === "critical" ? "text-red-400" : issue.severity === "high" ? "text-orange-400" : "text-yellow-400"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-foreground text-sm">
                          <Link
                            href={`/issues/${issue.id}`}
                            className="hover:underline"
                          >
                            {issue.title}
                          </Link>
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-xs ${SEVERITY_STYLES[issue.severity]}`}
                          >
                            {issue.severity}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUS_STYLES[issue.status]}`}
                          >
                            {issue.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {issue.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(issue.createdAt), "MMM d, yyyy")}
                        </span>
                        {issue.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {issue.location}
                          </span>
                        )}
                        {issue.aiDetected && (
                          <span className="flex items-center gap-1 text-primary">
                            <Bot className="w-3 h-3" />
                            AI detected (
                            {Math.round((issue.aiConfidence ?? 0) * 100)}%)
                          </span>
                        )}
                        <span className="capitalize">
                          {issue.category.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    {/* Quick status update */}
                    {issue.status !== "resolved" &&
                      issue.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-green-400 border-green-400/30 hover:bg-green-500/10"
                          onClick={() =>
                            updateIssue.mutate({
                              id: issue.id,
                              status: "resolved",
                            })
                          }
                          disabled={updateIssue.isPending}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Resolve
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
