import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useTeamStore } from "@/stores/teamStore";

export default function CreateTeamMemberScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addMember } = useTeamStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "foreman" | "worker">("worker");
  const [trade, setTrade] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const roles: { label: string; value: typeof role }[] = [
    { label: "Admin", value: "admin" },
    { label: "Manager", value: "manager" },
    { label: "Foreman", value: "foreman" },
    { label: "Worker", value: "worker" },
  ];

  function handleCreate() {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    const newMember = {
      id: `tm${Date.now()}`,
      orgId: "org1",
      userId: `u${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      role,
      trade: trade.trim() || undefined,
    };

    addMember(newMember as any);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Team Member" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Add a new team member to the project.
        </ThemedText>

        <Input
          label="Full Name *"
          placeholder="e.g. John Smith"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Email *"
          placeholder="e.g. john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Phone"
          placeholder="e.g. +44 7700 900123"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Input
          label="Trade"
          placeholder="e.g. Electrician, Carpenter"
          value={trade}
          onChangeText={setTrade}
        />

        <ThemedText variant="label" color="secondary" className="mb-2">
          Role
        </ThemedText>
        <View className="flex-row flex-wrap mb-4">
          {roles.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setRole(r.value)}
              className="mr-2 mb-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: role === r.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="body"
                style={{
                  color: role === r.value ? "#fff" : colors.text,
                  fontWeight: role === r.value ? "600" : "400",
                }}
              >
                {r.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <ThemedText variant="caption" color="danger" className="mb-3">
            {error}
          </ThemedText>
        ) : null}

        <Button
          title="Add Team Member"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
