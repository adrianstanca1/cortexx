import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTimesheetStore } from "@/stores/timesheetStore";

export default function TimesheetsScreen() {
  const { colors } = useTheme();
  const { entries } = useTimesheetStore();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hoursWorked, 0);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Timesheets</ThemedText>
        <View className="flex-row justify-between items-center bg-white rounded-xl p-3 mt-2">
          <View>
            <ThemedText className="text-xs text-gray-500">Total Hours</ThemedText>
            <ThemedText className="text-lg font-bold">{totalHours}</ThemedText>
          </View>
          <View>
            <ThemedText className="text-xs text-gray-500">Entries</ThemedText>
            <ThemedText className="text-lg font-bold">{entries.length}</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon="time"
            title="No Timesheets"
            subtitle="Worker hours and time records will appear here."
          />
        ) : (
          entries.map((entry) => (
            <TouchableOpacity key={entry.id} className="mb-3">
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <ThemedText className="font-semibold text-base mb-1">
                      {entry.workerName}
                    </ThemedText>
                    <ThemedText className="text-sm text-gray-500 mb-1">
                      {new Date(entry.date).toLocaleDateString()} · {entry.startTime} - {entry.endTime}
                    </ThemedText>
                    <View className="flex-row items-center mt-1">
                      <Badge label={`${entry.hoursWorked}h`} variant="info" className="mr-2" />
                      <Badge
                        label={entry.status}
                        variant={
                          entry.status === "approved"
                            ? "success"
                            : entry.status === "rejected"
                            ? "danger"
                            : "warning"
                        }
                      />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
