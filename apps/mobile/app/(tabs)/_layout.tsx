import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Easing, useWindowDimensions, type ColorValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { TabBar } from '@/components/TabBar';
import { tapHaptic } from '@/lib/haptics';

type SymbolNames = Extract<SymbolViewProps['name'], object>;

function tabIcon(ios: SymbolNames['ios'], android: SymbolNames['android']) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={{ ios, android, web: android }} tintColor={color} size={26} />
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  return (
    <Tabs
      screenListeners={{ tabPress: tapHaptic }}
      // Our own floating pill (components/TabBar.tsx); screens pad their content by its height.
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // Screens draw their own titles (see Screen in components/ui.tsx).
        headerShown: false,
        // Tabs slide in side by side like pages, so tapping and swiping (see Screen in components/ui.tsx)
        // feel alike. No fade: a fade lets the black behind the screens show through mid-way.
        animation: reduceMotion ? 'none' : 'shift',
        transitionSpec: { animation: 'timing', config: { duration: 280, easing: Easing.out(Easing.cubic) } },
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-width, 0, width] }) }],
          },
        }),
        // Build every tab at launch, so a tab opened for the first time doesn't slide in empty.
        lazy: false,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('gauge.with.needle', 'readiness_score') }} />
      <Tabs.Screen name="sleep" options={{ title: 'Sleep', tabBarIcon: tabIcon('moon.stars', 'nights_stay') }} />
      <Tabs.Screen name="strain" options={{ title: 'Strain', tabBarIcon: tabIcon('flame', 'local_fire_department') }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: tabIcon('brain.head.profile', 'psychology') }} />
    </Tabs>
  );
}
