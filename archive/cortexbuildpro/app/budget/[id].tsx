import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useBudgetStore } from "@/stores/budgetStore";

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const { budgets } = useBudgetStore();

  const item = budgets.find((i) => i.id === id);

  if (!item) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Budget Not Found" />
        <EmptyState title="Budget not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  const progress = Math.min(((item.totalSpent ?? 0) / (item.totalBudget ?? 1)) * 100, 100);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={item.name || "Budget"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge
              label={item.status}
              variant={item.status === "approved" ? "success" : item.status === "draft" ? "primary" : "default"}
            />
          </View>
          <ThemedText variant="h2" className="mb-3">{item.name}</ThemedText>
          <View className="flex-row justify-between mb-4">
            <View>
              <ThemedText variant="caption" color="secondary">Total Budget</ThemedText>
              <ThemedText variant="h3">£{item.totalBudget?.toLocaleString() ?? 0}</ThemedText>
            </View>
            <View>
              <ThemedText variant="caption" color="secondary">Spent</ThemedText>
              <ThemedText variant="h3" style={{ color: colors.danger }}>
                £{item.totalSpent?.toLocaleString() ?? 0}
              </ThemedText>
            </View>
            <View>
              <ThemedText variant="caption" color="secondary">Remaining</ThemedText>
              <ThemedText variant="h3" style={{ color: colors.success }}>
                £{((item.totalBudget ?? 0) - (item.totalSpent ?? 0)).toLocaleString()}
              </ThemedText>
            </View>
          </View>
          <View className="mt-2 h-3 bg-gray-200 rounded-full overflow-hidden">
            <View className="h-full bg-blue-600 rounded-full" style={{ width: `${progress}%` }} />
          </View>
          <ThemedText variant="caption" color="secondary" className="text-right mt-1">
            {progress.toFixed(1)}% used
          </ThemedText>
        </Card>

        {item.description && (
          <Card className="mb-4">
            <ThemedText variant="h3" className="mb-2">Description</ThemedText>
            <ThemedText variant="body">{item.description}</ThemedText>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
