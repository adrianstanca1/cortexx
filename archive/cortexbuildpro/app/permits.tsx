import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { usePermitStore } from "@/stores/permitStore";

export default function PermitsScreen() {
  const { colors } = useTheme();
  const { permits } = usePermitStore();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Permits</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-1">
          {permits.length} permits
        </ThemedText>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {permits.length === 0 ? (
          <EmptyState
            icon="document-text"
            title="No Permits"
            subtitle="Planning permits and approvals will appear here."
          />
        ) : (
          permits.map((permit) => (
            <TouchableOpacity key={permit.id} className="mb-3">
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <ThemedText className="font-semibold text-base mb-1">
                      {permit.type}
                    </ThemedText>
                    <ThemedText className="text-sm text-gray-500 mb-1">
                      {permit.permitNumber} · {permit.authority}
                    </ThemedText>
                    <View className="flex-row items-center mt-1">
                      <Badge
                        label={permit.status}
                        variant={
                          permit.status === "approved"
                            ? "success"
                            : permit.status === "rejected"
                            ? "danger"
                            : permit.status === "expired"
                            ? "warning"
                            : "info"
                        }
                      />
                    </View>
                    {permit.expiryDate && (
                      <ThemedText className="text-xs text-gray-400 mt-2">
                        Expires: {new Date(permit.expiryDate).toLocaleDateString()}
                      </ThemedText>
                    )}
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
