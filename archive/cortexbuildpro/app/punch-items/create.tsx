import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { usePunchItemStore } from "@/stores/punchItemStore";

export default function CreatePunchItemScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addPunchItem } = usePunchItemStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major" | "critical">("minor");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const severities: { label: string; value: "minor" | "major" | "critical" }[] = [
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
    const newPunchItem = {
      id: `pi${Date.now()}`,
      projectId: "project1",
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      severity,
      status: "open" as const,
      assignedTo: assignedTo.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      createdBy: "user1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addPunchItem(newPunchItem);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Punch Item" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Log a new punch-list item for snagging or close-out.
        </ThemedText>

        <Input
          label="Title *"
          placeholder="e.g. Touch up paint in lobby"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description"
          placeholder="Detailed description"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          style={{ height: 100, textAlignVertical: "top" }}
        />
        <Input
          label="Location"
          placeholder="e.g. Unit 3B, Kitchen"
          value={location}
          onChangeText={setLocation}
        />
        <Input
          label="Assigned To"
          placeholder="e.g. Jane Doe"
          value={assignedTo}
          onChangeText={setAssignedTo}
        />
        <Input
          label="Due Date"
          placeholder="YYYY-MM-DD"
          value={dueDate}
          onChangeText={setDueDate}
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
          title="Create Punch Item"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
