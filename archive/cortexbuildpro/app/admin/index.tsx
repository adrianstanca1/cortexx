import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import { useOrganisationStore, selectIsPro, selectIsEnterprise, canUseFeature } from "@/stores/organisationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useTaskStore } from "@/stores/taskStore";

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const org = useOrganisationStore((s) => s.org);
  const isPro = useOrganisationStore(selectIsPro);
  const isEnterprise = useOrganisationStore(selectIsEnterprise);

  const { projects } = useProjectStore();
  const { tasks } = useTaskStore();

  if (!user || user.role !== "admin") {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Admin" />
        <EmptyState
          icon="lock-closed-outline"
          title="Access Denied"
          subtitle="Admin access required"
        />
      </View>
    );
  }

  const planLabel = org?.plan ?? "free";
  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === "in_progress").length;

  const menuItems = [
    {
      icon: "business-outline",
      label: "Organisation",
      route: "/settings/org",
      badge: planLabel.toUpperCase(),
    },
    {
      icon: "people-outline",
      label: "Team Members",
      route: "/team",
      badge: undefined,
    },
    {
      icon: "card-outline",
      label: "Billing & Plan",
      route: "/settings/billing",
      badge: isPro ? (isEnterprise ? "Enterprise" : "Pro") : "Free",
    },
    {
      icon: "color-palette-outline",
      label: "White-Label Branding",
      route: "/settings/branding",
      badge: canUseFeature(useOrganisationStore.getState(), "white_label") ? undefined : "Enterprise",
      disabled: !canUseFeature(useOrganisationStore.getState(), "white_label"),
    },
    {
      icon: "shield-checkmark-outline",
      label: "Security Settings",
      route: "/settings/security",
      badge: undefined,
    },
    {
      icon: "document-text-outline",
      label: "Audit Log",
      route: "/settings/audit",
      badge: isPro ? undefined : "Pro",
      disabled: !isPro,
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Admin Dashboard" showBack={true} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Org Card */}
        {org && (
          <Card className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <ThemedText variant="h2">{org.name}</ThemedText>
              <Badge
                label={org.plan}
                variant={
                  org.plan === "enterprise"
                    ? "danger"
                    : org.plan === "pro"
                    ? "primary"
                    : "default"
                }
              />
            </View>
            <ThemedText variant="body" color="secondary">
              {org.slug}.cortexbuild.io
            </ThemedText>
          </Card>
        )}

        {/* Stats */}
        <View className="flex-row mb-4">
          <Card className="flex-1 mx-1">
            <ThemedText variant="caption" color="secondary">
              Projects
            </ThemedText>
            <ThemedText variant="h1">{totalProjects}</ThemedText>
          </Card>
          <Card className="flex-1 mx-1">
            <ThemedText variant="caption" color="secondary">
              Tasks
            </ThemedText>
            <ThemedText variant="h1">{totalTasks}</ThemedText>
          </Card>
          <Card className="flex-1 mx-1">
            <ThemedText variant="caption" color="secondary">
              Active
            </ThemedText>
            <ThemedText variant="h1">{activeTasks}</ThemedText>
          </Card>
        </View>

        {/* Plan Limits */}
        <Card className="mb-4">
          <ThemedText variant="h3" className="mb-2">
            Plan Limits
          </ThemedText>
          <View className="flex-row justify-between py-1">
            <ThemedText variant="body" color="secondary">
              Projects
            </ThemedText>
            <ThemedText variant="body">
              {totalProjects} / {isEnterprise ? "∞" : isPro ? "20" : "3"}
            </ThemedText>
          </View>
          <View className="flex-row justify-between py-1">
            <ThemedText variant="body" color="secondary">
              Team Members
            </ThemedText>
            <ThemedText variant="body">
              — / {isEnterprise ? "∞" : isPro ? "50" : "5"}
            </ThemedText>
          </View>
          <View className="flex-row justify-between py-1">
            <ThemedText variant="body" color="secondary">
              Storage
            </ThemedText>
            <ThemedText variant="body">
              — / {isEnterprise ? "100GB" : isPro ? "10GB" : "1GB"}
            </ThemedText>
          </View>
        </Card>

        {/* Admin Menu */}
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary" className="mb-1">
            Management
          </ThemedText>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              disabled={item.disabled}
              onPress={() => !item.disabled && router.push(item.route as any)}
              className={`flex-row items-center py-3 ${
                i < menuItems.length - 1 ? "border-b" : ""
              }`}
              style={{
                borderBottomColor: colors.border,
                opacity: item.disabled ? 0.4 : 1,
              }}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={colors.textSecondary}
              />
              <ThemedText variant="body" className="flex-1 ml-3">
                {item.label}
              </ThemedText>
              {item.badge && (
                <Badge label={item.badge} variant="default" size="sm" />
              )}
              {!item.disabled && (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              )}
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
