import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useRFIStore } from "@/stores/rfiStore";

export default function CreateRFIScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addRFI } = useRFIStore();

  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const priorities: { label: string; value: "low" | "medium" | "high" | "urgent" }[] = [
    { label: "Low", value: "low" },
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
    { label: "Urgent", value: "urgent" },
  ];

  function handleCreate() {
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!number.trim()) {
      setError("RFI number is required");
      return;
    }

    setLoading(true);
    const newRFI = {
      id: `rfi${Date.now()}`,
      projectId: "project1",
      number: number.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      status: "draft" as const,
      priority,
      submittedBy: "user1",
      dueDate: dueDate.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addRFI(newRFI);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New RFI" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Raise a Request for Information to clarify design or specification queries.
        </ThemedText>

        <Input
          label="RFI Number *"
          placeholder="e.g. RFI-001"
          value={number}
          onChangeText={setNumber}
        />
        <Input
          label="Title *"
          placeholder="e.g. Foundation depth clarification"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description"
          placeholder="Detailed question or query"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          style={{ height: 100, textAlignVertical: "top" }}
        />
        <Input
          label="Due Date"
          placeholder="YYYY-MM-DD"
          value={dueDate}
          onChangeText={setDueDate}
        />

        <ThemedText variant="label" color="secondary" className="mb-2">
          Priority
        </ThemedText>
        <View className="flex-row flex-wrap mb-4">
          {priorities.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPriority(p.value)}
              className="mr-2 mb-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: priority === p.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="body"
                style={{
                  color: priority === p.value ? "#fff" : colors.text,
                  fontWeight: priority === p.value ? "600" : "400",
                }}
              >
                {p.label}
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
          title="Create RFI"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
