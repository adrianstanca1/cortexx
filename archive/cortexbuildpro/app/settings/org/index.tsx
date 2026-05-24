import React from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useOrganisationStore } from "@/stores/organisationStore";

export default function OrgSettingsScreen() {
  const { colors } = useTheme();
  const org = useOrganisationStore((s) => s.org);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Organisation" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary">Name</ThemedText>
          <ThemedText variant="body">{org?.name ?? "—"}</ThemedText>
        </Card>
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary">Slug</ThemedText>
          <ThemedText variant="body">{org?.slug ?? "—"}</ThemedText>
        </Card>
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary">Plan</ThemedText>
          <ThemedText variant="body" style={{ textTransform: "capitalize" }}>
            {org?.plan ?? "free"}
          </ThemedText>
        </Card>
      </ScrollView>
    </View>
  );
}
