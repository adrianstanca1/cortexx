import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";


import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "expo-router";


export default function ChangeOrdersScreen() {
  const { colors: _colors } = useTheme();
  const _router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Change Orders</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-1">
          Variations and modifications
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <EmptyState
          icon="swap-horizontal"
          title="No Change Orders"
          subtitle="Track variations and change requests."
        />
      </ScrollView>

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
