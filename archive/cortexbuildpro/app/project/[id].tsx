import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useProjectStore } from "@/stores/projectStore";
import { useTaskStore } from "@/stores/taskStore";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const _router = useRouter();
  const { colors } = useTheme();

  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === id)
  );
  const tasks = useTaskStore((s) => s.tasksByProject(id as string));

  if (!project) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Project Not Found" />
        <EmptyState title="Project not found" subtitle="This project may have been deleted" />
      </View>
    );
  }

  const _statusColors: Record<string, string> = {
    active: colors.success,
    planning: colors.warning,
    on_hold: colors.info,
    completed: colors.primary,
    cancelled: colors.danger,
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={project.name} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
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
            {project.budget && (
              <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "700" }}>
                £{(project.budget / 1_000_000).toFixed(1)}M
              </ThemedText>
            )}
          </View>

          {project.description && (
            <ThemedText variant="body" color="secondary" className="mb-3">
              {project.description}
            </ThemedText>
          )}

          <View className="flex-row flex-wrap">
            {project.startDate && (
              <View className="flex-row items-center mr-4 mb-2">
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  Start: {project.startDate}
                </ThemedText>
              </View>
            )}
            {project.endDate && (
              <View className="flex-row items-center mr-4 mb-2">
                <Ionicons name="flag-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  End: {project.endDate}
                </ThemedText>
              </View>
            )}
            {project.location?.address && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  {project.location.address}
                </ThemedText>
              </View>
            )}
          </View>
        </Card>

        {/* Tasks */}
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText variant="h3">Tasks ({tasks.length})</ThemedText>
        </View>

        {tasks.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title="No tasks yet"
            subtitle="Add tasks to track progress"
          />
        ) : (
          tasks.map((task) => (
            <Card key={task.id} className="mb-2">
              <View className="flex-row items-center justify-between">
                <ThemedText variant="body" className="font-semibold flex-1">
                  {task.title}
                </ThemedText>
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
                  size="sm"
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
