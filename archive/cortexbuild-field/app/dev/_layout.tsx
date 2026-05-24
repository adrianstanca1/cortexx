import { Redirect, Stack } from "expo-router";

/**
 * Dev-only routes (theme lab, etc.). In production builds, deep links to
 * /dev/* should not expose internal tooling — redirect to the main app.
 */
export default function DevLayout() {
  const allow =
    __DEV__ || process.env.EXPO_PUBLIC_DEV_THEME_LAB === "1";

  if (!allow) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="theme-lab" />
    </Stack>
  );
}
