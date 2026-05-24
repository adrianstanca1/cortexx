import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams } from "wouter";
import { MessageSquare, Image, Bot, User, Star } from "lucide-react";
import { format } from "date-fns";

export default function ConversationDetail() {
  const params = useParams<{ id: string }>();
  const conversationId = parseInt(params.id ?? "0");

  const { data: conversation } = trpc.conversations.get.useQuery({ id: conversationId });
  const { data: messages, isLoading } = trpc.conversations.messages.useQuery({
    conversationId,
    limit: 100,
  });

  const sorted = [...(messages ?? [])].reverse();

  return (
    <DashboardShell
      title={conversation?.title ?? `Conversation #${conversationId}`}
      subtitle={conversation?.projectTag ? `Project: ${conversation.projectTag}` : "WhatsApp thread"}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No messages in this conversation yet.</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {sorted.map((msg) => {
            const isInbound = msg.direction === "inbound";
            return (
              <div key={msg.id} className={`flex gap-3 ${isInbound ? "" : "flex-row-reverse"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isInbound ? "bg-muted" : "bg-primary/10"}`}>
                  {isInbound ? (
                    <User className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className={`max-w-lg ${isInbound ? "" : "items-end"} flex flex-col gap-1`}>
                  <Card className={`border ${isInbound ? "bg-card border-border" : "bg-primary/10 border-primary/20"}`}>
                    <CardContent className="p-3">
                      {msg.messageType === "image" ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Image className="w-4 h-4" />
                          <span>Image{msg.body ? `: ${msg.body}` : ""}</span>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.body ?? "[media]"}</p>
                      )}
                    </CardContent>
                  </Card>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.sentAt), "MMM d, HH:mm")}
                    </span>
                    {msg.isKeySection && (
                      <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" />
                        {msg.keyLabel ?? "Key section"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
