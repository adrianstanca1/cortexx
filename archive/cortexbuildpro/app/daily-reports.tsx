import React, { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useDailyReportStore } from "@/stores/dailyReportStore";

export default function DailyReportsScreen() {
  const { colors: _colors } = useTheme();
  const { reports, fetchReports } = useDailyReportStore();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Daily Reports</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-1">{reports.length} reports</ThemedText>
      </View>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reports.length === 0 ? (
          <EmptyState icon="document-text" title="No Daily Reports" subtitle="Create your first daily report" />
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="mb-3">
              <ThemedText className="font-semibold">{report.date}</ThemedText>
              <ThemedText className="text-sm text-gray-500 mt-1">{report.summary || ""}</ThemedText>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
