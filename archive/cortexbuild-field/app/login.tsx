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

import * as Api from "@/lib/_core/api";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { notifyAuthRefresh } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

const IS_WEB = Platform.OS === "web";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation();

  function showError(title: string, body: string) {
    if (IS_WEB) setInlineError(`${title}: ${body}`);
    else Alert.alert(title, body);
  }

  // Persist credentials, establish web session if needed, broadcast,
  // navigate. Returns true on success.
  const finalizeSession = async (
    sessionToken: string | undefined,
    user:
      | { id: number; openId: string; name?: string | null; email?: string | null; role: "user" | "admin" }
      | undefined,
  ) => {
    if (Platform.OS !== "web" && sessionToken) {
      await Auth.setSessionToken(sessionToken);
    }
    if (user) {
      await Auth.setUserInfo({
        id: user.id,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: "password",
        lastSignedIn: new Date(),
        role: user.role,
      });
    }
    if (Platform.OS === "web" && sessionToken) {
      const sessionOk = await Api.establishSession(sessionToken);
      if (!sessionOk) {
        // Roll back local user info — without this the client believes
        // it's signed in while the server has no cookie and 401s every
        // subsequent request.
        await Auth.clearUserInfo();
        showError(
          "Sign-in incomplete",
          "The server could not set your browser session. Check EXPO_PUBLIC_API_BASE_URL and that the API allows credentials from this site.",
        );
        return false;
      }
    }
    await notifyAuthRefresh({ silent: true });
    router.replace("/(tabs)" as any);
    return true;
  };

  const submit = async () => {
    setInlineError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showError("Missing details", "Enter both your email address and password.");
      return;
    }
    try {
      const result = await loginMutation.mutateAsync({ email: trimmedEmail, password });
      await finalizeSession(result.sessionToken, result.user ?? undefined);
    } catch (error: any) {
      // The server uses the same error message for "no such email" and
      // "wrong password" to avoid leaking which emails are registered.
      // Surface the message verbatim.
      showError("Sign-in failed", error?.message ?? "Invalid email or password.");
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
            <Text style={styles.headerTitle}>CortexBuild Field</Text>
            <Text style={styles.headerSub}>Sign in with your email and password</Text>
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
              editable={!loginMutation.isPending}
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
                textContentType="password"
                autoComplete="password"
                editable={!loginMutation.isPending}
                placeholder="Your password"
                placeholderTextColor={colors.muted}
                onSubmitEditing={submit}
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

            {inlineError && (
              <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.errorBannerText}>{inlineError}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={loginMutation.isPending}
              style={[
                styles.submitBtn,
                { backgroundColor: "#F97316", opacity: loginMutation.isPending ? 0.6 : 1 },
              ]}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Sign in</Text>
              )}
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable
              onPress={() => startOAuthLogin().catch(() => null)}
              disabled={loginMutation.isPending}
              style={[styles.oauthBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.oauthBtnText, { color: colors.foreground }]}>
                Sign in with Manus OAuth instead
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/forgot-password" as any)}
              style={{ marginTop: 16, alignItems: "center" }}
            >
              <Text style={{ color: "#F97316", fontSize: 13, fontWeight: "600" }}>
                Forgot your password?
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/register" as any)}
              style={{ marginTop: 12, alignItems: "center" }}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Don&apos;t have an account?{" "}
                <Text style={{ color: "#F97316", fontWeight: "600" }}>Sign up</Text>
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
  oauthBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  oauthBtnText: { fontSize: 14, fontWeight: "600" },
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
