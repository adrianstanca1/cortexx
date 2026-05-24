import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Star, Clock, Tag } from "lucide-react";
import { format } from "date-fns";

const IMPORTANCE_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICONS: Record<string, string> = {
  key_decision: "🎯",
  instruction: "📋",
  project_update: "🏗️",
  issue_mention: "⚠️",
  contact_info: "👤",
  general: "💬",
};

export default function Memory() {
  const { data: sections, isLoading } = trpc.memory.all.useQuery({ limit: 100 });

  return (
    <DashboardShell title="Memory" subtitle="AI-extracted key information from conversations">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : sections?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Brain className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No memory stored yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            As conversations happen on WhatsApp, the AI will automatically extract and store key decisions, instructions, and project updates here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections?.map((section) => (
            <Card key={section.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">
                    {TYPE_ICONS[section.sectionType] ?? "💬"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground text-sm">{section.title}</h3>
                      <Badge variant="outline" className={`text-xs ${IMPORTANCE_STYLES[section.importance]}`}>
                        {section.importance === "critical" || section.importance === "high" ? (
                          <Star className="w-2.5 h-2.5 mr-1" />
                        ) : null}
                        {section.importance}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground border-border flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />
                        {section.sectionType.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{section.content}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(new Date(section.createdAt), "MMM d, yyyy HH:mm")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
