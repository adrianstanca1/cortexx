import React, { useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { APP_NAME } from "@/constants";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setError("");
    setSuccess(false);

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "cortexbuildpro://auth/reset-password",
      });
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to send reset email");
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
            Reset your password
          </ThemedText>
        </View>

        <Card>
          {success ? (
            <View className="items-center py-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.success + "20" }}
              >
                {/* @ts-ignore */}
                <Ionicons name="mail-outline" size={32} color={colors.success} />
              </View>
              <ThemedText variant="h3" className="text-center mb-2">
                Check your inbox
              </ThemedText>
              <ThemedText variant="body" color="secondary" className="text-center mb-6">
                We’ve sent a password reset link to {email}
              </ThemedText>
              <Button
                title="Back to Sign In"
                variant="primary"
                onPress={() => router.replace("/auth/login")}
              />
            </View>
          ) : (
            <>
              <ThemedText variant="body" color="secondary" className="mb-4">
                Enter your email address and we’ll send you a link to reset your password.
              </ThemedText>
              <Input
                label="Email"
                placeholder="you@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              {error ? (
                <ThemedText variant="caption" color="danger" className="mb-3">
                  {error}
                </ThemedText>
              ) : null}
              <Button
                title="Send Reset Link"
                variant="primary"
                size="lg"
                loading={loading}
                onPress={handleReset}
                className="mb-3"
              />
              <View className="flex-row justify-center">
                <ThemedText variant="body" color="secondary">
                  Remember your password?{" "}
                </ThemedText>
                <Link href="/auth/login" asChild>
                  <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600" }}>
                    Sign In
                  </ThemedText>
                </Link>
              </View>
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
