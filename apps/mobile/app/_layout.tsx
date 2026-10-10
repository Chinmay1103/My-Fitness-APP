import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/lib/AuthProvider';
import { ScoresProvider } from '@/lib/ScoresProvider';
import { ThemeProvider, useColors } from '@/lib/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Keep the splash screen up until the fonts are ready, so text doesn't flash in the system font.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <Themed>
        <AuthProvider>
          <ScoresProvider>
            {/* Screens draw their own titles (see Screen in components/ui.tsx), so no navigator headers. */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="recovery" options={{ title: 'Recovery' }} />
              <Stack.Screen name="heart-rate" options={{ title: 'Heart rate' }} />
              <Stack.Screen name="health" options={{ title: 'Health data' }} />
              <Stack.Screen name="account" options={{ title: 'Account' }} />
              <Stack.Screen name="live" options={{ title: 'Live heart rate' }} />
              <Stack.Screen name="metric/[key]" options={{ title: 'Metric' }} />
              <Stack.Screen name="activity" options={{ title: 'Activity' }} />
            </Stack>
          </ScoresProvider>
        </AuthProvider>
      </Themed>
    </ThemeProvider>
  );
}

/** Gives the navigator (screen transitions, system bars) the app's light or dark page color. */
function Themed({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const base = colors.scheme === 'light' ? DefaultTheme : DarkTheme;
  return (
    <NavigationTheme
      value={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.background, border: colors.border, text: colors.text } }}>
      <StatusBar style={colors.scheme === 'light' ? 'dark' : 'light'} />
      {children}
    </NavigationTheme>
  );
}
