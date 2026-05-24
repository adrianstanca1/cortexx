import React from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";

export default function PunchItemsListScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Punch Items</ThemedText>
      </View>
      <EmptyState icon="hammer" title="No Punch Items" subtitle="Snags and defects will appear here." />
    </View>
  );
}
