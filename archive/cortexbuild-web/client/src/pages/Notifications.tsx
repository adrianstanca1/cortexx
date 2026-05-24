import { useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
};

const TYPE_COLOR = {
  info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  warning: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  success: "bg-green-500/10 text-green-400 border-green-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function Notifications() {
  const [activeTab, setActiveTab] = useState("all");
  const utils = trpc.useUtils();

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { limit: 100 },
    { refetchInterval: 30000 }
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      toast.success("Marked as read");
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const deleteNotification = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      toast.success("Notification deleted");
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  const filtered = notifications?.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return n.type === activeTab;
  });

  return (
    <DashboardShell
      title="Notifications"
      subtitle={`You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
    >
      <div className="max-w-3xl space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Notification Center
                {unreadCount > 0 && (
                  <Badge variant="default" className="text-xs">{unreadCount}</Badge>
                )}
              </CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-xs"
                  onClick={() => markAllRead.mutate()}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="border border-border bg-card">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="warning">Warnings</TabsTrigger>
                <TabsTrigger value="success">Success</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-2">
                {isLoading && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                )}

                {!isLoading && filtered?.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No notifications found.</p>
                  </div>
                )}

                {filtered?.map((notification) => {
                  const Icon = TYPE_ICON[notification.type as keyof typeof TYPE_ICON] || Info;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        notification.read
                          ? "bg-card border-border opacity-70"
                          : "bg-muted/30 border-border hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("p-2 rounded-md shrink-0", TYPE_COLOR[notification.type as keyof typeof TYPE_COLOR])}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{notification.content}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-primary"
                            onClick={() => markRead.mutate({ id: notification.id })}
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteNotification.mutate({ id: notification.id })}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
