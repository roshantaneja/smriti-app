import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useStore } from '@/lib/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrated = useStore((s) => s._hydrated);
  const hasOnboarded = useStore((s) => s.hasOnboarded);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  // Keep the native splash up until persisted state has loaded, so the
  // onboarding gate reads the real hasOnboarded value (not its default).
  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* First-launch onboarding: shown until the user finishes or skips it. */}
          <Stack.Protected guard={!hasOnboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>

          <Stack.Protected guard={hasOnboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="log-add"
              options={{ presentation: 'modal', headerShown: true, title: 'Add to today' }}
            />
            <Stack.Screen
              name="food/new"
              options={{ presentation: 'modal', headerShown: true, title: 'New ingredient' }}
            />
            <Stack.Screen
              name="food-search"
              options={{ presentation: 'modal', headerShown: true, title: 'Search foods' }}
            />
            <Stack.Screen
              name="scan"
              options={{ presentation: 'modal', headerShown: true, title: 'Scan barcode' }}
            />
            <Stack.Screen
              name="settings"
              options={{ presentation: 'modal', headerShown: true, title: 'Settings' }}
            />
            <Stack.Screen
              name="food/[id]"
              options={{ headerShown: true, title: 'Ingredient' }}
            />
            <Stack.Screen
              name="recipe/new"
              options={{ presentation: 'modal', headerShown: true, title: 'New recipe' }}
            />
            <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: 'Recipe' }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
