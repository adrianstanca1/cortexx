import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useDrawingStore } from "@/stores/drawingStore";

const disciplineFilters = [
  { label: "All", value: "all" },
  { label: "Architectural", value: "architectural" },
  { label: "Structural", value: "structural" },
  { label: "MEP", value: "mechanical" },
];

export default function DrawingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { drawings } = useDrawingStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = drawings.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.drawingNumber.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || d.discipline === filter;
    return matchesSearch && matchesFilter;
  });

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold mb-2">
          Drawings
        </ThemedText>
        <Input
          placeholder="Search drawings..."
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          {disciplineFilters.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              className={`mr-2 px-3 py-1.5 rounded-full ${
                filter === f.value ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <ThemedText
                className={`text-sm font-medium ${
                  filter === f.value ? "text-white" : "text-gray-700"
                }`}
              >
                {f.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="document"
            title="No Drawings"
            subtitle="Upload your first drawing."
          />
        ) : (
          filtered.map((drawing) => (
            <TouchableOpacity key={drawing.id} className="mb-3" onPress={() => router.push(`/defects/${drawing.id}`)}>
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <ThemedText className="text-xs font-medium text-gray-500 mr-2">
                        {drawing.drawingNumber}
                      </ThemedText>
                      <Badge label={drawing.discipline} variant="info" className="mr-2" />
                      <Badge
                        label={drawing.status}
                        variant={drawing.status === "current" ? "success" : "warning"}
                      />
                    </View>
                    <ThemedText className="font-semibold text-base mb-1" numberOfLines={2}>
                      {drawing.name}
                    </ThemedText>
                    <ThemedText className="text-xs text-gray-400">
                      Rev {drawing.revision} &bull; {new Date(drawing.revisionDate).toLocaleDateString()}
                    </ThemedText>
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
