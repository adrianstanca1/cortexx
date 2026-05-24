import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useTaskStore } from "@/stores/taskStore";
import { useProjectStore } from "@/stores/projectStore";

export default function CreateTaskScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addTask } = useTaskStore();
  const { projects } = useProjectStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    setError("");
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    setLoading(true);
    const newTask = {
      id: `t${Date.now()}`,
      projectId: projects[0]?.id ?? "p1",
      title: title.trim(),
      description: description.trim() || undefined,
      status: "todo" as const,
      priority,
      dueDate: dueDate.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addTask(newTask);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Task" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Add a new task to track progress within a project.
        </ThemedText>

        <Input
          label="Task Title *"
          placeholder="e.g. Foundation pour"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Description"
          placeholder="What needs to be done?"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Input
          label="Due Date (YYYY-MM-DD)"
          placeholder="2026-12-31"
          value={dueDate}
          onChangeText={setDueDate}
        />

        <View className="mb-4">
          <ThemedText variant="label" color="secondary" className="mb-2">
            Priority
          </ThemedText>
          <View className="flex-row flex-wrap">
            {(["low", "medium", "high", "critical"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                className="mr-2 mb-2 px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: priority === p ? colors.primary : colors.surfaceHighlight,
                }}
              >
                <ThemedText
                  variant="body"
                  style={{
                    color: priority === p ? "#fff" : colors.text,
                    fontWeight: priority === p ? "600" : "400",
                    textTransform: "capitalize",
                  }}
                >
                  {p}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? (
          <ThemedText variant="caption" color="danger" className="mb-3">
            {error}
          </ThemedText>
        ) : null}

        <Button
          title="Create Task"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
