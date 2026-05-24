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
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// React Native Web's Alert is a literal no-op (`class Alert { static alert() {} }`).
// On web we surface state inline so the user actually sees what happened;
// native still uses Alert.alert because that's where it works.
const IS_WEB = Platform.OS === "web";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation();

  const submit = async () => {
    setInlineError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      const title = "Missing email";
      const body = "Enter the email address on your account.";
      if (IS_WEB) setInlineError(`${title}: ${body}`);
      else Alert.alert(title, body);
      return;
    }
    try {
      await requestResetMutation.mutateAsync({ email: trimmedEmail });
    } catch {
      // Server is supposed to return success even on unknown emails to
      // prevent enumeration. If something legitimately blew up (network /
      // 5xx), still show the reassuring message — we'd rather the user not
      // be able to probe for registered emails by retrying.
    }
    // On web, render the confirmation inline (Alert.alert silently drops
    // and the OK-button onPress callback never fires). On native we keep
    // the dialog because the OK button drives the redirect there.
    if (IS_WEB) {
      setRequestSent(true);
      return;
    }
    Alert.alert(
      "Check your inbox",
      "If that email is registered, you'll receive a reset link shortly. The link is valid for 30 minutes.",
      [{ text: "OK", onPress: () => router.replace("/login" as any) }],
    );
  };

  if (requestSent) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.container}>
          <View style={[styles.headerCard, { backgroundColor: "#1E3A5F" }]}>
            <Text style={styles.headerTitle}>Check your inbox</Text>
            <Text style={styles.headerSub}>
              If {email.trim()} is registered, you&apos;ll receive a reset link
              shortly. The link is valid for 30 minutes.
            </Text>
          </View>
          <View style={styles.formCard}>
            <Pressable
              onPress={() => router.replace("/login" as any)}
              style={[styles.submitBtn, { backgroundColor: "#F97316" }]}
            >
              <Text style={styles.submitBtnText}>Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

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
            <Text style={styles.headerTitle}>Forgot your password?</Text>
            <Text style={styles.headerSub}>
              Enter the email on your account and we&apos;ll send a reset link.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={[styles.label, { color: colors.muted }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!requestResetMutation.isPending}
              placeholder="you@example.com"
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

            <Pressable
              onPress={submit}
              disabled={requestResetMutation.isPending}
              style={[
                styles.submitBtn,
                { backgroundColor: "#F97316", opacity: requestResetMutation.isPending ? 0.6 : 1 },
              ]}
            >
              {requestResetMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Send reset link</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace("/login" as any)}
              disabled={requestResetMutation.isPending}
              style={{ marginTop: 16, alignItems: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                ← Back to sign in
              </Text>
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
});
