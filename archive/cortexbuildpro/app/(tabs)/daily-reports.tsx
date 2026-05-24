import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useDailyReportStore } from "@/stores/dailyReportStore";

const weatherIcon: Record<string, string> = {
  clear: "sunny-outline",
  cloudy: "cloudy-outline",
  rain: "rainy-outline",
  snow: "snow-outline",
  windy: "leaf-outline",
  fog: "cloud-outline",
};

export default function DailyReportsScreen() {
  const { colors } = useTheme();
  const _router = useRouter();
  const { reports } = useDailyReportStore();

  const [refreshing, setRefreshing] = useState(false);

  const sorted = [...reports].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <ThemedText variant="h1">Daily Reports</ThemedText>
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {sorted.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No daily reports"
            subtitle="Create your first daily site diary entry"
            actionLabel="New Report"
          />
        ) : (
          sorted.map((report) => (
            <Card key={report.id} className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <ThemedText variant="h3">{report.date}</ThemedText>
                  <View className="flex-row items-center ml-3">
                    <Ionicons
                      name={weatherIcon[report.weather.condition] as any}
                      size={16}
                      color={colors.textSecondary}
                    />
                    {report.weather.temperature && (
                      <ThemedText variant="caption" color="secondary" className="ml-1">
                        {report.weather.temperature}°C
                      </ThemedText>
                    )}
                  </View>
                </View>
                <Badge label={`${report.workforce} workers`} size="sm" />
              </View>

              <ThemedText variant="body" className="mb-1">{report.summary}</ThemedText>

              {report.issues && (
                <View className="flex-row items-start mt-1">
                  <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                  <ThemedText variant="caption" color="danger" className="ml-1 flex-1">
                    {report.issues}
                  </ThemedText>
                </View>
              )}

              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center">
                  <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
                  <ThemedText variant="caption" color="secondary" className="ml-1">
                    {report.workCompleted}
                  </ThemedText>
                </View>
                {report.photos && report.photos.length > 0 && (
                  <View className="flex-row items-center">
                    <Ionicons name="image-outline" size={14} color={colors.textSecondary} />
                    <ThemedText variant="caption" color="secondary" className="ml-1">
                      {report.photos.length} photos
                    </ThemedText>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
