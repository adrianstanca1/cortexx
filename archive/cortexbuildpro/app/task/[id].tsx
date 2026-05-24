import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTaskStore } from "@/stores/taskStore";
import { useProjectStore } from "@/stores/projectStore";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();

  const task = useTaskStore((s) => s.tasks.find((t) => t.id === id));
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === task?.projectId)
  );

  if (!task) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Task Not Found" />
        <EmptyState title="Task not found" subtitle="This task may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={task.title} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row flex-wrap mb-3">
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
              size="md"
            />
            <View className="w-2" />
            <Badge
              label={task.priority}
              variant={
                task.priority === "critical"
                  ? "danger"
                  : task.priority === "high"
                  ? "warning"
                  : task.priority === "medium"
                  ? "primary"
                  : "default"
              }
              size="md"
            />
          </View>

          {task.description && (
            <ThemedText variant="body" color="secondary" className="mb-4">
              {task.description}
            </ThemedText>
          )}

          <View className="flex-row flex-wrap">
            <View className="flex-row items-center mr-4 mb-2">
              <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="caption" color="secondary" className="ml-1">
                {project?.name ?? "Unknown project"}
              </ThemedText>
            </View>
            {task.dueDate && (
              <View className="flex-row items-center mr-4 mb-2">
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  Due: {task.dueDate}
                </ThemedText>
              </View>
            )}
            {task.assigneeId && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  Assigned
                </ThemedText>
              </View>
            )}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
