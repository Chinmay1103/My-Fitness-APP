import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { TabBar } from '@/components/TabBar';
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
      // Our own floating pill (components/TabBar.tsx); screens pad their content by its height.
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // Screens draw their own titles (see Screen in components/ui.tsx).
        headerShown: false,
        // Slide sideways between tabs, so tapping and swiping (see Screen in components/ui.tsx) feel alike.
        animation: 'shift',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('heart.circle', 'monitor_heart') }} />
      <Tabs.Screen name="sleep" options={{ title: 'Sleep', tabBarIcon: tabIcon('moon.zzz', 'bedtime') }} />
      <Tabs.Screen name="strain" options={{ title: 'Strain', tabBarIcon: tabIcon('bolt.heart', 'bolt') }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: tabIcon('sparkles', 'auto_awesome') }} />
    </Tabs>
  );
}
