import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// React Native Web's Alert is a literal no-op (`class Alert { static alert() {} }`).
// On web we surface state inline so the user actually sees what happened;
// native still uses Alert.alert because that's where it works.
const IS_WEB = Platform.OS === "web";

export default function ChangePasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState(false);

  const changePasswordMutation = trpc.auth.changePassword.useMutation();

  function showError(title: string, body: string) {
    if (IS_WEB) setInlineError(`${title}: ${body}`);
    else Alert.alert(title, body);
  }

  const submit = async () => {
    setInlineError(null);
    if (!currentPassword) {
      showError("Missing details", "Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      showError("Password too short", "Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Passwords don't match", "The new password and confirmation must match.");
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
      // Success: native gets the dialog (Alert.alert works there); web
      // gets an inline success banner. Both paths call router.back() so
      // the user returns to wherever they came from (typically Settings).
      if (IS_WEB) {
        setInlineSuccess(true);
        // Defer the back-navigation so the success banner has a beat to
        // render before the screen unmounts. 800ms is short enough not
        // to feel laggy and long enough to actually be readable.
        setTimeout(() => router.back(), 800);
        return;
      }
      Alert.alert("Password updated", "Sign in again with your new password next time.");
      router.back();
    } catch (error: any) {
      showError("Couldn't change password", error?.message ?? "Something went wrong. Try again.");
    }
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.headerCard, { backgroundColor: "#1E3A5F" }]}>
            <Text style={styles.headerTitle}>Change password</Text>
            <Text style={styles.headerSub}>
              Pick a new password — at least 8 characters.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={[styles.label, { color: colors.muted }]}>Current password</Text>
            <View
              style={[
                styles.input,
                styles.passwordWrap,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="current-password"
                editable={!changePasswordMutation.isPending}
                placeholder="Your current password"
                placeholderTextColor={colors.muted}
                style={[styles.passwordInput, { color: colors.foreground }]}
              />
              <Pressable
                onPress={() => setShowCurrent(s => !s)}
                hitSlop={12}
                accessibilityLabel={showCurrent ? "Hide password" : "Show password"}
              >
                <IconSymbol
                  name={showCurrent ? "eye.slash" : "eye"}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>New password</Text>
            <View
              style={[
                styles.input,
                styles.passwordWrap,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                editable={!changePasswordMutation.isPending}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.muted}
                style={[styles.passwordInput, { color: colors.foreground }]}
              />
              <Pressable
                onPress={() => setShowNew(s => !s)}
                hitSlop={12}
                accessibilityLabel={showNew ? "Hide password" : "Show password"}
              >
                <IconSymbol
                  name={showNew ? "eye.slash" : "eye"}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>Confirm new password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              editable={!changePasswordMutation.isPending}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.muted}
              onSubmitEditing={submit}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
            />

            {inlineError && (
              <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorBannerText}>{inlineError}</Text>
              </View>
            )}
            {inlineSuccess && (
              <View style={styles.successBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.successBannerText}>
                  Password updated. Sign in again with your new password next time.
                </Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={changePasswordMutation.isPending}
              style={[
                styles.submitBtn,
                { backgroundColor: "#F97316", opacity: changePasswordMutation.isPending ? 0.6 : 1 },
              ]}
            >
              {changePasswordMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Update password</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={changePasswordMutation.isPending}
              style={{ marginTop: 16, alignItems: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  headerCard: {
    borderRadius: 16,
    padding: 24,
    gap: 6,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  headerSub: { color: "#CBD5E1", fontSize: 14 },
  formCard: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    paddingRight: 8,
  },
  submitBtn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  divider: { height: 1, marginVertical: 24 },
  errorBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBannerText: {
    color: "#991B1B",
    fontSize: 13,
    lineHeight: 18,
  },
  successBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successBannerText: {
    color: "#065F46",
    fontSize: 13,
    lineHeight: 18,
  },
});
