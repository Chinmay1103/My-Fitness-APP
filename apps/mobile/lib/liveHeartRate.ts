import { heartRateZone, type HeartRateSample } from '@fitness/scoring';
import { useSyncExternalStore } from 'react';
import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry, type Permission } from 'react-native';
import type { BleManager, Subscription } from 'react-native-ble-plx';

import { colors } from '@/constants/theme';
import { checkHeartRateAlert } from './heartRateAlert';
import { publishHeartRate } from './heartRateWidget';
import { localStore } from './storage';

/**
 * Live heart rate straight from the band over Bluetooth, about once a second.
 *
 * With "Share heart rate" switched on (Google Health › Fitbit Air), the band sends the standard
 * Bluetooth heart-rate signal that gym machines and Strava read, so we can read it too. This is
 * only for watching your heart rate as it happens (the Live screen, the notification and the
 * home-screen widget); the daily scores still come from Health Connect.
 *
 * While it runs, a foreground service (react-native-background-actions) keeps the app alive with a
 * notification, so the widget keeps updating on the home screen. Android 14+ would otherwise freeze
 * the app within seconds of leaving it.
 */

/** Standard Bluetooth "Heart Rate" service and its "Heart Rate Measurement" value. */
const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

const DEVICE_KEY = 'liveHeartRate.deviceId';
/** How long to look for the band before giving up (first connect only; reconnects keep trying). */
const SEARCH_MS = 30_000;
/** Prefer the band used last time; take any heart-rate sender if it hasn't shown up by then. */
const PREFER_REMEMBERED_MS = 8_000;
const RECONNECT_DELAY_MS = 5_000;
/** The notification and widget refresh at most this often (the screen updates every reading). */
const PUBLISH_EVERY_MS = 5_000;
/** One session keeps up to this many readings (6 hours at one a second). */
const MAX_SAMPLES = 6 * 60 * 60;

export type LiveStatus = 'off' | 'searching' | 'connecting' | 'live' | 'reconnecting' | 'error';

export interface LiveState {
  status: LiveStatus;
  /** What went wrong, in plain words, when `status` is 'error'. */
  message: string | null;
  deviceName: string | null;
  /** This session's readings, oldest first. Kept after stopping, until the next start. */
  samples: HeartRateSample[];
  startedAt: number | null;
}

let state: LiveState = { status: 'off', message: null, deviceName: null, samples: [], startedAt: null };
const listeners = new Set<() => void>();

function set(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** The live state, re-rendering on every reading. */
export function useLiveHeartRate(): LiveState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// Resting and max heart rate for zones; ScoresProvider sets them from the latest data.
let baseline = { restingHr: 60, maxHr: 188 };

export function setHeartRateBaseline(restingHr: number, maxHr: number) {
  baseline = { restingHr, maxHr };
}

export function getHeartRateBaseline() {
  return baseline;
}

/** 0 below zone 1, else 1 to 5, against the current baseline. */
export function liveZone(bpm: number): number {
  return heartRateZone(bpm, baseline.restingHr, baseline.maxHr);
}

/**
 * Whether this build has the Bluetooth and background-service parts. Like Health Connect, both
 * are missing in Expo Go and in builds made before they were added, and ble-plx can't even be
 * created without its native module, so everything below is loaded only when this is true.
 */
export function isLiveHeartRateSupported(): boolean {
  return (
    Platform.OS === 'android' &&
    !!(NativeModules.BlePlx ?? TurboModuleRegistry.get('BlePlx')) &&
    !!(NativeModules.RNBackgroundActions ?? TurboModuleRegistry.get('RNBackgroundActions'))
  );
}

let manager: BleManager | null = null;
function ble(): BleManager {
  if (!manager) {
    const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    manager = new Manager();
  }
  return manager;
}

type BackgroundService = typeof import('react-native-background-actions').default;
function service(): BackgroundService {
  return (require('react-native-background-actions') as typeof import('react-native-background-actions')).default;
}

let running = false;
/** Bumped on every start, so a timer from an earlier session can't end a newer one. */
let session = 0;
let deviceId: string | null = null;
let monitor: Subscription | null = null;
let disconnectWatch: Subscription | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastPublished = 0;

/** Asks for Bluetooth (and, on Android 13+, notification) access. True if Bluetooth was allowed. */
async function askPermissions(): Promise<boolean> {
  const api = Number(Platform.Version);
  const P = PermissionsAndroid.PERMISSIONS;
  const needed: Permission[] = api >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT] : [P.ACCESS_FINE_LOCATION];
  // Without this the service still runs, but its notification is hidden; so ask, but don't require it.
  const optional: Permission[] = api >= 33 ? [P.POST_NOTIFICATIONS] : [];
  const result = await PermissionsAndroid.requestMultiple([...needed, ...optional]);
  return needed.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

/** Whether Bluetooth is on. Right after start-up it reports "Unknown" for a moment, so wait up to 3 s. */
function bluetoothOn(): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => done(false), 3_000);
    const watch = ble().onStateChange((s) => {
      if (s === 'PoweredOn') done(true);
      else if (s !== 'Unknown' && s !== 'Resetting') done(false);
    }, true);
    function done(on: boolean) {
      clearTimeout(timer);
      watch.remove();
      resolve(on);
    }
  });
}

