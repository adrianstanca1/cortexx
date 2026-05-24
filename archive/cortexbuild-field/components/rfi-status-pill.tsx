import React from "react";
import { Text, View, StyleSheet } from "react-native";
import type { RfiStatus } from "@/lib/rfi-actions";

const COLOURS: Record<RfiStatus, { bg: string; fg: string; label: string }> = {
  submitted: { bg: "#FEF3C7", fg: "#92400E", label: "Submitted" },
  answered:  { bg: "#DBEAFE", fg: "#1E40AF", label: "Answered" },
  approved:  { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  rejected:  { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
};

export function RfiStatusPill({ status }: { status: RfiStatus }) {
  const c = COLOURS[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  label: { fontSize: 12, fontWeight: "600" },
});
