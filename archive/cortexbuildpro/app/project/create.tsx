import React, { useState } from "react";
import { ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useProjectStore } from "@/stores/projectStore";

export default function CreateProjectScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addProject } = useProjectStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    setError("");
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setLoading(true);
    const newProject = {
      id: `p${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      status: "planning" as const,
      location: address.trim() ? { lat: 0, lng: 0, address: address.trim() } : undefined,
      budget: budget ? parseFloat(budget) : undefined,
      orgId: "org1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addProject(newProject);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Project" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Create a new construction project to start tracking tasks and incidents.
        </ThemedText>

        <Input
          label="Project Name *"
          placeholder="e.g. Downtown Tower"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Description"
          placeholder="Brief project description"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Input
          label="Location Address"
          placeholder="e.g. 123 Main St, London"
          value={address}
          onChangeText={setAddress}
        />
        <Input
          label="Budget (£)"
          placeholder="e.g. 5000000"
          keyboardType="numeric"
          value={budget}
          onChangeText={setBudget}
        />

        {error ? (
          <ThemedText variant="caption" color="danger" className="mb-3">
            {error}
          </ThemedText>
        ) : null}

        <Button
          title="Create Project"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
