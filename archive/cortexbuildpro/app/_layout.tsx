import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function RootLayout() {
  const { resolved } = useTheme();
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "auth";

    if (!user && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="auth/login"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="auth/signup"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="auth/forgot-password"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="project/[id]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="task/[id]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="project/create"
          options={{ animation: "slide_from_right", presentation: "modal" }}
        />
        <Stack.Screen
          name="rfi/[id]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="rfi/create"
          options={{ animation: "slide_from_right", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
    </>
  );
}
