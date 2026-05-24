import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Header } from "@/components/Header";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useOrganisationStore, canUseFeature } from "@/stores/organisationStore";
import { EmptyState } from "@/components/EmptyState";

export default function BrandingScreen() {
  const { colors } = useTheme();
  const org = useOrganisationStore((s) => s.org);
  const updateBranding = useOrganisationStore((s) => s.updateBranding);

  const hasAccess = canUseFeature(useOrganisationStore.getState(), "white_label");
  const [primaryColor, setPrimaryColor] = useState(org?.branding?.primaryColor ?? "#0ea5e9");
  const [logoUrl, setLogoUrl] = useState(org?.branding?.logoUrl ?? "");

  if (!hasAccess) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <Header title="White-Label Branding" showBack />
        <EmptyState
          icon="color-palette-outline"
          title="Enterprise Feature"
          subtitle="Upgrade to Enterprise to customise branding"
        />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Header title="Branding" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary">Primary Colour</ThemedText>
          <Input
            value={primaryColor}
            onChangeText={setPrimaryColor}
            placeholder="#0ea5e9"
            className="mt-2"
          />
        </Card>
        <Card className="mb-4">
          <ThemedText variant="label" color="secondary">Logo URL</ThemedText>
          <Input
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://..."
            className="mt-2"
          />
        </Card>
        <Button
          title="Save Changes"
          onPress={() => updateBranding({ primaryColor, logoUrl })}
        />
      </ScrollView>
    </View>
  );
}
