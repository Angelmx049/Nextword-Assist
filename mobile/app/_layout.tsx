import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/src/constants/colors';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor={colors.primary} style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="mc/index" options={{ headerShown: false }} />
        <Stack.Screen name="gemba-ride/index" options={{ headerShown: false }} />
        <Stack.Screen name="checklist/index" options={{ headerShown: false }} />
        <Stack.Screen name="slam/index" options={{ headerShown: false }} />
        <Stack.Screen name="safety/index" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
