import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import DashboardShell from "@/components/DashboardShell";
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
import { ArrowLeft, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// /issues/:id — detail + edit + delete for a single issue. Pairs with
// the issues.getById / update / delete tRPC procedures added in
// server/routers.ts.

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/10 text-green-400 border-green-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-500/10 text-red-400 border-red-500/30",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-400 border-green-500/30",
  closed: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

export default function IssueDetail() {
  const [, params] = useRoute("/issues/:id");
  const [, navigate] = useLocation();
  const issueId = params?.id ? Number(params.id) : NaN;

  const issueQuery = trpc.issues.getById.useQuery(
    { id: issueId },
    { enabled: Number.isFinite(issueId), retry: false }
  );
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    const issue = issueQuery.data;
    if (!issue) return;
    setStatus(issue.status ?? "open");
    setSeverity(issue.severity ?? "medium");
    setAssignedTo(issue.assignedTo ?? "");
    setLocation(issue.location ?? "");
  }, [issueQuery.data]);

  const updateMutation = trpc.issues.update.useMutation({
    onSuccess: () => {
      toast.success("Issue updated");
      setEditing(false);
      issueQuery.refetch();
      utils.issues.list.invalidate();
    },
    onError: err => toast.error(err.message ?? "Could not update issue"),
  });

  const deleteMutation = trpc.issues.delete.useMutation({
    onSuccess: () => {
      toast.success("Issue deleted");
      utils.issues.list.invalidate();
      navigate("/issues");
    },
    onError: err => toast.error(err.message ?? "Could not delete issue"),
  });

  if (issueQuery.isLoading) {
    return (
      <DashboardShell title="Issue detail">
        <div className="p-8 text-gray-400">Loading…</div>
      </DashboardShell>
    );
  }
  if (issueQuery.isError || !issueQuery.data) {
    return (
      <DashboardShell title="Issue detail">
        <div className="space-y-4 p-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/issues")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to issues
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              Issue not found, or you don&apos;t have access.
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const issue = issueQuery.data;

  return (
    <DashboardShell title="Issue detail">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/issues")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to issues
        </Button>

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">
            {issue.title ?? `Issue ${issue.id}`}
          </h1>
          <div className="flex gap-2">
            {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
            <Button
              variant="outline"
              onClick={() => {
                if (
                  window.confirm("Delete this issue? This cannot be undone.")
                ) {
                  deleteMutation.mutate({ id: issue.id });
                }
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            {editing ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  updateMutation.mutate({
                    id: issue.id,
                    status: status as any,
                    severity: severity as any,
                    assignedTo: assignedTo || undefined,
                    location: location || undefined,
                  });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium">
                      Severity
                    </label>
                    <Select value={severity} onValueChange={setSeverity}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">
                    Assigned to
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Location</label>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-1 h-4 w-4" /> Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={SEVERITY_STYLES[issue.severity] ?? ""}>
                    {issue.severity}
                  </Badge>
                  <Badge className={STATUS_STYLES[issue.status] ?? ""}>
                    {issue.status}
                  </Badge>
                </div>
                {issue.description && (
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Description
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">
                      {issue.description}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Assigned
                    </div>
                    <div className="mt-1">{issue.assignedTo ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Location
                    </div>
                    <div className="mt-1">{issue.location ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Created
                    </div>
                    <div className="mt-1">
                      {issue.createdAt
                        ? format(new Date(issue.createdAt), "PP p")
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-400">
                      Resolved
                    </div>
                    <div className="mt-1">
                      {issue.resolvedAt
                        ? format(new Date(issue.resolvedAt), "PP p")
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
