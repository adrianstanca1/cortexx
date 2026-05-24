import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";

const moreItems = [
  { label: "Defects", icon: "warning-outline", route: "/defects" },
  { label: "Punch Items", icon: "hammer-outline", route: "/punch-items" },
  { label: "Documents", icon: "folder-outline", route: "/documents" },
  { label: "Meetings", icon: "people-circle-outline", route: "/meetings" },
  { label: "Timesheets", icon: "time-outline", route: "/timesheets" },
  { label: "Equipment", icon: "construct-outline", route: "/equipment" },
  { label: "Change Orders", icon: "swap-horizontal-outline", route: "/change-orders" },
  { label: "Permits", icon: "document-text-outline", route: "/permits" },
  { label: "Submittals", icon: "checkmark-circle-outline", route: "/submittals" },
];

export default function MoreScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <ThemedText variant="h3" className="text-xl font-bold">
          More
        </ThemedText>
      </View>

      <ScrollView className="flex-1 px-4">
        {moreItems.map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route as any)}
            className="mb-3"
          >
            <Card>
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-lg bg-blue-100 items-center justify-center mr-3">
                  <Ionicons name={item.icon as any} size={20} color={colors.primary} />
                </View>
                <ThemedText className="flex-1 font-semibold text-base">
                  {item.label}
                </ThemedText>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
