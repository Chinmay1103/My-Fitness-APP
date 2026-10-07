import type { HeartRateSample } from '@fitness/scoring';
import { Platform, TurboModuleRegistry } from 'react-native';

import { localStore } from './storage';

/**
 * The "Heart rate" home-screen widget (Android): the latest reading, its zone and the last 30
 * minutes as a line. While live heart rate runs it refreshes every few seconds; otherwise it shows
 * the newest reading from Health Connect and when that was.
 *
 * Android draws widgets itself, from a snapshot we save on the phone, so the widget can be redrawn
 * (after a restart, every 30 minutes) even when the app isn't running.
 */

export interface HeartRateSnapshot {
  bpm: number;
  time: number;
  /** 0 below zone 1, else 1 to 5. */
  zone: number;
  /** True while live heart rate is running. */
  live: boolean;
  /** Average heart rate per 30-second slot over the 30 minutes up to `time`, oldest first; null = no reading. */
  trace: (number | null)[];
}

const KEY = 'widget.heartRate.v1';
const WINDOW_MS = 30 * 60_000;
const SLOT_MS = 30_000;
/** A live snapshot older than this is shown as "last reading" instead of "live". */
export const LIVE_STALE_MS = 2 * 60_000;

/**
 * Whether this build has the widget's native part. The library looks it up as soon as it's
 * imported and throws without it (Expo Go, older builds), so its code is only loaded when present.
 */
export function isWidgetSupported(): boolean {
  return Platform.OS === 'android' && !!TurboModuleRegistry.get('AndroidWidget');
}

/** Average per 30-second slot over the 30 minutes up to `end`. */
export function traceOf(samples: HeartRateSample[], end: number): (number | null)[] {
  const slots = WINDOW_MS / SLOT_MS;
  const sums = new Array<number>(slots).fill(0);
  const counts = new Array<number>(slots).fill(0);
  const start = end - WINDOW_MS;
  // Samples are oldest first, so walk back from the newest and stop once past the window.
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (s.time < start) break;
    const slot = Math.min(Math.floor((s.time - start) / SLOT_MS), slots - 1);
    sums[slot] += s.bpm;
    counts[slot] += 1;
  }
  return sums.map((sum, i) => (counts[i] ? Math.round(sum / counts[i]) : null));
}

export async function loadSnapshot(): Promise<HeartRateSnapshot | null> {
  try {
    const raw = await localStore.getItem(KEY);
    return raw ? (JSON.parse(raw) as HeartRateSnapshot) : null;
  } catch {
    return null;
  }
}

/** Saves the latest reading and redraws the widget. `samples` oldest first, ending at or after `latest`. */
export async function publishHeartRate(samples: HeartRateSample[], latest: HeartRateSample, zone: number, live: boolean) {
  const snapshot: HeartRateSnapshot = { bpm: latest.bpm, time: latest.time, zone, live, trace: traceOf(samples, latest.time) };
  try {
    await localStore.setItem(KEY, JSON.stringify(snapshot));
    if (isWidgetSupported()) await (require('./widget/HeartRateWidget') as typeof import('./widget/HeartRateWidget')).drawHeartRateWidget(snapshot);
  } catch {
    // A widget that misses one update is fine; never let it break the live reading.
  }
}

/**
 * For when live heart rate isn't running: shows Health Connect's newest reading, unless the widget
 * already has a newer one.
 */
export async function publishLatestFromHistory(samples: HeartRateSample[], zoneOf: (bpm: number) => number) {
  const latest = samples.at(-1);
  if (!latest) return;
  const current = await loadSnapshot();
  if (current && (current.time >= latest.time || (current.live && Date.now() - current.time < LIVE_STALE_MS))) return;
  await publishHeartRate(samples, latest, zoneOf(latest.bpm), false);
}

/** Asks the launcher to add the widget to the home screen (Android 8+ launchers that support it). */
export async function pinHeartRateWidget(): Promise<boolean> {
  if (!isWidgetSupported()) return false;
  const { requestPinWidget } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  return requestPinWidget({ widgetName: 'HeartRate' }).catch(() => false);
}

/** Called once from the app's entry file, so Android can redraw the widget with the app closed. */
export function registerWidgets() {
  if (isWidgetSupported()) (require('./widget/HeartRateWidget') as typeof import('./widget/HeartRateWidget')).registerHeartRateWidget();
}
