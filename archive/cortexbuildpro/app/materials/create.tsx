import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";
import { useMaterialStore } from "@/stores/materialStore";

export default function CreateMaterialScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addMaterial } = useMaterialStore();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState<"ordered" | "delivered" | "in_stock" | "used">("ordered");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const statuses: { label: string; value: typeof status }[] = [
    { label: "Ordered", value: "ordered" },
    { label: "Delivered", value: "delivered" },
    { label: "In Stock", value: "in_stock" },
    { label: "Used", value: "used" },
  ];

  function handleCreate() {
    setError("");
    if (!name.trim()) {
      setError("Material name is required");
      return;
    }

    setLoading(true);
    const newMaterial = {
      id: `m${Date.now()}`,
      projectId: "project1",
      name: name.trim(),
      category: category.trim() || "General",
      description: undefined as string | undefined,
      quantity: quantity ? parseFloat(quantity) : 0,
      unit: unit.trim() || "pcs",
      status,
      deliveryDate: deliveryDate.trim() || undefined,
      supplier: supplier.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addMaterial(newMaterial);
    setLoading(false);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <Header title="New Material" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText variant="body" color="secondary" className="mb-4">
          Add a new material or supply item to the project.
        </ThemedText>

        <Input
          label="Material Name *"
          placeholder="e.g. Portland Cement"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Category"
          placeholder="e.g. Cement, Steel, Timber"
          value={category}
          onChangeText={setCategory}
        />
        <Input
          label="Quantity"
          placeholder="e.g. 50"
          keyboardType="numeric"
          value={quantity}
          onChangeText={setQuantity}
        />
        <Input
          label="Unit"
          placeholder="e.g. bags, kg, m²"
          value={unit}
          onChangeText={setUnit}
        />
        <Input
          label="Supplier"
          placeholder="e.g. BuildSupplies Ltd"
          value={supplier}
          onChangeText={setSupplier}
        />
        <Input
          label="Delivery Date"
          placeholder="YYYY-MM-DD"
          value={deliveryDate}
          onChangeText={setDeliveryDate}
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
          title="Create Material"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleCreate}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
