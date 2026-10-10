import type { DayData, HeartRateSample, SleepSegment, SleepSession, SleepStage, SleepStageMinutes, StepRecord } from '@fitness/scoring';
import { Platform, TurboModuleRegistry } from 'react-native';
import type { Permission, ReadRecordsResult, RecordType } from 'react-native-health-connect';

import type { HealthSource } from './types';

/** What the scores need. Without these we fall back to demo data. */
export const CORE_TYPES = ['HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'SleepSession'] as const;

/**
 * Also read when allowed: steps, SpO2, breathing rate and energy burned feed the Today dashboard;
 * the rest only shows on the Health data screen, to find out what the band writes.
 * Each one needs a matching android.permission.health.READ_* line in app.json.
 */
export const EXTRA_TYPES = [
  'Steps',
  'ExerciseSession',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'OxygenSaturation',
  'RespiratoryRate',
  'SkinTemperature',
  'Vo2Max',
  'Weight',
] as const;

/** Health Connect's device type for phones (metadata.device.type). */
const DEVICE_PHONE = 2;

const PERMISSIONS: Permission[] = [...CORE_TYPES, ...EXTRA_TYPES].map((recordType) => ({ accessType: 'read', recordType }));

const DAY = 24 * 60 * 60 * 1000;

// Copies of the library's constants: importing them would load the library (see `lib`).
const SDK_AVAILABLE = 3;
const Stage = { AWAKE: 1, OUT_OF_BED: 3, DEEP: 5, REM: 6 };

type HealthConnectLib = typeof import('react-native-health-connect');
let cachedLib: HealthConnectLib | null | undefined;

/**
 * The library, or null where it can't work (iOS, web, Expo Go). It looks up its native module as
 * soon as it's imported and throws if it's missing, so it's only loaded once we know it's there.
 */
function lib(): HealthConnectLib | null {
  if (cachedLib === undefined) {
    cachedLib =
      Platform.OS === 'android' && TurboModuleRegistry.get('HealthConnect')
        ? (require('react-native-health-connect') as HealthConnectLib)
        : null;
  }
  return cachedLib;
}

let initialized: Promise<boolean> | null = null;

/** True once Health Connect is installed, up to date and initialized. */
async function ready(): Promise<boolean> {
  const hc = lib();
  if (!hc) return false;
  initialized ??= (async () => {
    try {
      if ((await hc.getSdkStatus()) !== SDK_AVAILABLE) return false;
      return await hc.initialize();
    } catch {
      return false;
    }
  })();
  return initialized;
}

/** Throws if Health Connect isn't ready; for calls that only make sense after `ready()`. */
function hcOrThrow(): HealthConnectLib {
  const hc = lib();
  if (!hc) throw new Error('Health Connect is not available in this build');
  return hc;
}

/** Reads every page of one record type in a time range. */
export async function readAll<T extends RecordType>(recordType: T, from: Date, to: Date) {
  const records: ReadRecordsResult<T>['records'] = [];
  let pageToken: string | undefined;
  do {
    const page = await hcOrThrow().readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: to.toISOString() },
      pageSize: 5000,
      pageToken,
    });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
}

