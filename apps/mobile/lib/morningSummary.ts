import { bodyCheck, computeDailyScores, learnSleepNeed, MOCK_PROFILE, type DailyScores, type DayData } from '@fitness/scoring';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { formatMinutes, formatTime, localDate } from './format';
import { healthConnectSource } from './health/healthConnectSource';
import { attachWorkouts, fetchLogged } from './logged';
import { STRAIN_TARGETS, tonightPlan } from './nextSteps';
import { localStore } from './storage';

/**
 * The morning summary: one notification a day, once last night's sleep has reached Health Connect
 * and recovery can be scored, e.g. "Recovery 72% · green. Aim for strain 14–18. In bed by 10:30 PM."
 *
 * It runs as a background task (expo-background-task: Android's WorkManager), every 30 minutes or
 * so as Android sees fit, and does nothing outside 5 AM to noon or once today's summary went out.
 * Reading Health Connect while the app is closed needs Health Connect's "background" permission,
 * asked for when the summary is switched on (Account screen).
 */

const TASK = 'morning-summary';
const ENABLED_KEY = 'morningSummary.enabled';
const LAST_KEY = 'morningSummary.lastDate';
const CHANNEL = 'morning';
const FIRST_HOUR = 5;
const LAST_HOUR = 12;
/** Health Connect gets the band's night in batches; wait a little after waking so it's complete. */
const SETTLE_MS = 20 * 60_000;

type Notifications = typeof import('expo-notifications');
type TaskManager = typeof import('expo-task-manager');
type BackgroundTask = typeof import('expo-background-task');

/** The modules, or null in a build without them (they throw on import when missing). */
function mods(): { n: Notifications; tm: TaskManager; bt: BackgroundTask } | null {
  if (Platform.OS !== 'android' || !requireOptionalNativeModule('ExpoBackgroundTask') || !requireOptionalNativeModule('ExpoTaskManager')) return null;
  return {
    n: require('expo-notifications') as Notifications,
    tm: require('expo-task-manager') as TaskManager,
    bt: require('expo-background-task') as BackgroundTask,
  };
}

export function isMorningSummarySupported(): boolean {
  return mods() !== null;
}

/** Defines the task. Must run at startup, in the entry file, so Android can run it with the app closed. */
export function defineMorningSummaryTask() {
  const m = mods();
  if (!m || m.tm.isTaskDefined(TASK)) return;
  m.tm.defineTask(TASK, async () => {
    try {
      await sendMorningSummary(false);
      return m.bt.BackgroundTaskResult.Success;
    } catch {
      return m.bt.BackgroundTaskResult.Failed;
    }
  });
}

export async function isMorningSummaryOn(): Promise<boolean> {
  return (await localStore.getItem(ENABLED_KEY)) === 'on';
}

/**
 * Switches the summary on (asking for notifications and background Health Connect reads) or off.
 * Returns an error message, if any.
 */
export async function setMorningSummary(on: boolean): Promise<string | null> {
  const m = mods();
  if (!m) return 'This build doesn’t have background tasks yet: it needs the next app build.';
  if (!on) {
    await localStore.setItem(ENABLED_KEY, 'off');
    if (await m.tm.isTaskRegisteredAsync(TASK)) await m.bt.unregisterTaskAsync(TASK);
    return null;
  }
  const perm = await m.n.requestPermissionsAsync();
  if (!perm.granted) return 'Notifications aren’t allowed for My Fitness. Allow them in Android settings and try again.';
  await m.n.setNotificationChannelAsync(CHANNEL, { name: 'Morning summary', importance: m.n.AndroidImportance.DEFAULT });
  const background = (await healthConnectSource.requestBackgroundAccess?.()) ?? false;
  await m.bt.registerTaskAsync(TASK, { minimumInterval: 30 });
  await localStore.setItem(ENABLED_KEY, 'on');
  return background ? null : 'On, but Health Connect didn’t allow reading in the background, so the summary can’t check your night while the app is closed. Allow “Access data in the background” for My Fitness in Health Connect.';
}

/** The words of the summary, from the latest day's scores. Null when last night isn't scored yet. */
export function morningMessage(scores: DailyScores[], days: DayData[], baseNeed: number): { title: string; body: string } | null {
  const today = scores.at(-1);
  const recovery = today?.recovery;
  if (!today || recovery?.score == null || !recovery.zone) return null;
  const [lo, hi] = STRAIN_TARGETS[recovery.zone];
  const plan = tonightPlan(scores, days, { ...MOCK_PROFILE, baseSleepNeedMinutes: baseNeed });
  const body = bodyCheck(days);
  const parts = [
    body?.level === 'alert' ? 'Body check: several signals are up, keep today easy.' : null,
    recovery.zone === 'red' ? `Recovery day: keep strain under ${hi}.` : `Aim for strain ${lo}–${hi}.`,
    plan ? `In bed by ${formatTime(plan.bedAt)} for ${formatMinutes(plan.need.total)}.` : null,
  ].filter(Boolean);
  const sleep = today.sleep ? ` · sleep ${today.sleep.score}%` : '';
  return { title: `Recovery ${recovery.score}% · ${recovery.zone}${sleep}`, body: parts.join(' ') };
}

/**
 * Reads the last weeks from Health Connect, scores them and posts the summary if it's time.
 * `force` (the "Send one now" button) skips the time window and the once-a-day check.
 * Returns what happened, for the button.
 */
export async function sendMorningSummary(force: boolean): Promise<string> {
  const m = mods();
  if (!m) return 'Not available in this build.';
  const now = new Date();
  const todayKey = localDate(now.getTime());
  if (!force) {
    if (!(await isMorningSummaryOn())) return 'Off.';
    if (now.getHours() < FIRST_HOUR || now.getHours() >= LAST_HOUR) return 'Outside the morning window.';
    if ((await localStore.getItem(LAST_KEY)) === todayKey) return 'Already sent today.';
  }
  if (!(await healthConnectSource.hasPermissions())) return 'Health Connect isn’t connected.';

  const from = new Date(now.getTime() - 45 * 86_400_000);
  const [raw, logged] = await Promise.all([healthConnectSource.getDays(45), fetchLogged(from).catch(() => null)]);
  const days = logged ? attachWorkouts(raw, logged.workouts) : raw;
  const latest = days.at(-1);
  if (!latest?.sleep || now.getTime() - latest.sleep.end < SETTLE_MS) return 'Last night’s sleep hasn’t synced yet.';
  const first = computeDailyScores(days, MOCK_PROFILE);
  const learned = learnSleepNeed(first);
  const baseNeed = learned?.minutes ?? MOCK_PROFILE.baseSleepNeedMinutes ?? 480;
  const scores = learned ? computeDailyScores(days, { ...MOCK_PROFILE, baseSleepNeedMinutes: baseNeed }) : first;
  const message = morningMessage(scores, days, baseNeed);
  if (!message) return 'Recovery can’t be scored yet (it needs 4 nights of HRV and resting heart rate).';

  await m.n.setNotificationChannelAsync(CHANNEL, { name: 'Morning summary', importance: m.n.AndroidImportance.DEFAULT });
  await m.n.scheduleNotificationAsync({ content: { title: message.title, body: message.body }, trigger: { channelId: CHANNEL } });
  await localStore.setItem(LAST_KEY, todayKey);
  return `Sent: ${message.title}`;
}
