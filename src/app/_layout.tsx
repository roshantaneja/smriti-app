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

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  // Keep the native splash up until persisted state has loaded.
  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
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
            name="recipe/new"
            options={{ presentation: 'modal', headerShown: true, title: 'New recipe' }}
          />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: 'Recipe' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
