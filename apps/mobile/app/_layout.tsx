import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="check-in" options={{ presentation: "modal", headerTitle: "Check-in", headerShown: true }} />
        <Stack.Screen name="checkout" options={{ presentation: "modal", headerTitle: "Checkout", headerShown: true }} />
        <Stack.Screen name="housekeeping" options={{ presentation: "modal", headerTitle: "Housekeeping", headerShown: true }} />
        <Stack.Screen name="reports" options={{ presentation: "modal", headerTitle: "Reports", headerShown: true }} />
      </Stack>
    </QueryClientProvider>
  );
}
