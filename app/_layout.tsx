import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/engine/settings';
import { ProgressProvider } from '@/engine/progress';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { RegiePubProvider } from '@/pub/regie';

function Navigator() {
  const { c, name } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="game/[id]" />
        <Stack.Screen name="reglages" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ProgressProvider>
            <ThemeProvider>
              {/* La régie enveloppe la navigation : la bannière du catalogue
                  et l'interstitiel de sortie de jeu en dépendent tous deux. */}
              <RegiePubProvider>
                <Navigator />
              </RegiePubProvider>
            </ThemeProvider>
          </ProgressProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