/** Local calendar day, YYYY-MM-DD. */
function localDate(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toStage(code: number): SleepStage {
  if (code === Stage.DEEP) return 'deep';
  if (code === Stage.REM) return 'rem';
  if (code === Stage.AWAKE || code === Stage.OUT_OF_BED) return 'awake';
  // LIGHT, plain SLEEPING and UNKNOWN all count as light sleep.
  return 'light';
}

function toSleepSession(record: { startTime: string; endTime: string; stages?: { startTime: string; endTime: string; stage: number }[] }): SleepSession {
  const start = Date.parse(record.startTime);
  const end = Date.parse(record.endTime);
  const stages: SleepStageMinutes = { awake: 0, light: 0, deep: 0, rem: 0 };
  const segments: SleepSegment[] = [];
  if (record.stages?.length) {
    const sorted = [...record.stages].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    for (const s of sorted) {
      const segStart = Date.parse(s.startTime);
      const segEnd = Date.parse(s.endTime);
      const stage = toStage(s.stage);
      stages[stage] += (segEnd - segStart) / 60000;
      // Join back-to-back pieces of the same stage, so the chart draws one block.
      const last = segments.at(-1);
      if (last && last.stage === stage && segStart - last.end < 60000) last.end = segEnd;
      else segments.push({ start: segStart, end: segEnd, stage });
    }
  } else {
    // No stages recorded: treat the whole session as sleep.
    stages.light = (end - start) / 60000;
  }
  return { start, end, stages, segments: segments.length ? segments : undefined };
}

/** Opens Health Connect's own settings, e.g. to change permissions. */
export function openHealthConnectSettings() {
  lib()?.openHealthConnectSettings();
}

export const healthConnectSource: HealthSource = {
  id: 'health-connect',
  label: 'Health Connect',
  isAvailable: ready,

  async hasPermissions() {
    if (!(await ready())) return false;
    const granted = await hcOrThrow().getGrantedPermissions();
    return CORE_TYPES.every((type) => granted.some((p) => p.accessType === 'read' && p.recordType === type));
  },

  async requestPermissions() {
    if (!(await ready())) return false;
    // Without the history permission Health Connect only returns data from the last 30 days.
    await hcOrThrow().requestPermission([...PERMISSIONS, { accessType: 'read', recordType: 'ReadHealthDataHistory' }]);
    return this.hasPermissions();
  },

  async getDays(days) {
    const now = new Date();
    const firstMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    // Start a day earlier so the first day's sleep (which begins the evening before) is included.
    const from = new Date(firstMidnight.getTime() - DAY);

    // Extras are optional: a missing permission leaves that metric empty instead of failing the scores.
    const optional = <T,>(read: Promise<T[]>) => read.catch(() => [] as T[]);
    const [heartRate, resting, hrv, sleep, steps, spo2, breathing, calories] = await Promise.all([
      readAll('HeartRate', from, now),
      readAll('RestingHeartRate', from, now),
      readAll('HeartRateVariabilityRmssd', from, now),
      readAll('SleepSession', from, now),
      optional(readAll('Steps', from, now)),
      optional(readAll('OxygenSaturation', from, now)),
      optional(readAll('RespiratoryRate', from, now)),
      optional(readAll('TotalCaloriesBurned', from, now)),
    ]);

    const result: DayData[] = [];
    for (let i = 0; i < days; i++) {
      const midnight = new Date(firstMidnight.getFullYear(), firstMidnight.getMonth(), firstMidnight.getDate() + i);
      result.push({ date: localDate(midnight.getTime()), heartRate: [] });
    }
    const byDate = new Map(result.map((d) => [d.date, d]));

    // Main sleep = the longest session ending on that day (naps are ignored for now).
    for (const record of sleep) {
      const session = toSleepSession(record);
      const day = byDate.get(localDate(session.end));
      if (day && (!day.sleep || session.end - session.start > day.sleep.end - day.sleep.start)) day.sleep = session;
    }

    // Resting HR and HRV describe the night that ended that morning; keep the latest reading per day.
    for (const r of [...resting].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))) {
      const day = byDate.get(localDate(Date.parse(r.time)));
      if (day) day.restingHr = Math.round(r.beatsPerMinute);
    }
    for (const r of [...hrv].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))) {
      const day = byDate.get(localDate(Date.parse(r.time)));
      if (day) day.hrvRmssd = Math.round(r.heartRateVariabilityMillis);
    }

    // Heart rate for strain is the waking day; samples during that day's main sleep go to
    // `sleepHeartRate` instead, which is only charted.
    for (const s of heartRateSamples(heartRate)) {
      const day = byDate.get(localDate(s.time));
      if (!day) continue;
      if (day.sleep && s.time >= day.sleep.start && s.time <= day.sleep.end) (day.sleepHeartRate ??= []).push(s);
      else day.heartRate.push(s);
    }

    // Steps, labelled by device so the band's can be checked against the phone's (combineSteps).
    for (const r of steps) {
      const start = Date.parse(r.startTime);
      const day = byDate.get(localDate(start));
      if (!day) continue;
      const device: StepRecord['device'] = r.metadata?.device?.type === DEVICE_PHONE ? 'phone' : 'band';
      (day.steps ??= []).push({ start, end: Date.parse(r.endTime), count: r.count, device });
    }

    // SpO2 and breathing rate: averages over the main sleep (the band measures both overnight).
    const nightAverage = (records: { time: string }[], value: (r: any) => number, set: (d: DayData, v: number) => void) => {
      for (const day of result) {
        if (!day.sleep) continue;
        const inside = records.filter((r) => {
          const t = Date.parse(r.time);
          return t >= day.sleep!.start - 30 * 60_000 && t <= day.sleep!.end + 30 * 60_000;
        });
        if (inside.length) set(day, inside.reduce((sum, r) => sum + value(r), 0) / inside.length);
      }
    };
    nightAverage(spo2, (r) => r.percentage, (d, v) => (d.spo2 = Math.round(v)));
    nightAverage(breathing, (r) => r.rate, (d, v) => (d.respiratoryRate = Math.round(v * 10) / 10));

    for (const r of calories) {
      const day = byDate.get(localDate(Date.parse(r.startTime)));
      if (day) day.caloriesBurned = Math.round((day.caloriesBurned ?? 0) + r.energy.inKilocalories);
    }

    return result;
  },

  async getHeartRate(from, to) {
    return heartRateSamples(await readAll('HeartRate', from, to)).filter(
      (s) => s.time >= from.getTime() && s.time <= to.getTime(),
    );
  },
};

