import React from "react";
import { View, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useInvoiceStore } from "@/stores/invoiceStore";

// Read-only invoice detail. Matches the rest of the detail screens in
// this app (defects/[id], rfi/[id], etc.) — render via the zustand
// store, no mutation UI here yet. Edit/delete flow would be a separate
// follow-up that adds mutators to invoiceStore.

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { invoices } = useInvoiceStore();

  const invoice = invoices.find((i: any) => i.id === id);

  if (!invoice) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="Invoice Not Found" />
        <EmptyState title="Invoice not found" subtitle="This item may have been deleted" />
      </View>
    );
  }

  const statusVariant: "default" | "warning" | "success" | "danger" =
    invoice.status === "paid"
      ? "success"
      : invoice.status === "overdue"
      ? "danger"
      : invoice.status === "draft"
      ? "default"
      : "warning";

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title={invoice.invoiceNumber || "Invoice"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Badge label={invoice.status} variant={statusVariant} />
            {invoice.dueDate && (
              <ThemedText variant="caption" color="secondary">
                Due {String(invoice.dueDate)}
              </ThemedText>
            )}
          </View>
          <ThemedText variant="h2" className="mb-3">
            {invoice.invoiceNumber || `Invoice ${id?.slice(0, 8)}`}
          </ThemedText>
          {invoice.vendor && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Vendor: {invoice.vendor}
              </ThemedText>
            </View>
          )}
          {invoice.amount !== undefined && invoice.amount !== null && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Amount: £{Number(invoice.amount).toLocaleString()}
              </ThemedText>
            </View>
          )}
          {invoice.tax !== undefined && invoice.tax !== null && (
            <View className="flex-row items-center mb-2">
              <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
              <ThemedText variant="body" color="secondary" className="ml-2">
                Tax: £{Number(invoice.tax).toLocaleString()}
              </ThemedText>
            </View>
          )}
          {invoice.description && (
            <View className="mt-3">
              <ThemedText variant="caption" color="secondary" className="mb-1">
                Description
              </ThemedText>
              <ThemedText variant="body">{invoice.description}</ThemedText>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
