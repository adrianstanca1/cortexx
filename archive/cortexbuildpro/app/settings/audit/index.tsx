import React from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useOrganisationStore, selectIsPro } from "@/stores/organisationStore";

export default function AuditLogScreen() {
  const { colors } = useTheme();
  const isPro = useOrganisationStore(selectIsPro);

  if (!isPro) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Audit Log" showBack />
        <EmptyState
          icon="document-text-outline"
          title="Pro Feature"
          subtitle="Upgrade to Pro to view audit logs"
        />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Audit Log" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card>
          <ThemedText variant="body" color="secondary">
            Audit events will appear here.
          </ThemedText>
        </Card>
      </ScrollView>
    </View>
  );
}
