// The app's entry: expo-router's usual one, plus the home-screen widget, which Android may ask to
// redraw while the app is closed (that runs this file without opening any screen).
import 'expo-router/entry';

import { registerWidgets } from './lib/heartRateWidget';

registerWidgets();
