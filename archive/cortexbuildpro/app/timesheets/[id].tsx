import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTimesheetStore } from "@/stores/timesheetStore";

export default function TimesheetEntryDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { entries } = useTimesheetStore();

  const item = entries.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="TimesheetEntry Not Found" />
        <EmptyState title="TimesheetEntry not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.workerName || "TimesheetEntry"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">{item.workerName || "TimesheetEntry"}</ThemedText>
          {item.workerName && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Worker: {item.workerName}
              </ThemedText>
            </View>
          )}
          {item.date && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Date: {item.date}
              </ThemedText>
            </View>
          )}
          {item.hoursWorked && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Hours: {item.hoursWorked}
              </ThemedText>
            </View>
          )}
          {item.status && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="checkbox-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Status: {item.status}
              </ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}