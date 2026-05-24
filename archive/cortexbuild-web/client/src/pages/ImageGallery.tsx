import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Image, AlertTriangle, Eye, Tag, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import type { Media } from "../../../drizzle/schema";

export default function ImageGallery() {
  const { data: images, isLoading } = trpc.media.gallery.useQuery({ limit: 100 });
  const [selected, setSelected] = useState<Media | null>(null);

  const onlyImages = images?.filter((m) => m.mediaType === "image") ?? [];

  return (
    <DashboardShell title="Image Gallery" subtitle="All site photos with AI analysis">
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-card rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : onlyImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Image className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No images yet</h3>
          <p className="text-sm text-muted-foreground">Images sent via WhatsApp will appear here with AI analysis.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {onlyImages.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-card border border-border cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => setSelected(img)}
              >
                <img
                  src={img.s3Url}
                  alt={img.visionDescription ?? "Site image"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.background = "oklch(0.16 0.01 240)";
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs text-white line-clamp-2">{img.visionDescription?.slice(0, 80) ?? "No analysis"}</p>
                  </div>
                </div>
                {/* Badges */}
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  {img.visionAnalyzed && (
                    <div className="w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {(img.visionSafetyHazards as string[] | null)?.length ? (
                    <div className="w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Detail Dialog */}
          <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
            <DialogContent className="max-w-2xl bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="text-foreground">Image Analysis</DialogTitle>
              </DialogHeader>
              {selected && (
                <div className="space-y-4">
                  <img
                    src={selected.s3Url}
                    alt="Site image"
                    className="w-full max-h-72 object-contain rounded-lg bg-muted"
                  />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Received</p>
                      <p className="text-foreground">{format(new Date(selected.sentAt), "PPp")}</p>
                    </div>
                    {selected.projectTag && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Project</p>
                        <p className="text-foreground">{selected.projectTag}</p>
                      </div>
                    )}
                  </div>

                  {selected.visionDescription && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> AI Description
                      </p>
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{selected.visionDescription}</p>
                    </div>
                  )}

                  {(selected.visionTags as string[] | null)?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.visionTags as string[]).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs text-primary border-primary/30">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(selected.visionIssuesDetected as string[] | null)?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-400" /> Issues Detected
                      </p>
                      <ul className="space-y-1">
                        {(selected.visionIssuesDetected as string[]).map((issue, i) => (
                          <li key={i} className="text-sm text-orange-300 bg-orange-500/10 rounded px-3 py-1.5">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {(selected.visionSafetyHazards as string[] | null)?.length ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-400" /> Safety Hazards
                      </p>
                      <ul className="space-y-1">
                        {(selected.visionSafetyHazards as string[]).map((h, i) => (
                          <li key={i} className="text-sm text-red-300 bg-red-500/10 rounded px-3 py-1.5">{h}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {selected.visionProgressNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Progress Notes</p>
                      <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{selected.visionProgressNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </DashboardShell>
  );
}
