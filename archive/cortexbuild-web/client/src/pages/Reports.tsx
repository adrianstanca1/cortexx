import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FileText, Download, Send, Plus, Loader2, ExternalLink, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Reports() {
  const { data: reports, isLoading, refetch } = trpc.reports.list.useQuery({ limit: 50 });
  const { data: schedules } = trpc.scheduledReports.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("Weekly Construction Report");
  const [reportType, setReportType] = useState<"daily_summary" | "weekly_summary" | "issue_report" | "custom">("weekly_summary");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [projectTag, setProjectTag] = useState("");

  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: () => {
      toast.success("Report generated successfully!");
      setShowForm(false);
      refetch();
    },
    onError: () => toast.error("Failed to generate report"),
  });

  const sendNotification = trpc.reports.sendNotification.useMutation({
    onSuccess: () => toast.success("Notification sent to owner"),
    onError: () => toast.error("Failed to send notification"),
  });

  return (
    <DashboardShell title="Reports" subtitle="Generate and manage construction site reports">
      <div className="space-y-6">
        {/* Generate Report */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Generate New Report
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "Cancel" : "New Report"}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Report Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Report Type</Label>
                  <Select value={reportType} onValueChange={(v) => setReportType(v as any)}>
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="daily_summary">Daily Summary</SelectItem>
                      <SelectItem value="weekly_summary">Weekly Summary</SelectItem>
                      <SelectItem value="issue_report">Issue Report</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Date</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Date</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Project Tag (optional)</Label>
                  <Input
                    value={projectTag}
                    onChange={(e) => setProjectTag(e.target.value)}
                    placeholder="e.g. Site-A, Block-3"
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </div>
              <Button
                onClick={() => generateReport.mutate({ title, reportType, dateFrom, dateTo, projectTag: projectTag || undefined })}
                disabled={generateReport.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {generateReport.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Generate Report</>
                )}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Reports List */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Generated Reports</h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-border" />
              ))}
            </div>
          ) : reports?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-xl">
              <FileText className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No reports generated yet. Create your first report above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports?.map((report) => (
                <Card key={report.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{report.title}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(report.createdAt), "MMM d, yyyy")}
                          </span>
                          <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                            {report.reportType.replace("_", " ")}
                          </Badge>
                          {report.sentToWhatsapp && (
                            <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">WhatsApp sent</Badge>
                          )}
                          {report.sentToEmail && (
                            <Badge variant="outline" className="text-xs text-blue-400 border-blue-400/30">Email sent</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {report.htmlS3Url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border text-foreground hover:bg-muted"
                            onClick={() => window.open(report.htmlS3Url!, "_blank")}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            HTML
                          </Button>
                        )}
                        {report.pdfS3Url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border text-foreground hover:bg-muted"
                            onClick={() => window.open(report.pdfS3Url!, "_blank")}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            PDF
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => sendNotification.mutate({
                            reportTitle: report.title,
                            htmlUrl: report.htmlS3Url ?? undefined,
                            pdfUrl: report.pdfS3Url ?? undefined,
                            period: `${format(new Date(report.dateFrom), "MMM d")} — ${format(new Date(report.dateTo), "MMM d, yyyy")}`,
                          })}
                          disabled={sendNotification.isPending}
                        >
                          <Send className="w-3.5 h-3.5 mr-1" />
                          Notify
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled Reports */}
        {schedules && schedules.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Scheduled Reports</h2>
            <div className="space-y-2">
              {schedules.map((s) => (
                <Card key={s.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${s.isActive ? "bg-green-400" : "bg-muted-foreground"}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.frequency} • {s.reportType.replace("_", " ")}
                          {s.nextRunAt && ` • Next: ${format(new Date(s.nextRunAt), "MMM d, HH:mm")}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={s.isActive ? "text-green-400 border-green-400/30" : "text-muted-foreground border-border"}>
                        {s.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
