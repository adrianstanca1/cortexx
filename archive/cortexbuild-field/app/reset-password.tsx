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
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// React Native Web's Alert is a no-op (`class Alert { static alert() {} }`)
// — modal dialogs never render and the OK-button callback never fires.
// On web we surface confirmations + errors inline; on native we still use
// the native dialog because that's where Alert actually works.
const IS_WEB = Platform.OS === "web";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Inline error replaces Alert.alert for validation + server failures
  // on web (where the alert is a silent no-op). On native we still raise
  // the native dialog as before. Cleared on each new submit.
  const [inlineError, setInlineError] = useState<string | null>(null);
  // Stale-token state: when the server returns BAD_REQUEST (token expired
  // or tampered with), we surface the message AND a "request a fresh link"
  // CTA. Tracking this in component state rather than re-reading the
  // mutation error each render means the CTA persists even if the user
  // edits the inputs after seeing the error.
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const resetMutation = trpc.auth.resetPasswordWithToken.useMutation();

  function showError(title: string, body: string) {
    if (IS_WEB) {
      setInlineError(`${title}: ${body}`);
    } else {
      Alert.alert(title, body);
    }
  }

  // Missing/empty token → show the error card, no form. The token is the
  // only authentication this flow has; without it we can't proceed.
  if (!token || token.trim().length === 0) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.headerCard, { backgroundColor: "#1E3A5F" }]}>
            <Text style={styles.headerTitle}>Reset link invalid</Text>
            <Text style={styles.headerSub}>
              The reset link couldn&apos;t be opened.
            </Text>
          </View>
          <View style={styles.formCard}>
            <Text style={[styles.errorText, { color: colors.foreground }]}>
              Reset link is missing or malformed. Request a new one.
            </Text>
            <Pressable
              onPress={() => router.replace("/forgot-password" as any)}
              style={[styles.submitBtn, { backgroundColor: "#F97316" }]}
            >
              <Text style={styles.submitBtnText}>Request a fresh link</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const submit = async () => {
    setInlineError(null);
    if (newPassword.length < 8) {
      showError("Password too short", "Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Passwords don't match", "The new password and confirmation must match.");
      return;
    }
    try {
      await resetMutation.mutateAsync({ token, newPassword });
      // Success path: redirect immediately to /login. The dialog-based
      // "OK → redirect" flow we used before silently dropped the user on
      // web, because RN Web's Alert is a literal no-op (`class Alert {
      // static alert() {} }`). On native the dialog is still useful, so
      // raise it there and let its OK button drive the same navigation.
      if (IS_WEB) {
        router.replace("/login" as any);
        return;
      }
      Alert.alert(
        "Password reset",
        "Sign in with your new password.",
        [{ text: "OK", onPress: () => router.replace("/login" as any) }],
      );
    } catch (error: any) {
      const code = error?.data?.code;
      if (code === "BAD_REQUEST") {
        setTokenInvalid(true);
      }
      showError(
        "Couldn't reset password",
        error?.message ?? "The reset link may have expired. Request a new one.",
      );
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
            <Text style={styles.headerTitle}>Reset your password</Text>
            <Text style={styles.headerSub}>
              Pick a new password — at least 8 characters.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={[styles.label, { color: colors.muted }]}>New password</Text>
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
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                editable={!resetMutation.isPending}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.muted}
                style={[styles.passwordInput, { color: colors.foreground }]}
              />
              <Pressable
                onPress={() => setShowPassword(s => !s)}
                hitSlop={12}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <IconSymbol
                  name={showPassword ? "eye.slash" : "eye"}
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
              editable={!resetMutation.isPending}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.muted}
              onSubmitEditing={submit}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
            />

            {inlineError && (
              <View
                style={styles.errorBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.errorBannerText}>{inlineError}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={resetMutation.isPending}
              style={[
                styles.submitBtn,
                { backgroundColor: "#F97316", opacity: resetMutation.isPending ? 0.6 : 1 },
              ]}
            >
              {resetMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Reset password</Text>
              )}
            </Pressable>

            {tokenInvalid && (
              <Pressable
                onPress={() => router.replace("/forgot-password" as any)}
                disabled={resetMutation.isPending}
                style={{ marginTop: 16, alignItems: "center" }}
              >
                <Text style={{ color: "#F97316", fontSize: 13, fontWeight: "600" }}>
                  Request a fresh link
                </Text>
              </Pressable>
            )}
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
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
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
});
