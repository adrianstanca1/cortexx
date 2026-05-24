import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import DashboardShell from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function ProjectEdit() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const projectId = Number(id);

  const { data: project, isLoading } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: !isNaN(projectId) }
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [client, setClient] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  const [location, setLocation] = useState("");
  const [manager, setManager] = useState("");
  const [progress, setProgress] = useState("");
  const [spent, setSpent] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setClient(project.client || "");
      setBudget(project.budget?.toString() || "");
      setStartDate(project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "");
      setEndDate(project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "");
      setStatus(project.status);
      setLocation(project.location || "");
      setManager(project.manager || "");
      setProgress(project.progress?.toString() || "");
      setSpent(project.spent?.toString() || "");
    }
  }, [project]);

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated successfully.");
      utils.projects.list.invalidate();
      utils.projects.get.invalidate({ id: projectId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted.");
      utils.projects.list.invalidate();
      setTimeout(() => {
        window.location.href = "/projects";
      }, 500);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProject.mutate({
      id: projectId,
      name,
      description: description || undefined,
      client: client || undefined,
      budget: budget ? Number(budget) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: status as "active" | "planning" | "on-hold" | "completed",
      location: location || undefined,
      manager: manager || undefined,
      progress: progress ? Number(progress) : undefined,
      spent: spent ? Number(spent) : undefined,
    });
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      deleteProject.mutate({ id: projectId });
    }
  };

  if (isLoading) {
    return (
      <DashboardShell title="Edit Project" subtitle="Loading...">
        <div className="h-40 bg-card rounded-xl animate-pulse border border-border" />
      </DashboardShell>
    );
  }

  if (!project) {
    return (
      <DashboardShell title="Edit Project" subtitle="Project not found">
        <p className="text-muted-foreground text-sm">The requested project could not be found.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Edit Project" subtitle={project.name}>
      <div className="max-w-2xl">
        <Link href="/projects">
          <div className="inline-flex items-center gap-2 text-xs text-primary hover:underline cursor-pointer mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </div>
        </Link>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-foreground">Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-muted-foreground">Project Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm text-muted-foreground">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-input border-border" rows={3} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client" className="text-sm text-muted-foreground">Client</Label>
                  <Input id="client" value={client} onChange={(e) => setClient(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-sm text-muted-foreground">Budget</Label>
                  <Input id="budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm text-muted-foreground">Start Date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm text-muted-foreground">End Date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="progress" className="text-sm text-muted-foreground">Progress (%)</Label>
                  <Input id="progress" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spent" className="text-sm text-muted-foreground">Spent</Label>
                  <Input id="spent" type="number" value={spent} onChange={(e) => setSpent(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm text-muted-foreground">Location</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="bg-input border-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager" className="text-sm text-muted-foreground">Project Manager</Label>
                  <Input id="manager" value={manager} onChange={(e) => setManager(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={updateProject.isPending}>{updateProject.isPending ? "Saving..." : "Save Changes"}</Button>
                  <Link href="/projects"><Button variant="outline" className="border-border">Cancel</Button></Link>
                </div>
                <Button type="button" variant="destructive" size="sm" className="gap-2" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
