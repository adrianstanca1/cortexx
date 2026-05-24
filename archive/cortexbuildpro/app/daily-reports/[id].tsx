import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useDailyReportStore } from "@/stores/dailyReportStore";

export default function DailyReportDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { reports } = useDailyReportStore();

  const item = reports.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Report Not Found" />
        <EmptyState title="Report not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={`Report ${item.date?.slice(0, 10) ?? ""}`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="h2" className="mb-3">Daily Report</ThemedText>
          <View className="flex-row flex-wrap">
            {item.weather?.condition && (
              <View className="flex-row items-center mr-4 mb-2">
                <Ionicons name="cloud-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  {item.weather.condition}
                </ThemedText>
              </View>
            )}
            {item.weather?.temperature != null && (
              <View className="flex-row items-center mr-4 mb-2">
                <Ionicons name="thermometer-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  {item.weather.temperature}°C
                </ThemedText>
              </View>
            )}
            {item.workforce != null && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                <ThemedText variant="caption" color="secondary" className="ml-1">
                  {item.workforce} workers
                </ThemedText>
              </View>
            )}
          </View>
        </Card>

        {item.summary && (
          <Card className="mb-4">
            <ThemedText variant="h3" className="mb-2">Summary</ThemedText>
            <ThemedText variant="body">{item.summary}</ThemedText>
          </Card>
        )}

        {item.workCompleted && (
          <Card className="mb-4">
            <ThemedText variant="h3" className="mb-2">Work Completed</ThemedText>
            <ThemedText variant="body">{item.workCompleted}</ThemedText>
          </Card>
        )}

        {item.issues && (
          <Card className="mb-4">
            <ThemedText variant="h3" className="mb-2">Issues &amp; Delays</ThemedText>
            <ThemedText variant="body">{item.issues}</ThemedText>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
