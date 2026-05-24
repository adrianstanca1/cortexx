import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useSafetyStore } from "@/stores/safetyStore";

export default function CreateSafetyIncidentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addIncident } = useSafetyStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [severity, setSeverity] = useState<"near_miss" | "minor" | "major" | "critical">("near_miss");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const severities: { label: string; value: "near_miss" | "minor" | "major" | "critical" }[] = [
    { label: "Near Miss", value: "near_miss" },
    { label: "Minor", value: "minor" },
    { label: "Major", value: "major" },
    { label: "Critical", value: "critical" },
  ];

  function handleCreate() {
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);
    const newIncident = {
      id: `si${Date.now()}`,
      projectId: "project1",
      title: title.trim(),
      description: description.trim() || undefined,
      severity,
      status: "open" as const,
      reportedBy: reportedBy.trim() || "user1",
      createdAt: new Date().toISOString(),
    };

    addIncident(newIncident as any);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Safety Incident" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Report a new safety incident or near-miss event.
        </ThemedText>

        <Input
          label="Title *"
          placeholder="e.g. Unsecured scaffolding on Block B"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description"
          placeholder="What happened? Include time, location, and witnesses"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          style={{ height: 100, textAlignVertical: "top" }}
        />
        <Input
          label="Reported By"
          placeholder="e.g. Site Manager"
          value={reportedBy}
          onChangeText={setReportedBy}
        />

        <ThemedText variant="label" color="secondary" className="mb-2">
          Severity
        </ThemedText>
        <View className="flex-row flex-wrap mb-4">
          {severities.map((s) => (
            <TouchableOpacity
              key={s.value}
              onPress={() => setSeverity(s.value)}
              className="mr-2 mb-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: severity === s.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="body"
                style={{
                  color: severity === s.value ? "#fff" : colors.text,
                  fontWeight: severity === s.value ? "600" : "400",
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
          title="Report Incident"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
