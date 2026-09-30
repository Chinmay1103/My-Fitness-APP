import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

type SymbolNames = Extract<SymbolViewProps['name'], object>;

function tabIcon(ios: SymbolNames['ios'], android: SymbolNames['android']) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={{ ios, android, web: android }} tintColor={color} size={26} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenListeners={{ tabPress: tapHaptic }}
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        // Screens draw their own titles (see Screen in components/ui.tsx).
        headerShown: false,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('heart.circle', 'monitor_heart') }} />
      <Tabs.Screen name="sleep" options={{ title: 'Sleep', tabBarIcon: tabIcon('moon.zzz', 'bedtime') }} />
      <Tabs.Screen name="strain" options={{ title: 'Strain', tabBarIcon: tabIcon('bolt.heart', 'bolt') }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: tabIcon('plus.circle', 'add_circle') }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: tabIcon('sparkles', 'auto_awesome') }} />
    </Tabs>
  );
}
