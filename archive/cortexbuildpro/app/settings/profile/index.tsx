import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { signOut } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [role] = useState(user?.role ?? "worker");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // TODO: wire to Supabase user metadata update
    setTimeout(() => {
      setSaving(false);
      setIsEditing(false);
    }, 800);
  }

  const infoItems = [
    { icon: "mail-outline", label: "Email", value: email },
    { icon: "call-outline", label: "Phone", value: phone || "Not set" },
    { icon: "briefcase-outline", label: "Role", value: role },
    { icon: "business-outline", label: "Organisation", value: "CortexBuild" },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Profile" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Avatar + Name */}
        <Card className="mb-4 items-center py-6">
          <Avatar
            name={user?.fullName ?? user?.email ?? "User"}
            imageUrl={user?.avatarUrl}
            size="xl"
          />
          {isEditing ? (
            <View className="w-full mt-4">
              <Input
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
              />
              <Input
                label="Phone"
                placeholder="+44 7700 900000"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <View className="flex-row space-x-2">
                <Button
                  title="Cancel"
                  variant="outline"
                  className="flex-1"
                  onPress={() => setIsEditing(false)}
                />
                <Button
                  title="Save"
                  variant="primary"
                  className="flex-1"
                  loading={saving}
                  onPress={handleSave}
                />
              </View>
            </View>
          ) : (
            <>
              <ThemedText variant="h2" className="mt-4">
                {user?.fullName ?? "User"}
              </ThemedText>
              <ThemedText variant="body" color="secondary">
                {user?.email}
              </ThemedText>
              <View className="mt-2 px-3 py-1 rounded-full" style={{ backgroundColor: colors.primary + "15" }}>
                <ThemedText
                  variant="caption"
                  style={{ color: colors.primary, textTransform: "capitalize", fontWeight: "600" }}
                >
                  {role}
                </ThemedText>
              </View>
              <Button
                title="Edit Profile"
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onPress={() => setIsEditing(true)}
              />
            </>
          )}
        </Card>

        {/* Info List */}
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary" className="mb-2">
            Information
          </ThemedText>
          {infoItems.map((item, i) => (
            <View
              key={item.label}
              className={`flex-row items-center py-3 ${i < infoItems.length - 1 ? "border-b" : ""}`}
              style={{ borderBottomColor: colors.border }}
            >
              {/* @ts-ignore */}
              <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
              <View className="ml-3 flex-1">
                <ThemedText variant="caption" color="secondary">
                  {item.label}
                </ThemedText>
                <ThemedText variant="body">{item.value}</ThemedText>
              </View>
            </View>
          ))}
        </Card>

        {/* Actions */}
        <Card className="mb-4">
          <TouchableOpacity
            onPress={() => router.push("/settings/security")}
            className="flex-row items-center py-3 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            {/* @ts-ignore */}
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <ThemedText variant="body" className="flex-1 ml-3">Change Password</ThemedText>
            {/* @ts-ignore */}
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/settings/notifications")}
            className="flex-row items-center py-3"
          >
            {/* @ts-ignore */}
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
            <ThemedText variant="body" className="flex-1 ml-3">Notification Settings</ThemedText>
            {/* @ts-ignore */}
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </Card>

        <View className="mt-2">
          <Button
            title="Sign Out"
            variant="outline"
            onPress={signOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}
