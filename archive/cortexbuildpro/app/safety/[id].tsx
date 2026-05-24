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
import { useSafetyStore } from "@/stores/safetyStore";

// Read-only safety-incident detail. Mirrors defects/[id].tsx — zustand
// store lookup, no mutation UI yet (matches every other detail screen
// in this app).

export default function SafetyIncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { incidents } = useSafetyStore();

  const incident = incidents.find((i: any) => i.id === id);

  if (!incident) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Incident Not Found" />
        <EmptyState title="Safety incident not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  const severityVariant: "default" | "warning" | "success" | "danger" =
    incident.severity === "critical" || incident.severity === "major"
      ? "danger"
      : incident.severity === "minor"
      ? "warning"
      : "default";

  const statusVariant: "default" | "warning" | "success" | "danger" =
    incident.status === "resolved" || incident.status === "closed"
      ? "success"
      : incident.status === "investigating"
      ? "warning"
      : "danger";

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={incident.title || "Safety incident"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge label={incident.severity} variant={severityVariant} />
            <Badge label={incident.status} variant={statusVariant} />
          </View>
          <ThemedText variant="h2" className="mb-3">{incident.title}</ThemedText>
          {incident.description && (
            <ThemedText variant="body" color="secondary" className="mb-3">
              {incident.description}
            </ThemedText>
          )}
          {incident.reportedBy && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Reported by: {incident.reportedBy}
              </ThemedText>
            </View>
          )}
          {incident.createdAt && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                {String(incident.createdAt)}
              </ThemedText>
            </View>
          )}
          {incident.resolvedAt && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Resolved: {String(incident.resolvedAt)}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
