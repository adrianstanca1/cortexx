import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useSafetyStore } from "@/stores/safetyStore";

export default function SafetyScreen() {
  const { colors } = useTheme();
  const { incidents } = useSafetyStore();

  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold mb-2">
          Safety
        </ThemedText>
        <ThemedText className="text-sm text-gray-500">
          {incidents.length} incidents
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {incidents.length === 0 ? (
          <EmptyState
            icon="shield-checkmark"
            title="No Incidents"
            subtitle="Record safety observations and incidents."
          />
        ) : (
          incidents.map((incident) => (
            <TouchableOpacity key={incident.id} className="mb-3">
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <ThemedText className="font-semibold text-base mb-1">
                      {incident.title}
                    </ThemedText>
                    <ThemedText className="text-sm text-gray-500 mb-2" numberOfLines={2}>
                      {incident.description}
                    </ThemedText>
                    <View className="flex-row items-center">
                      <Badge
                        label={incident.severity}
                        variant={
                          incident.severity === "critical"
                            ? "danger"
                            : incident.severity === "major"
                            ? "warning"
                            : "info"
                        }
                        className="mr-2"
                      />
                      <Badge label={incident.status} variant="default" />
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
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-red-600 items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
