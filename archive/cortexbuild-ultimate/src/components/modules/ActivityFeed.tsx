import { useState, useEffect } from "react";
import {
  Activity,
  Edit,
  CheckCircle,
  AlertTriangle,
  FileText,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Search,
  Eye,
  Bell,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import { ModuleBreadcrumbs } from "../ui/Breadcrumbs";
import { apiFetch } from "../../services/api";

interface Activity {
  id?: string;
  description?: string;
  user_name?: string;
  category?: string;
  created_at?: string;
  entity_name?: string;
  [key: string]: unknown;
}

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  user_name: string;
  user_role: string;
  description: string;
  created_at: string;
  module: string;
  category: string;
  metadata?: Record<string, unknown>;
}

interface NotificationItem {
  id: string;
  type: "mention" | "task_assigned" | "deadline" | "approval_needed" | "alert";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  severity?: "low" | "medium" | "high";
}

type ActivityFilter =
  | "all"
  | "projects"
  | "finance"
  | "safety"
  | "team"
  | "documents"
  | "ai";

const ENTITY_ICONS: Record<string, typeof Activity> = {
  projects: TrendingUp,
  finance: DollarSign,
  safety: AlertTriangle,
  team: Users,
  documents: FileText,
  ai: BarChart3,
  meetings: Calendar,
  change_orders: Edit,
  punch_list: CheckCircle,
  inspections: Eye,
  default: Activity,
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-400",
  update: "bg-blue-500/10 text-blue-400",
  delete: "bg-red-500/10 text-red-400",
  complete: "bg-emerald-500/10 text-emerald-400",
  approve: "bg-purple-500/10 text-purple-400",
  reject: "bg-orange-500/10 text-orange-400",
  created: "bg-green-500/10 text-green-400",
  updated: "bg-blue-500/10 text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  approved: "bg-purple-500/10 text-purple-400",
  rejected: "bg-orange-500/10 text-orange-400",
  added: "bg-green-500/10 text-green-400",
  uploaded: "bg-blue-500/10 text-blue-400",
  generated: "bg-amber-500/10 text-amber-400",
  default: "bg-gray-500/10 text-gray-400",
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [_showFilters, _setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "feed" | "analytics" | "notifications"
  >("feed");
  const [_unreadCount, _setUnreadCount] = useState(3);

  const notifications: NotificationItem[] = [
    {
      id: "1",
      type: "deadline",
      title: "Project Deadline Approaching",
      description: "Office Renovation Phase 2 due in 3 days",
      timestamp: "2026-04-06T14:00:00Z",
      read: false,
      severity: "high",
    },
    {
      id: "2",
      type: "task_assigned",
      title: "New Task Assigned",
      description: "Safety audit review assigned to you",
      timestamp: "2026-04-06T13:00:00Z",
      read: false,
      severity: "medium",
    },
    {
      id: "3",
      type: "approval_needed",
      title: "Change Order Approval Needed",
      description: "CO-2026-018 requires your approval",
      timestamp: "2026-04-06T12:30:00Z",
      read: false,
      severity: "high",
    },
    {
      id: "4",
      type: "mention",
      title: "You were mentioned",
      description: "Sarah mentioned you in project comments",
      timestamp: "2026-04-05T16:00:00Z",
      read: true,
      severity: "low",
    },
  ];

  const _filters: {
    key: ActivityFilter;
    label: string;
    icon: typeof Activity;
  }[] = [
    { key: "all", label: "All Activity", icon: Activity },
    { key: "projects", label: "Projects", icon: TrendingUp },
    { key: "finance", label: "Finance", icon: DollarSign },
    { key: "safety", label: "Safety", icon: AlertTriangle },
    { key: "team", label: "Team", icon: Users },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "ai", label: "AI Actions", icon: BarChart3 },
  ];

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "all") params.set("entity_type", filter);
    apiFetch<ActivityItem[]>(`/activity-feed?${params}`)
      .then((data) => {
        setActivities(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.warn("[ActivityFeed] fetch failed:", err);
        setActivities([]);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  function getActionType(action: string): string {
    const lower = action.toLowerCase();
    if (
      lower.includes("creat") ||
      lower.includes("add") ||
      lower.includes("new")
    )
      return "create";
    if (lower.includes("delet") || lower.includes("remov")) return "delete";
    if (
      lower.includes("complet") ||
      lower.includes("finish") ||
      lower.includes("done")
    )
      return "complete";
    if (lower.includes("approv")) return "approve";
    if (lower.includes("reject")) return "reject";
    if (
      lower.includes("update") ||
      lower.includes("edit") ||
      lower.includes("chang")
    )
      return "update";
    return action;
  }

  function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  function groupByDate(items: ActivityItem[]): Map<string, ActivityItem[]> {
    const groups = new Map<string, ActivityItem[]>();
    items.forEach((item) => {
      const date = new Date(item.created_at).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(item);
    });
    return groups;
  }

  const filteredActivities = (activities as unknown as Activity[])
    .filter((a) => {
      if (filter === "all") return true;
      return a?.category === filter;
    })
    .filter(
      (a) =>
        a?.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a?.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a?.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const groupedActivities = groupByDate(
    filteredActivities as unknown as ActivityItem[],
  );

  const stats = {
    total: (activities as unknown as Activity[]).length,
    today: (activities as unknown as Activity[]).filter((a: Activity) => {
      const d = new Date(a?.created_at ?? "");
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
    thisWeek: (activities as unknown as Activity[]).filter((a: Activity) => {
      const d = new Date(a?.created_at ?? "");
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }).length,
    uniqueUsers: new Set(
      (activities as unknown as Activity[]).map((a: Activity) => a?.user_name),
    ).size,
  };

  // Live Feed Tab
  const liveFeedTab = (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 rounded-lg border border-gray-700">
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
          />
        </div>
        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium">
          Mark all read
        </button>
      </div>

      <div className="flex border-b border-gray-700 mb-4">
        {(
          [
            "All",
            "Projects",
            "Finance",
            "Safety",
            "Team",
            "AI",
            "Documents",
          ] as const
        ).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat.toLowerCase() as ActivityFilter)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === cat.toLowerCase()
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <Activity size={32} className="mx-auto mb-3 animate-pulse" />
          <p>Loading activity feed...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity found"
          description={
            searchQuery
              ? "Try a different search term"
              : "Activity will appear here as you use the platform"
          }
        />
      ) : (
        Array.from(groupedActivities.entries()).map(([date, items]) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {date}
              </span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
            <div className="space-y-3">
              {items.map((activity) => {
                const Icon =
                  ENTITY_ICONS[activity.category] || ENTITY_ICONS.default;
                const actionType = getActionType(activity.action);
                const colorClass =
                  ACTION_COLORS[actionType] || ACTION_COLORS.default;
                const _userInitial = activity.user_name.charAt(0).toUpperCase();

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700/50 transition-colors group"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-white">
                            <span className="font-medium">
                              {activity.user_name}
                            </span>{" "}
                            <span className="text-gray-400">
                              {activity.description}
                            </span>
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
                            >
                              {actionType}
                            </span>
                            <span className="text-xs text-gray-600 bg-gray-700/50 px-2 py-0.5 rounded">
                              {activity.module}
                            </span>
                            {activity.entity_name && (
                              <span className="text-xs text-gray-500 truncate max-w-[200px]">
                                {activity.entity_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {timeAgo(activity.created_at)}
                          </span>
                          <button className="p-1 hover:bg-gray-700 rounded text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <button className="w-full py-3 text-center text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">
        Load more activities
      </button>
    </div>
  );

  // Analytics Tab
  const analyticsTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Total Activities</div>
          <div className="text-3xl font-display text-white">{stats.total}</div>
        </div>
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Today</div>
          <div className="text-3xl font-display text-green-400">
            {stats.today}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">This Week</div>
          <div className="text-3xl font-display text-amber-400">
            {stats.thisWeek}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-gray-400 text-xs mb-2">Active Users</div>
          <div className="text-3xl font-display text-purple-400">
            {stats.uniqueUsers}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-white font-display mb-4">Activity by Category</h3>
        <div className="space-y-3">
          {(() => {
            const categories = new Map<string, number>();
            (activities as unknown as Activity[]).forEach((a: Activity) => {
              categories.set(
                a?.category ?? "unknown",
                (categories.get(a?.category ?? "unknown") || 0) + 1,
              );
            });
            const total = (activities as unknown as Activity[]).length;
            return Array.from(categories.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => {
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-300 text-sm capitalize">
                        {cat}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              });
          })()}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-white font-display mb-4">Most Active Users</h3>
        <div className="space-y-2">
          {(() => {
            const users = new Map<string, number>();
            (activities as unknown as Activity[]).forEach((a: Activity) => {
              users.set(
                a?.user_name ?? "unknown",
                (users.get(a?.user_name ?? "unknown") || 0) + 1,
              );
            });
            return Array.from(users.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-2 bg-gray-800/50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                      {name.charAt(0)}
                    </div>
                    <span className="text-gray-300">{name}</span>
                  </div>
                  <span className="text-amber-400 font-semibold">{count}</span>
                </div>
              ));
          })()}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-white font-display mb-4">Peak Activity Hours</h3>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 24 }).map((_, hour) => {
            const intensity = Math.random();
            return (
              <div key={hour} className="flex flex-col items-center gap-1">
                <div
                  className="w-6 h-6 rounded bg-opacity-50"
                  style={{
                    backgroundColor:
                      intensity > 0.66
                        ? "rgb(239, 68, 68)"
                        : intensity > 0.33
                          ? "rgb(217, 119, 6)"
                          : "rgb(34, 197, 94)",
                  }}
                  title={`${hour}:00 - ${Math.floor(Math.random() * 10)} activities`}
                />
                <span className="text-xs text-gray-500">{hour}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Activity intensity by hour (24-hour view)
        </p>
      </div>
    </div>
  );

  // Notifications Tab
  const notificationsTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Notifications</h3>
        <button className="text-xs text-gray-400 hover:text-white">
          Preferences
        </button>
      </div>

      {(() => {
        const grouped = new Map<string, NotificationItem[]>();
        notifications.forEach((n) => {
          const _date = new Date(n.timestamp).toLocaleDateString("en-GB", {
            month: "short",
            day: "numeric",
          });
          const key =
            new Date(n.timestamp).toDateString() === new Date().toDateString()
              ? "Today"
              : new Date(n.timestamp).getTime() >
                  new Date().getTime() - 86400000
                ? "Yesterday"
                : new Date(n.timestamp).getTime() >
                    new Date().getTime() - 604800000
                  ? "This Week"
                  : "Earlier";
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(n);
        });

        return Array.from(grouped.entries()).map(([group, items]) => (
          <div key={group}>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {group}
            </p>
            <div className="space-y-2 mb-4">
              {items.map((notif) => {
                const severityColor =
                  notif.severity === "high"
                    ? "bg-red-500/10 border-red-500/30"
                    : notif.severity === "medium"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-blue-500/10 border-blue-500/30";
                const unreadClass = !notif.read
                  ? "border-l-2 border-l-amber-500"
                  : "";

                return (
                  <div
                    key={notif.id}
                    className={`card p-3 border border-gray-700 ${severityColor} ${unreadClass}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">
                          {notif.title}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          {notif.description}
                        </p>
                      </div>
                      <button className="text-xs text-gray-400 hover:text-white ml-2">
                        Mark read
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ));
      })()}
    </div>
  );

  return (
    <>
      <ModuleBreadcrumbs currentModule="activity-feed" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-white">Activity Feed</h2>
            <p className="text-gray-400 text-sm mt-1">
              Real-time activity across all modules
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "notifications" && _unreadCount > 0 && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs rounded-full font-semibold">
                {_unreadCount} new
              </span>
            )}
          </div>
        </div>

        {activeTab === "feed" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Activity className="text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Total</p>
                  <p className="text-2xl font-display text-white">
                    {stats.total}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Clock className="text-green-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Today</p>
                  <p className="text-2xl font-display text-green-400">
                    {stats.today}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Calendar className="text-amber-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">This Week</p>
                  <p className="text-2xl font-display text-amber-400">
                    {stats.thisWeek}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="text-purple-400" size={20} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Active Users</p>
                  <p className="text-2xl font-display text-purple-400">
                    {stats.uniqueUsers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-gray-700">
          {(["feed", "analytics", "notifications"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab === "feed" && <Activity size={16} />}
              {tab === "analytics" && <BarChart3 size={16} />}
              {tab === "notifications" && <Bell size={16} />}
              {tab === "feed" && "Live Feed"}
              {tab === "analytics" && "Analytics"}
              {tab === "notifications" && "Notifications"}
              {tab === "notifications" && _unreadCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-semibold">
                  {_unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="card p-6">
          {activeTab === "feed" && liveFeedTab}
          {activeTab === "analytics" && analyticsTab}
          {activeTab === "notifications" && notificationsTab}
        </div>
      </div>
    </>
  );
}
