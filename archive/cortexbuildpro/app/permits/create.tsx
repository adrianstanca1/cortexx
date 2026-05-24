import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { usePermitStore } from "@/stores/permitStore";

export default function CreatePermitScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addPermit } = usePermitStore();

  const [permitNumber, setPermitNumber] = useState("");
  const [permitType, setPermitType] = useState("");
  const [authority, setAuthority] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [status, setStatus] = useState<"applied" | "under_review" | "approved" | "rejected" | "expired">("applied");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const statuses: { label: string; value: typeof status }[] = [
    { label: "Applied", value: "applied" },
    { label: "Under Review", value: "under_review" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "Expired", value: "expired" },
  ];

  function handleCreate() {
    setError("");
    if (!permitNumber.trim()) {
      setError("Permit number is required");
      return;
    }
    if (!permitType.trim()) {
      setError("Permit type is required");
      return;
    }
    if (!authority.trim()) {
      setError("Issuing authority is required");
      return;
    }

    setLoading(true);
    const newPermit = {
      id: `pm${Date.now()}`,
      projectId: "project1",
      permitNumber: permitNumber.trim(),
      permitType: permitType.trim(),
      authority: authority.trim(),
      status,
      issueDate: issueDate.trim() || undefined,
      expiryDate: expiryDate.trim() || undefined,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addPermit(newPermit);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Permit" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Record a new planning or building permit.
        </ThemedText>

        <Input
          label="Permit Number *"
          placeholder="e.g. BP-2026-001"
          value={permitNumber}
          onChangeText={setPermitNumber}
        />
        <Input
          label="Permit Type *"
          placeholder="e.g. Building, Demolition, Road Closure"
          value={permitType}
          onChangeText={setPermitType}
        />
        <Input
          label="Issuing Authority *"
          placeholder="e.g. City Council"
          value={authority}
          onChangeText={setAuthority}
        />
        <Input
          label="Description"
          placeholder="Brief description of the permit scope"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Input
          label="Issue Date"
          placeholder="YYYY-MM-DD"
          value={issueDate}
          onChangeText={setIssueDate}
        />
        <Input
          label="Expiry Date"
          placeholder="YYYY-MM-DD"
          value={expiryDate}
          onChangeText={setExpiryDate}
        />

        <ThemedText variant="label" color="secondary" className="mb-2">
          Status
        </ThemedText>
        <View className="flex-row flex-wrap mb-4">
          {statuses.map((s) => (
            <TouchableOpacity
              key={s.value}
              onPress={() => setStatus(s.value)}
              className="mr-2 mb-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: status === s.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="body"
                style={{
                  color: status === s.value ? "#fff" : colors.text,
                  fontWeight: status === s.value ? "600" : "400",
                }}
              >
                {s.label}
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
          title="Create Permit"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
