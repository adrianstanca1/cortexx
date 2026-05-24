import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useOrganisationStore, selectIsPro, selectIsEnterprise } from "@/stores/organisationStore";

const plans = [
  {
    key: "free" as const,
    name: "Free",
    price: "£0",
    projects: "3",
    team: "5",
    storage: "1GB",
    features: ["Basic project management", "Task tracking", "Safety incidents"],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "£49/mo",
    projects: "20",
    team: "50",
    storage: "10GB",
    features: ["Everything in Free", "Advanced reports", "Subcontractor access", "Priority support"],
  },
  {
    key: "enterprise" as const,
    name: "Enterprise",
    price: "£199/mo",
    projects: "Unlimited",
    team: "Unlimited",
    storage: "100GB",
    features: ["Everything in Pro", "White-label branding", "API access", "SSO & SAML", "Dedicated support"],
  },
];

export default function BillingScreen() {
  const { colors } = useTheme();
  const org = useOrganisationStore((s) => s.org);
  const _isPro = useOrganisationStore(selectIsPro);
  const _isEnterprise = useOrganisationStore(selectIsEnterprise);
  const currentPlan = org?.plan ?? "free";

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Billing & Plan" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <Card key={plan.key} className="mb-4" style={{ borderColor: isCurrent ? colors.primary : colors.border, borderWidth: isCurrent ? 2 : 1 }}>
              <View className="flex-row items-center justify-between mb-2">
                <ThemedText variant="h2">{plan.name}</ThemedText>
                {isCurrent && <Badge label="Current" variant="primary" />}
              </View>
              <ThemedText variant="h1" style={{ color: colors.primary }}>{plan.price}</ThemedText>
              <View className="mt-3">
                <ThemedText variant="body" color="secondary">Projects: {plan.projects}</ThemedText>
                <ThemedText variant="body" color="secondary">Team: {plan.team}</ThemedText>
                <ThemedText variant="body" color="secondary">Storage: {plan.storage}</ThemedText>
              </View>
              <View className="mt-3">
                {plan.features.map((f) => (
                  <ThemedText key={f} variant="caption" color="secondary">• {f}</ThemedText>
                ))}
              </View>
              {!isCurrent && (
                <TouchableOpacity
                  className="mt-4 rounded-lg py-3 items-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  <ThemedText variant="body" style={{ color: "#fff", fontWeight: "600" }}>
                    Upgrade to {plan.name}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
