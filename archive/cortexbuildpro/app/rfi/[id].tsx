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
import { useRFIStore } from "@/stores/rfiStore";

export default function RFIDetailScreen() {
  const { id } = useLocalSearchParams();
  const _router = useRouter();
  const { colors } = useTheme();
  const { rfis } = useRFIStore();

  const rfi = rfis.find((r) => r.id === id);

  if (!rfi) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="RFI Not Found" />
        <EmptyState
          title="RFI not found"
          subtitle="This RFI may have been deleted"
        />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={`RFI ${rfi.number}`} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge
              label={rfi.status}
              variant={
                rfi.status === "closed"
                  ? "success"
                  : rfi.status === "responded"
                  ? "primary"
                  : rfi.status === "submitted"
                  ? "warning"
                  : "default"
              }
            />
            <Badge
              label={rfi.priority}
              variant={
                rfi.priority === "urgent"
                  ? "danger"
                  : rfi.priority === "high"
                  ? "warning"
                  : rfi.priority === "medium"
                  ? "primary"
                  : "default"
              }
              size="sm"
            />
          </View>

          <ThemedText variant="h2" className="mb-1">
            {rfi.title}
          </ThemedText>

          {rfi.description && (
            <ThemedText variant="body" color="secondary" className="mb-3">
              {rfi.description}
            </ThemedText>
          )}

          <View className="flex-row flex-wrap">
            {rfi.dueDate && (
              <View className="flex-row items-center mr-4 mb-2">
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  Due: {rfi.dueDate}
                </ThemedText>
              </View>
            )}
            <View className="flex-row items-center mr-4 mb-2">
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="caption" color="secondary" className="ml-1">
                By: {rfi.submittedBy}
              </ThemedText>
            </View>
            {rfi.submittedAt && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  {rfi.submittedAt.slice(0, 10)}
                </ThemedText>
              </View>
            )}
          </View>
        </Card>

        {rfi.response && (
          <Card className="mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkmark-done-outline" size={18} color={colors.success} />
              <ThemedText variant="h3" style={{ color: colors.success, marginLeft: 8 }}>
                Response
              </ThemedText>
            </View>
            <ThemedText variant="body" className="mb-2">
              {rfi.response}
            </ThemedText>
            {rfi.respondedBy && (
              <ThemedText variant="caption" color="secondary">
                Responded by {rfi.respondedBy}
                {rfi.respondedAt && ` on ${rfi.respondedAt.slice(0, 10)}`}
              </ThemedText>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