/** Health Connect stores heart rate as records holding many samples; flattened, oldest first. */
function heartRateSamples(records: { samples: { time: string; beatsPerMinute: number }[] }[]): HeartRateSample[] {
  return records
    .flatMap((r) => r.samples.map((s) => ({ time: Date.parse(s.time), bpm: s.beatsPerMinute })))
    .sort((a, b) => a.time - b.time);
}

export interface DataTypeCheck {
  type: string;
  /** Records in the checked period. */
  count: number;
  /** Package names of the apps that wrote them, e.g. com.google.android.apps.fitness. */
  origins: string[];
  /** Devices that recorded them, e.g. "phone", "band (Google Fitbit Air)". */
  devices: string[];
  /** Newest record's time, ISO. */
  latest?: string;
  /** Set when this type couldn't be read, usually a missing permission. */
  error?: string;
}

/**
 * For the Health data screen: which data types exist in Health Connect over the last `days`
 * days, and which apps wrote them. This is how we find out what the Fitbit Air actually writes.
 */
export async function checkDataTypes(days = 7): Promise<DataTypeCheck[]> {
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY);
  return Promise.all(
    [...CORE_TYPES, ...EXTRA_TYPES].map(async (type): Promise<DataTypeCheck> => {
      try {
        const records = await readAll(type, from, to);
        const origins = new Set<string>();
        const devices = new Set<string>();
        let latest: string | undefined;
        for (const r of records) {
          if (r.metadata?.dataOrigin) origins.add(r.metadata.dataOrigin);
          const device = r.metadata?.device;
          if (device) devices.add(`${DEVICE_NAMES[device.type ?? 0] ?? 'other'}${device.model ? ` (${[device.manufacturer, device.model].filter(Boolean).join(' ')})` : ''}`);
          const time = 'time' in r ? r.time : 'endTime' in r ? r.endTime : undefined;
          if (typeof time === 'string' && (!latest || time > latest)) latest = time;
        }
        return { type, count: records.length, origins: [...origins], devices: [...devices], latest };
      } catch (e) {
        return { type, count: 0, origins: [], devices: [], error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

const DEVICE_NAMES: Record<number, string> = { 0: 'unknown device', 2: 'phone', 3: 'scale', 4: 'ring', 6: 'band', 7: 'chest strap' };
