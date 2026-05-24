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

export default function SignupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError("");
    if (!fullName || !email || !password) {
      setError("All fields are required");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Sign up failed");
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
            Create your account
          </ThemedText>
        </View>

        <Card>
          <Input label="Full Name" placeholder="John Doe" value={fullName} onChangeText={setFullName} />
          <Input
            label="Email"
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Input label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
          <Input
            label="Confirm Password"
            placeholder="••••••••"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />
          {error ? (
            <ThemedText variant="caption" color="danger" className="mb-3">
              {error}
            </ThemedText>
          ) : null}
          <Button
            title="Create Account"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleSignup}
            className="mb-3"
          />
          <View className="flex-row justify-center">
            <ThemedText variant="body" color="secondary">
              Already have an account?{" "}
            </ThemedText>
            <Link href="/auth/login" asChild>
              <ThemedText variant="body" style={{ color: colors.primary, fontWeight: "600" }}>
                Sign In
              </ThemedText>
            </Link>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
