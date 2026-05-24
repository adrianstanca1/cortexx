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
import { useRFIStore } from "@/stores/rfiStore";

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Responded", value: "responded" },
  { label: "Closed", value: "closed" },
];

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export default function RFIsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { rfis } = useRFIStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = rfis.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.number.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || r.status === filter;
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
          RFIs
        </ThemedText>
        <Input
          placeholder="Search RFIs..."
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2"
        >
          {statusFilters.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              className={`mr-2 px-3 py-1.5 rounded-full ${
                filter === f.value
                  ? "bg-blue-600"
                  : "bg-gray-200"
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="document-text"
            title="No RFIs"
            subtitle="Create your first Request for Information."
          />
        ) : (
          filtered.map((rfi) => (
            <TouchableOpacity
              key={rfi.id}
              onPress={() => router.push(`/rfi/${rfi.id}`)}
              className="mb-3"
            >
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <ThemedText className="text-xs font-medium text-gray-500 mr-2">
                        {rfi.number}
                      </ThemedText>
                      <Badge
                        label={rfi.priority}
                        className={priorityColors[rfi.priority] || "bg-gray-100"}
                      />
                    </View>
                    <ThemedText className="font-semibold text-base mb-1" numberOfLines={2}>
                      {rfi.title}
                    </ThemedText>
                    <View className="flex-row items-center">
                      <Badge
                        label={rfi.status}
                        variant={
                          rfi.status === "closed"
                            ? "success"
                            : rfi.status === "submitted"
                            ? "warning"
                            : "default"
                        }
                        className="mr-2"
                      />
                      {rfi.dueDate && (
                        <ThemedText className="text-xs text-gray-400">
                          Due {new Date(rfi.dueDate).toLocaleDateString()}
                        </ThemedText>
                      )}
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
        onPress={() => router.push("/rfi/create")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
