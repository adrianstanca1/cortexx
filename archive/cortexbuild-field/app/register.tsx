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

export default function RegisterScreen() {
  const colors = useColors();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const registerMutation = trpc.auth.register.useMutation();

  function showError(title: string, body: string) {
    if (IS_WEB) setInlineError(`${title}: ${body}`);
    else Alert.alert(title, body);
  }

  const submit = async () => {
    setInlineError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      showError("Missing name", "Enter your name.");
      return;
    }
    if (trimmedName.length > 255) {
      showError("Name too long", "Names must be 255 characters or fewer.");
      return;
    }
    if (!trimmedEmail) {
      showError("Missing email", "Enter your email address.");
      return;
    }
    if (password.length < 8) {
      showError("Password too short", "Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      showError("Passwords don't match", "The password and confirmation must match.");
      return;
    }
    try {
      await registerMutation.mutateAsync({ email: trimmedEmail, password, name: trimmedName });
      // Success: redirect to /login. On native we still surface the dialog
      // so the OK tick is explicit; on web Alert.alert is a no-op so we
      // navigate directly.
      if (IS_WEB) {
        router.replace("/login" as any);
        return;
      }
      Alert.alert(
        "Account created",
        "Sign in with your new credentials.",
        [{ text: "OK", onPress: () => router.replace("/login" as any) }],
      );
    } catch (error: any) {
      const code = error?.data?.code;
      if (code === "FORBIDDEN") {
        showError("Registration not available", error?.message ?? "Self-registration is currently disabled.");
      } else if (code === "CONFLICT") {
        showError(
          "Email already registered",
          "That email is already registered. Sign in or reset your password.",
        );
      } else {
        showError("Couldn't create account", error?.message ?? "Something went wrong. Try again.");
      }
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
            <Text style={styles.headerTitle}>Create your account</Text>
            <Text style={styles.headerSub}>
              Sign up to get started with CortexBuild Field.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={[styles.label, { color: colors.muted }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              editable={!registerMutation.isPending}
              placeholder="Your full name"
              placeholderTextColor={colors.muted}
              maxLength={255}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
            />

            <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!registerMutation.isPending}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
            />

            <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>Password</Text>
            <View
              style={[
                styles.input,
                styles.passwordWrap,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                autoComplete="password-new"
                editable={!registerMutation.isPending}
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

            <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              editable={!registerMutation.isPending}
              placeholder="Re-enter password"
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
              disabled={registerMutation.isPending}
              style={[
                styles.submitBtn,
                { backgroundColor: "#F97316", opacity: registerMutation.isPending ? 0.6 : 1 },
              ]}
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create account</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.replace("/login" as any)}
              disabled={registerMutation.isPending}
              style={{ marginTop: 16, alignItems: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Already have an account? <Text style={{ color: "#F97316", fontWeight: "600" }}>Sign in</Text>
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
});
