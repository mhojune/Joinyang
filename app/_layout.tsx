import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Stack, useRouter, useSegments } from "expo-router";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoadingUser } = useAuth();
  const segments = useSegments();

  React.useEffect(() => {
    const first =
      Array.isArray(segments) && segments.length > 0 ? String(segments[0]) : "";
    const inAuthGroup = first === "auth";
    if (!user && !inAuthGroup && !isLoadingUser) {
      router.replace("/auth" as any);
    } else if (user && inAuthGroup && !isLoadingUser) {
      router.replace("/" as any);
    }
  }, [user, isLoadingUser, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SafeAreaProvider>
          <RouteGuard>
            <Stack>
              <Stack.Screen name="auth" options={{ headerShown: false }} />
            </Stack>
          </RouteGuard>
        </SafeAreaProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
