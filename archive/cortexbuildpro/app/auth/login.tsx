import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Link, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME } from "@/constants";

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <View
            className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: colors.primary }}
          >
            <ThemedText variant="h1" style={{ color: "#fff" }}>
              CB
            </ThemedText>
          </View>
          <ThemedText variant="h1">{APP_NAME}</ThemedText>
          <ThemedText variant="body" color="secondary" className="text-center mt-1">
            Sign in to your account
          </ThemedText>
        </View>

        <Card>
          <Input
            label="Email"
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <ThemedText variant="caption" color="danger" className="mb-3">
              {error}
            </ThemedText>
          ) : null}
          <View className="flex-row justify-end mb-3">
            <Link href="/auth/forgot-password" asChild>
              <ThemedText variant="caption" style={{ color: colors.primary, fontWeight: "500" }}>
                Forgot Password?
              </ThemedText>
            </Link>
          </View>
          <Button
            title="Sign In"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleLogin}
            className="mb-3"
          />
          <View className="flex-row justify-center">
            <ThemedText variant="body" color="secondary">
              Don’t have an account?{" "}
            </ThemedText>
            <Link href="/auth/signup" asChild>
              <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600" }}>
                Sign Up
              </ThemedText>
            </Link>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
