import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useProjectStore } from "@/stores/projectStore";

const statusFilters: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Planning", value: "planning" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
];

export default function ProjectsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { projects } = useProjectStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase() ?? "").includes(search.toLowerCase());
    const matchesFilter = filter === "all" || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText variant="h1">Projects</ThemedText>
          <TouchableOpacity
            onPress={() => router.push("/project/create")}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <Input
          placeholder="Search projects..."
          value={search}
          onChangeText={setSearch}
          className="mb-2"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {statusFilters.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              className="mr-2 px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor:
                  filter === f.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="caption"
                style={{
                  color: filter === f.value ? "#fff" : colors.text,
                  fontWeight: filter === f.value ? "600" : "400",
                }}
              >
                {f.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="No projects found"
            subtitle={search || filter !== "all" ? "Try adjusting your filters" : "Create your first project"}
            actionLabel="Create Project"
            onAction={() => router.push("/project/create")}
          />
        ) : (
          filtered.map((project) => (
            <TouchableOpacity
              key={project.id}
              onPress={() => router.push(`/project/${project.id}`)}
            >
              <Card className="mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <ThemedText variant="h3" numberOfLines={1} className="flex-1 mr-2">
                    {project.name}
                  </ThemedText>
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
                {project.description && (
                  <ThemedText variant="body" color="secondary" numberOfLines={2} className="mb-2">
                    {project.description}
                  </ThemedText>
                )}
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <ThemedText variant="caption" color="secondary" className="ml-1">
                    {project.location?.address ?? "No location"}
                  </ThemedText>
                  <View className="flex-1" />
                  {project.budget && (
                    <ThemedText variant="caption" color="secondary">
                      £{(project.budget / 1_000_000).toFixed(1)}M
                    </ThemedText>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
