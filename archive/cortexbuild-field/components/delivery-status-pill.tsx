import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Status = "expected" | "delivered" | "rejected" | "cancelled";

const CFG: Record<Status, { bg: string; fg: string; label: string }> = {
  expected:  { bg: "#DBEAFE", fg: "#1D4ED8", label: "Expected" },
  delivered: { bg: "#DCFCE7", fg: "#15803D", label: "Delivered" },
  rejected:  { bg: "#FEE2E2", fg: "#B91C1C", label: "Rejected" },
  cancelled: { bg: "#E5E7EB", fg: "#374151", label: "Cancelled" },
};

export function DeliveryStatusPill({ status }: { status: Status }) {
  const cfg = CFG[status];
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[s.text, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