/** Starts reading live heart rate. Safe to call when already running. Must be called with the app open. */
export async function startLiveHeartRate(): Promise<void> {
  if (running || !isLiveHeartRateSupported()) return;
  set({ status: 'searching', message: null, samples: [], startedAt: Date.now(), deviceName: null });

  if (!(await askPermissions())) {
    return fail('Bluetooth access was not allowed. Allow "Nearby devices" for My Fitness in Android settings.');
  }
  if (!(await bluetoothOn())) return fail('Bluetooth is off. Turn it on and try again.');

  running = true;
  session += 1;
  try {
    await service().start(() => new Promise<void>(() => {}), {
      taskName: 'LiveHeartRate',
      taskTitle: 'Live heart rate',
      taskDesc: 'Looking for your band…',
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
      color: colors.restingHr,
      linkingURI: 'myfitness://live',
      foregroundServiceType: ['connectedDevice'],
    });
  } catch {
    // Still works while the app is open; the widget just won't update in the background.
  }
  connect(SEARCH_MS);
}

/** Stops reading and disconnects. The session's readings stay on screen. */
export async function stopLiveHeartRate(): Promise<void> {
  if (!isLiveHeartRateSupported()) return;
  running = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  await disconnect();
  if (service().isRunning()) await service().stop().catch(() => {});
  set({ status: 'off' });
  const latest = state.samples.at(-1);
  if (latest) publishHeartRate(state.samples, latest, liveZone(latest.bpm), false);
}

function fail(message: string) {
  running = false;
  disconnect();
  if (isLiveHeartRateSupported() && service().isRunning()) service().stop().catch(() => {});
  set({ status: 'error', message });
}

async function disconnect() {
  monitor?.remove();
  disconnectWatch?.remove();
  monitor = disconnectWatch = null;
  ble().stopDeviceScan().catch(() => {});
  if (deviceId) await ble().cancelDeviceConnection(deviceId).catch(() => {});
  deviceId = null;
}

/** Finds a band sending heart rate and connects to it. `timeoutMs` null means keep looking. */
async function connect(timeoutMs: number | null) {
  if (!running) return;
  const remembered = await localStore.getItem(DEVICE_KEY);
  const startedAt = Date.now();
  const mySession = session;
  let picked = false;

  await ble().startDeviceScan([HR_SERVICE], null, (error, device) => {
    if (!running || picked) return;
    if (error) {
      ble().stopDeviceScan().catch(() => {});
      return timeoutMs === null ? retry() : fail(`Couldn't search for the band: ${error.message}`);
    }
    if (!device) return;
    const isRemembered = device.id === remembered;
    if (remembered && !isRemembered && Date.now() - startedAt < PREFER_REMEMBERED_MS) return;
    picked = true;
    ble().stopDeviceScan().catch(() => {});
    attach(device.id, device.name ?? device.localName ?? 'your band');
  });

  if (timeoutMs !== null) {
    setTimeout(() => {
      if (running && !picked && session === mySession) {
        ble().stopDeviceScan().catch(() => {});
        fail(
          'Couldn’t find your band. In Google Health open Fitbit Air › Share heart rate, turn it on, keep the band close and try again.',
        );
      }
    }, timeoutMs);
  }
}

async function attach(id: string, name: string) {
  set({ status: 'connecting', deviceName: name });
  try {
    const device = await ble().connectToDevice(id, { timeout: 15_000 });
    deviceId = id;
    await device.discoverAllServicesAndCharacteristics();
    await localStore.setItem(DEVICE_KEY, id);
    disconnectWatch = ble().onDeviceDisconnected(id, () => {
      monitor?.remove();
      monitor = null;
      deviceId = null;
      if (running) retry();
    });
    monitor = ble().monitorCharacteristicForDevice(id, HR_SERVICE, HR_MEASUREMENT, (error, characteristic) => {
      if (error || !characteristic?.value) return;
      const bpm = parseHeartRate(characteristic.value);
      if (bpm) onReading({ time: Date.now(), bpm });
    });
    set({ status: 'live' });
  } catch {
    retry();
  }
}

/** Lost the band (walked away, band asleep): keep trying until stopped. */
function retry() {
  if (!running) return;
  set({ status: 'reconnecting' });
  if (service().isRunning()) {
    service().updateNotification({ taskDesc: 'Reconnecting to your band…' }).catch(() => {});
  }
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await disconnect();
    connect(null);
  }, RECONNECT_DELAY_MS);
}

function onReading(sample: HeartRateSample) {
  const samples = state.samples.length >= MAX_SAMPLES ? state.samples.slice(-MAX_SAMPLES + 1) : state.samples.slice();
  samples.push(sample);
  set({ samples, status: 'live' });
  checkHeartRateAlert(samples).then((sent) => {
    if (sent && service().isRunning()) {
      service().updateNotification({ taskDesc: `${sample.bpm} bpm · alert text sent` }).catch(() => {});
    }
  });

  if (sample.time - lastPublished < PUBLISH_EVERY_MS) return;
  lastPublished = sample.time;
  const zone = liveZone(sample.bpm);
  publishHeartRate(samples, sample, zone, true);
  if (service().isRunning()) {
    service()
      .updateNotification({ taskDesc: `${sample.bpm} bpm · ${zoneName(zone)}` })
      .catch(() => {});
  }
}

/** "Zone 3", or "Everyday" below zone 1. */
export function zoneName(zone: number): string {
  return zone === 0 ? 'Everyday' : `Zone ${zone}`;
}

/**
 * Reads the Heart Rate Measurement value (Bluetooth spec): byte 0 is flags, bit 0 says whether the
 * heart rate that follows is 1 byte or 2. Returns null for 0, which bands send without skin contact.
 */
export function parseHeartRate(base64: string): number | null {
  const raw = atob(base64);
  if (raw.length < 2) return null;
  const flags = raw.charCodeAt(0);
  const bpm = flags & 1 ? raw.charCodeAt(1) | (raw.charCodeAt(2) << 8) : raw.charCodeAt(1);
  return bpm > 0 ? bpm : null;
}
