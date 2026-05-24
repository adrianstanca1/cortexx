import React, { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useDrawingStore } from "@/stores/drawingStore";

export default function DrawingsScreen() {
  const { colors: _colors } = useTheme();
  const { drawings, fetchDrawings } = useDrawingStore();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await fetchDrawings();
    setRefreshing(false);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Drawings</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-1">{drawings.length} drawings</ThemedText>
      </View>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {drawings.length === 0 ? (
          <EmptyState icon="images" title="No Drawings" subtitle="Upload your first drawing" />
        ) : (
          drawings.map((drawing) => (
            <Card key={drawing.id} className="mb-3">
              <ThemedText className="font-semibold">{drawing.name}</ThemedText>
              <ThemedText className="text-sm text-gray-500 mt-1">{drawing.revision}</ThemedText>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
