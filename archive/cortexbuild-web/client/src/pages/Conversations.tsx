import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { MessageSquare, Image, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Conversations() {
  const { data: conversations, isLoading } = trpc.conversations.list.useQuery({ limit: 50 });
  const { data: contacts } = trpc.contacts.list.useQuery({ limit: 200 });

  const contactMap = new Map(contacts?.map((c) => [c.id, c]) ?? []);

  return (
    <DashboardShell title="Conversations" subtitle="All WhatsApp chat threads">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : conversations?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No conversations yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Once your WhatsApp webhook is connected, incoming messages will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations?.map((conv) => {
            const contact = contactMap.get(conv.contactId);
            return (
              <Link key={conv.id} href={`/conversations/${conv.id}`}>
                <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(contact?.displayName ?? contact?.phoneNumber ?? "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground text-sm truncate">
                            {contact?.displayName ?? contact?.phoneNumber ?? `Contact #${conv.contactId}`}
                          </p>
                          {conv.projectTag && (
                            <Badge variant="outline" className="text-xs text-primary border-primary/30 shrink-0">
                              {conv.projectTag}
                            </Badge>
                          )}
                          {conv.title && (
                            <span className="text-xs text-muted-foreground truncate">{conv.title}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {conv.messageCount} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            {conv.imageCount} images
                          </span>
                          {conv.issueCount > 0 && (
                            <span className="flex items-center gap-1 text-orange-400">
                              <AlertTriangle className="w-3 h-3" />
                              {conv.issueCount} issues
                            </span>
                          )}
                        </div>
                      </div>
                      {conv.lastMessageAt && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
