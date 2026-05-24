import React, { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTeamStore } from "@/stores/teamStore";

export default function TeamScreen() {
  const { colors: _colors } = useTheme();
  const { members, fetchMembers } = useTeamStore();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">Team</ThemedText>
        <ThemedText className="text-sm text-gray-500 mt-1">{members.length} members</ThemedText>
      </View>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {members.length === 0 ? (
          <EmptyState icon="people" title="No Team Members" subtitle="Add your first team member" />
        ) : (
          members.map((member) => (
            <Card key={member.id} className="mb-3">
              <ThemedText className="font-semibold">{member.name}</ThemedText>
              <ThemedText className="text-sm text-gray-500 mt-1">{member.role}</ThemedText>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
