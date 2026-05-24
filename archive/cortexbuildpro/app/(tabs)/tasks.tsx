import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";

import { useTheme } from "@/hooks/useTheme";
import { useTaskStore } from "@/stores/taskStore";
import type { Task } from "@/types";

const columns: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#64748b" },
  { key: "in_progress", label: "In Progress", color: "#0ea5e9" },
  { key: "review", label: "Review", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
];

export default function TasksScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { tasks, updateTask: _updateTask } = useTaskStore();

  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <ThemedText variant="h1">Tasks</ThemedText>
        <TouchableOpacity
          onPress={() => router.push("/task/create")}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <View key={col.key} className="w-72 mx-1">
              <View
                className="flex-row items-center px-3 py-2 rounded-t-xl mb-1"
                style={{ backgroundColor: colors.surface }}
              >
                <View
                  className="w-2.5 h-2.5 rounded-full mr-2"
                  style={{ backgroundColor: col.color }}
                />
                <ThemedText variant="body" className="font-semibold">
                  {col.label}
                </ThemedText>
                <ThemedText variant="caption" color="secondary" className="ml-2">
                  {colTasks.length}
                </ThemedText>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {colTasks.length === 0 ? (
                  <View
                    className="items-center justify-center py-8 rounded-b-xl"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <ThemedText variant="caption" color="secondary">
                      No tasks
                    </ThemedText>
                  </View>
                ) : (
                  colTasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => router.push(`/task/${task.id}`)}
                    >
                      <Card className="mb-2">
                        <ThemedText variant="body" className="font-semibold mb-1">
                          {task.title}
                        </ThemedText>
                        {task.description && (
                          <ThemedText variant="caption" color="secondary" numberOfLines={2} className="mb-2">
                            {task.description}
                          </ThemedText>
                        )}
                        <View className="flex-row items-center justify-between">
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
                            size="sm"
                          />
                          {task.dueDate && (
                            <View className="flex-row items-center">
                              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                              <ThemedText variant="caption" color="secondary" className="ml-1">
                                {task.dueDate}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </Card>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
