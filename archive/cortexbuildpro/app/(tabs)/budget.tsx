import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useBudgetStore } from "@/stores/budgetStore";

export default function BudgetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { budgets } = useBudgetStore();

  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold mb-2">
          Budget
        </ThemedText>
        <ThemedText className="text-sm text-gray-500">
          {budgets.length} budgets
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {budgets.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No Budgets"
            subtitle="Create your first project budget."
          />
        ) : (
          budgets.map((budget) => (
            <TouchableOpacity key={budget.id} className="mb-3" onPress={() => router.push(`/budget/${budget.id}`)}>
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <ThemedText className="font-semibold text-base mb-1">
                      {budget.name}
                    </ThemedText>
                    <View className="flex-row items-center mt-1">
                      <ThemedText className="text-sm text-gray-500 mr-4">
                        Budget: £{budget.totalBudget?.toLocaleString() ?? 0}
                      </ThemedText>
                      <ThemedText className="text-sm text-gray-500">
                        Spent: £{budget.totalSpent?.toLocaleString() ?? 0}
                      </ThemedText>
                    </View>
                    <View className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${Math.min(((budget.totalSpent ?? 0) / (budget.totalBudget ?? 1)) * 100, 100)}%`,
                        }}
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

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
