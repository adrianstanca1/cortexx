import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { APP_NAME, APP_VERSION } from "@/constants";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuthStore();
  const { signOut } = useAuth();

  const menuItems = [
    { icon: "person-outline", label: "Profile", href: "/settings/profile" },
    { icon: "business-outline", label: "Organisation", href: "/settings/org" },
    { icon: "notifications-outline", label: "Notifications", href: "/settings/notifications" },
    { icon: "lock-closed-outline", label: "Security", href: "/settings/security" },
    { icon: "help-circle-outline", label: "Help & Support", href: "/settings/support" },
    { icon: "document-text-outline", label: "Terms & Privacy", href: "/settings/legal" },
  ];

  if (isAdmin) {
    menuItems.unshift({ icon: "shield-outline", label: "Admin Dashboard", href: "/admin" });
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Settings" showBack={false} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {user && (
          <Card className="mx-4 mt-4 mb-4">
            <View className="flex-row items-center">
              <Avatar
                name={user.fullName ?? user.email}
                imageUrl={user.avatarUrl}
                size="lg"
              />
              <View className="ml-4 flex-1">
                <ThemedText variant="h3" numberOfLines={1}>
                  {user.fullName ?? "User"}
                </ThemedText>
                <ThemedText variant="body" color="secondary" numberOfLines={1}>
                  {user.email}
                </ThemedText>
                <View className="mt-1">
                  <ThemedText
                    variant="caption"
                    style={{
                      color: colors.primary,
                      textTransform: "capitalize",
                      fontWeight: "500",
                    }}
                  >
                    {user.role}
                  </ThemedText>
                </View>
              </View>
            </View>
          </Card>
        )}

        <Card className="mx-4 mb-4">
          <ThemedText variant="label" color="secondary" className="mb-3">
            Appearance
          </ThemedText>
          <ThemeToggle />
        </Card>

        <Card className="mx-4 mb-4">
          <ThemedText variant="label" color="secondary" className="mb-1">
            Account
          </ThemedText>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.href as any)}
              className={`flex-row items-center py-3 ${
                i < menuItems.length - 1 ? "border-b" : ""
              }`}
              style={{
                borderBottomColor: colors.border,
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
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </Card>

        <View className="mx-4 mt-2 mb-6">
          <Button
            title="Sign Out"
            variant="outline"
            onPress={signOut}
          />
        </View>

        <View className="items-center">
          <ThemedText variant="caption" color="secondary">
            {APP_NAME} v{APP_VERSION}
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}
