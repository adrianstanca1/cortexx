import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "expo-router";
import { useDefectStore } from "@/stores/defectStore";

export default function DefectsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { defects } = useDefectStore();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold mb-2">
          Defects
        </ThemedText>
        <ThemedText className="text-sm text-gray-500">
          {defects.length} items
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {defects.length === 0 ? (
          <EmptyState
            icon="warning"
            title="No Defects"
            subtitle="Track quality issues and defects."
          />
        ) : (
          defects.map((defect) => (
            <TouchableOpacity key={defect.id} className="mb-3" onPress={() => router.push(`/defects/${defect.id}`)}>
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <ThemedText className="font-semibold text-base mb-1">
                      {defect.title}
                    </ThemedText>
                    {defect.location && (
                      <ThemedText className="text-sm text-gray-500 mb-1">
                        {defect.location}
                      </ThemedText>
                    )}
                    <View className="flex-row items-center mt-1">
                      <Badge
                        label={defect.severity}
                        variant={
                          defect.severity === "critical"
                            ? "danger"
                            : defect.severity === "major"
                            ? "warning"
                            : "info"
                        }
                        className="mr-2"
                      />
                      <Badge label={defect.status} variant="default" />
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
