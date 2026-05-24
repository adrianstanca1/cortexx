import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "expo-router";
import { useTeamStore } from "@/stores/teamStore";
import type { TeamMember } from "@/types";

const roleFilters: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "Manager", value: "manager" },
  { label: "Foreman", value: "foreman" },
  { label: "Worker", value: "worker" },
];

export default function TeamScreen() {
  const { colors } = useTheme();
  const _router = useRouter();
  const { members } = useTeamStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = members.filter((m: TeamMember) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.trade?.toLowerCase() ?? "").includes(search.toLowerCase());
    const matchesFilter = filter === "all" || m.role === filter;
    return matchesSearch && matchesFilter;
  });

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  const cscsValid = (expiry?: string) => {
    if (!expiry) return false;
    return new Date(expiry) > new Date();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText variant="h1">Team</ThemedText>
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="person-add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <Input
          placeholder="Search team members..."
          value={search}
          onChangeText={setSearch}
          className="mb-2"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {roleFilters.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              className="mr-2 px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor:
                  filter === f.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="caption"
                style={{
                  color: filter === f.value ? "#fff" : colors.text,
                  fontWeight: filter === f.value ? "600" : "400",
                }}
              >
                {f.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No team members"
            subtitle={
              search || filter !== "all"
                ? "Try adjusting your filters"
                : "Add your first team member"
            }
            actionLabel="Add Member"
          />
        ) : (
          filtered.map((member: TeamMember) => (
            <Card key={member.id} className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <ThemedText variant="body" style={{ color: "#fff", fontWeight: "600" }}>
                        {member.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </ThemedText>
                    </View>
                    <View>
                      <ThemedText variant="h3" numberOfLines={1}>{member.name}</ThemedText>
                      <ThemedText variant="caption" color="secondary">{member.email}</ThemedText>
                    </View>
                  </View>
                </View>
                <Badge
                  label={member.role}
                  variant={
                    member.role === "admin"
                      ? "danger"
                      : member.role === "manager"
                      ? "warning"
                      : member.role === "foreman"
                      ? "primary"
                      : "default"
                  }
                />
              </View>

              <View className="flex-row items-center justify-between mt-1">
                {member.trade && (
                  <View className="flex-row items-center">
                    <Ionicons name="construct-outline" size={14} color={colors.textSecondary} />
                    <ThemedText variant="caption" color="secondary" className="ml-1">
                      {member.trade}
                    </ThemedText>
                  </View>
                )}

                {member.cscsCard && (
                  <View className="flex-row items-center">
                    <Ionicons
                      name="card-outline"
                      size={14}
                      color={cscsValid(member.cscsCard.expiryDate) ? colors.success : colors.danger}
                    />
                    <ThemedText
                      variant="caption"
                      style={{
                        color: cscsValid(member.cscsCard.expiryDate)
                          ? colors.success
                          : colors.danger,
                        marginLeft: 4,
                      }}
                    >
                      CSCS {cscsValid(member.cscsCard.expiryDate) ? "Valid" : "Expired"}
                    </ThemedText>
                  </View>
                )}

                {member.hourlyRate && (
                  <ThemedText variant="caption" color="secondary">
                    £{member.hourlyRate}/hr
                  </ThemedText>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
