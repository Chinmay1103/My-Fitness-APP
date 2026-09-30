import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, type ColorValue } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

type SymbolNames = Extract<SymbolViewProps['name'], object>;

function tabIcon(ios: SymbolNames['ios'], android: SymbolNames['android']) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={{ ios, android, web: android }} tintColor={color} size={26} />
  );
}

/**
 * Tab button without the Android ripple. The default one uses a borderless ripple, which draws a
 * big grey circle spilling above the tab bar on some tabs. The active tab is shown by color only.
 * The dropped props belong to the default button (or to web links) and mean nothing to Pressable.
 */
function TabButton({ ref, href, android_ripple, hoverEffect, pressColor, pressOpacity, ...props }: BottomTabBarButtonProps) {
  return <Pressable {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenListeners={{ tabPress: tapHaptic }}
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        // Same color as the screens, so the bar doesn't read as a separate block; a hairline marks the edge.
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarButton: TabButton,
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
