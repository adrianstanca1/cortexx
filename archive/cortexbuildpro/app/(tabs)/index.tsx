import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useTaskStore } from "@/stores/taskStore";
import { useSafetyStore } from "@/stores/safetyStore";

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  const { colors: _colors } = useTheme();
  return (
    <Card className="flex-1 mx-1 min-w-[100px]">
      <View className="flex-row items-center mb-2">
        <View
          className="w-8 h-8 rounded-lg items-center justify-center mr-2"
          style={{ backgroundColor: color + "20" }}
        >
          {/* @ts-ignore */}
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <ThemedText variant="caption" color="secondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText variant="h1">{value}</ThemedText>
    </Card>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { projects, setProjects } = useProjectStore();
  const { tasks, setTasks } = useTaskStore();
  const { incidents, setIncidents } = useSafetyStore();

  const [refreshing, setRefreshing] = useState(false);

  // Demo data for now — replace with API fetch
  useEffect(() => {
    if (projects.length === 0) {
      setProjects([
        {
          id: "p1",
          name: "Downtown Tower",
          description: "32-storey commercial tower",
          status: "active",
          location: { lat: 51.5074, lng: -0.1278, address: "London EC2" },
          startDate: "2026-01-15",
          endDate: "2027-06-30",
          budget: 4500000,
          orgId: "org1",
          createdAt: "2026-01-10",
          updatedAt: "2026-05-08",
        },
        {
          id: "p2",
          name: "Riverside Apartments",
          description: "Luxury waterfront residential",
          status: "planning",
          location: { lat: 51.5123, lng: -0.09, address: "South Bank SE1" },
          startDate: "2026-08-01",
          endDate: "2028-03-15",
          budget: 8200000,
          orgId: "org1",
          createdAt: "2026-03-01",
          updatedAt: "2026-05-01",
        },
        {
          id: "p3",
          name: "Industrial Warehouse",
          description: "Logistics facility expansion",
          status: "on_hold",
          orgId: "org1",
          createdAt: "2026-02-20",
          updatedAt: "2026-04-15",
        },
      ]);
    }
    if (tasks.length === 0) {
      setTasks([
        {
          id: "t1",
          projectId: "p1",
          title: "Foundation pour",
          description: "Complete concrete foundation pour for Tower A",
          status: "done",
          priority: "high",
          assigneeId: "u1",
          dueDate: "2026-03-15",
          createdAt: "2026-02-01",
          updatedAt: "2026-03-10",
        },
        {
          id: "t2",
          projectId: "p1",
          title: "Steel frame erection",
          description: "Erect structural steel frame floors 1-10",
          status: "in_progress",
          priority: "critical",
          assigneeId: "u2",
          dueDate: "2026-06-01",
          createdAt: "2026-03-01",
          updatedAt: "2026-05-05",
        },
        {
          id: "t3",
          projectId: "p1",
          title: "Electrical rough-in",
          status: "todo",
          priority: "medium",
          dueDate: "2026-07-15",
          createdAt: "2026-04-01",
          updatedAt: "2026-04-01",
        },
        {
          id: "t4",
          projectId: "p2",
          title: "Site survey",
          status: "done",
          priority: "high",
          dueDate: "2026-04-30",
          createdAt: "2026-03-15",
          updatedAt: "2026-04-20",
        },
        {
          id: "t5",
          projectId: "p2",
          title: "Planning permission",
          status: "review",
          priority: "critical",
          dueDate: "2026-06-30",
          createdAt: "2026-04-01",
          updatedAt: "2026-05-01",
        },
      ]);
    }
    if (incidents.length === 0) {
      setIncidents([
        {
          id: "i1",
          projectId: "p1",
          title: "Scaffolding incident",
          description: "Minor displacement during high winds — no injuries",
          severity: "minor",
          status: "resolved",
          reportedBy: "u1",
          createdAt: "2026-04-20",
          resolvedAt: "2026-04-22",
        },
        {
          id: "i2",
          projectId: "p1",
          title: "Near miss — crane swing",
          severity: "near_miss",
          status: "investigating",
          reportedBy: "u2",
          createdAt: "2026-05-05",
        },
      ]);
    }
  }, []);

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating"
  ).length;

  const recentTasks = tasks.slice(0, 5);
  const recentProjects = projects.slice(0, 3);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <ThemedText variant="caption" color="secondary">
            Welcome back
          </ThemedText>
          <ThemedText variant="h2" numberOfLines={1}>
            {user?.fullName ?? user?.email ?? "Contractor"}
          </ThemedText>
        </View>
        <Avatar name={user?.fullName ?? user?.email ?? "User"} imageUrl={user?.avatarUrl} size="lg" />
      </View>

      {/* Stats */}
      <View className="flex-row mb-6">
        <StatCard label="Projects" value={activeProjects} icon="briefcase-outline" color={colors.primary} />
        <StatCard label="Tasks Done" value={completedTasks} icon="checkmark-done-outline" color={colors.success} />
        <StatCard label="Open Issues" value={openIncidents} icon="warning-outline" color={colors.danger} />
      </View>

      {/* Quick Actions */}
      <View className="flex-row mb-6 space-x-2">
        <TouchableOpacity
          onPress={() => router.push("/project/create")}
          className="flex-1 flex-row items-center justify-center rounded-xl py-3 px-4"
          style={{ backgroundColor: colors.primary }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <ThemedText variant="body" style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>
            New Project
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/task/create")}
          className="flex-1 flex-row items-center justify-center rounded-xl py-3 px-4"
          style={{ backgroundColor: colors.surfaceHighlight }}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600", marginLeft: 6 }}>
            New Task
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Recent Projects */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText variant="h3">Projects</ThemedText>
          <TouchableOpacity onPress={() => router.push("/(tabs)/projects")}>
            <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600" }}>
              See All →
            </ThemedText>
          </TouchableOpacity>
        </View>
        {recentProjects.length === 0 ? (
          <EmptyState title="No projects" subtitle="Create your first project to get started" />
        ) : (
          recentProjects.map((project) => (
            <TouchableOpacity
              key={project.id}
              onPress={() => router.push(`/project/${project.id}`)}
            >
              <Card className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <ThemedText variant="body" className="font-semibold">
                      {project.name}
                    </ThemedText>
                    <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                      {project.description ?? project.location?.address ?? "No description"}
                    </ThemedText>
                  </View>
                  <Badge
                    label={project.status.replace("_", " ")}
                    variant={
                      project.status === "active"
                        ? "success"
                        : project.status === "planning"
                        ? "warning"
                        : project.status === "on_hold"
                        ? "info"
                        : "default"
                    }
                  />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Recent Tasks */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText variant="h3">Recent Tasks</ThemedText>
          <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
            <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600" }}>
              See All →
            </ThemedText>
          </TouchableOpacity>
        </View>
        {recentTasks.length === 0 ? (
          <EmptyState title="No tasks" subtitle="Create tasks within a project" />
        ) : (
          recentTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              onPress={() => router.push(`/task/${task.id}`)}
            >
              <Card className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <ThemedText variant="body" className="font-semibold">
                      {task.title}
                    </ThemedText>
                    <ThemedText variant="caption" color="secondary">
                      {task.dueDate ? `Due ${task.dueDate}` : "No due date"}
                    </ThemedText>
                  </View>
                  <Badge
                    label={task.status.replace("_", " ")}
                    variant={
                      task.status === "done"
                        ? "success"
                        : task.status === "in_progress"
                        ? "primary"
                        : task.status === "review"
                        ? "warning"
                        : "default"
                    }
                  />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
