import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useInvoiceStore } from "@/stores/invoiceStore";

const statusVariants: Record<string, "default" | "warning" | "success" | "danger"> = {
  draft: "default",
  sent: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "default",
};

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const { invoices } = useInvoiceStore();
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold mb-2">
          Invoices
        </ThemedText>
        <View className="flex-row justify-between items-center bg-white rounded-xl p-3 mb-2">
          <View>
            <ThemedText className="text-xs text-gray-500">Outstanding</ThemedText>
            <ThemedText className="text-lg font-bold text-red-600">
              £{totalOutstanding.toLocaleString()}
            </ThemedText>
          </View>
          <View>
            <ThemedText className="text-xs text-gray-500">Total</ThemedText>
            <ThemedText className="text-lg font-bold">
              £{invoices.reduce((s, i) => s + i.total, 0).toLocaleString()}
            </ThemedText>
          </View>
          <View>
            <ThemedText className="text-xs text-gray-500">Count</ThemedText>
            <ThemedText className="text-lg font-bold">{invoices.length}</ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {invoices.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No Invoices"
            subtitle="Create your first invoice."
          />
        ) : (
          invoices.map((invoice) => (
            <TouchableOpacity key={invoice.id} className="mb-3">
              <Card>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <ThemedText className="text-xs font-medium text-gray-500 mr-2">
                        {invoice.invoiceNumber}
                      </ThemedText>
                      <Badge
                        label={invoice.status}
                        variant={statusVariants[invoice.status] || "default"}
                      />
                    </View>
                    <ThemedText className="font-semibold text-base mb-1">
                      {invoice.vendor}
                    </ThemedText>
                    <ThemedText className="text-sm text-gray-500 mb-1">
                      {invoice.description}
                    </ThemedText>
                    <ThemedText className="text-base font-bold">
                      £{invoice.total.toLocaleString()}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
