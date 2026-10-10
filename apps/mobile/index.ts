// The app's entry: expo-router's usual one, plus the two things Android may run while the app is
// closed (that runs this file without opening any screen): the home-screen widget redrawing, and
// the morning summary's background task.
import 'expo-router/entry';

import { registerWidgets } from './lib/heartRateWidget';
import { defineMorningSummaryTask } from './lib/morningSummary';

registerWidgets();
defineMorningSummaryTask();
