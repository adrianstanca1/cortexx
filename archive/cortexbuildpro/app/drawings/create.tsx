import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useDrawingStore } from "@/stores/drawingStore";

export default function CreateDrawingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addDrawing } = useDrawingStore();

  const [name, setName] = useState("");
  const [drawingNumber, setDrawingNumber] = useState("");
  const [discipline, setDiscipline] = useState<"architectural" | "structural" | "mechanical" | "electrical" | "plumbing" | "civil" | "landscape">("architectural");
  const [revision, setRevision] = useState("");
  const [revisionDate, setRevisionDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const disciplines: { label: string; value: typeof discipline }[] = [
    { label: "Architectural", value: "architectural" },
    { label: "Structural", value: "structural" },
    { label: "Mechanical", value: "mechanical" },
    { label: "Electrical", value: "electrical" },
    { label: "Plumbing", value: "plumbing" },
    { label: "Civil", value: "civil" },
    { label: "Landscape", value: "landscape" },
  ];

  function handleCreate() {
    setError("");
    if (!name.trim()) {
      setError("Drawing name is required");
      return;
    }
    if (!drawingNumber.trim()) {
      setError("Drawing number is required");
      return;
    }

    setLoading(true);
    const newDrawing = {
      id: `dr${Date.now()}`,
      projectId: "project1",
      name: name.trim(),
      drawingNumber: drawingNumber.trim(),
      discipline,
      revision: revision.trim() || "A",
      revisionDate: revisionDate.trim() || new Date().toISOString().split("T")[0],
      status: "current" as const,
      uploadedBy: "user1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addDrawing(newDrawing);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Drawing" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Register a new drawing revision.
        </ThemedText>

        <Input
          label="Drawing Name *"
          placeholder="e.g. Ground Floor Plan"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Drawing Number *"
          placeholder="e.g. A-101"
          value={drawingNumber}
          onChangeText={setDrawingNumber}
        />
        <Input
          label="Revision"
          placeholder="e.g. A"
          value={revision}
          onChangeText={setRevision}
        />
        <Input
          label="Revision Date"
          placeholder="YYYY-MM-DD"
          value={revisionDate}
          onChangeText={setRevisionDate}
        />

        <ThemedText variant="label" color="secondary" className="mb-2">
          Discipline
        </ThemedText>
        <View className="flex-row flex-wrap mb-4">
          {disciplines.map((d) => (
            <TouchableOpacity
              key={d.value}
              onPress={() => setDiscipline(d.value)}
              className="mr-2 mb-2 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: discipline === d.value ? colors.primary : colors.surfaceHighlight,
              }}
            >
              <ThemedText
                variant="body"
                style={{
                  color: discipline === d.value ? "#fff" : colors.text,
                  fontWeight: discipline === d.value ? "600" : "400",
                }}
              >
                {d.label}
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
          title="Create Drawing"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
