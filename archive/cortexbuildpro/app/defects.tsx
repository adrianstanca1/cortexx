import React from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";

export default function DefectsListScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Defects</ThemedText>
      </View>
      <EmptyState
        icon="warning"
        title="No Defects"
        subtitle="Quality issues will appear here."
      />
    </View>
  );
}
