import { sustainedAbove, type HeartRateSample } from '@fitness/scoring';
import { useSyncExternalStore } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { SmsSender } from '@/modules/sms-sender';
import { formatTime } from './format';
import { localStore } from './storage';

/**
 * Heart-rate alert: while live heart rate runs, if it stays at or above your limit for SUSTAIN_MS (normally 2 minutes),
 * the phone messages your chosen contact, with no tap needed, two ways at once:
 * - SMS from your SIM (our own native module, modules/sms-sender), which works without internet;
 * - WhatsApp through CallMeBot (callmebot.com), a free service: the contact opts in once by
 *   messaging CallMeBot and gets a key. WhatsApp doesn't let apps send from your own account
 *   without a tap, so the WhatsApp message comes from CallMeBot's number.
 * At most one alert per 30 minutes, so a long high stretch doesn't flood them. Live heart rate must
 * be running, since Health Connect data arrives too late for an alert. Wellness alert, not a
 * medical device.
 */

export interface AlertContact {
  name: string;
  /** International format, e.g. +919876543210. */
  phone: string;
}

interface SendResult {
  time: number;
  bpm: number;
  test: boolean;
  /** Per channel: null = sent, a message = failed, undefined = not set up. */
  sms?: string | null;
  whatsapp?: string | null;
}

export interface AlertState {
  enabled: boolean;
  thresholdBpm: number;
  contact: AlertContact | null;
  /** The contact's CallMeBot key; WhatsApp is skipped without it. */
  whatsappKey: string | null;
  last: SendResult | null;
}

// TESTING: 70 bpm and 30 s so the alert is easy to trigger. Put back [110, 115, 120, 130] and 2 * 60_000 after testing.
export const THRESHOLDS = [70, 110, 115, 120, 130] as const;
export const SUSTAIN_MS = 30_000;
/** "30 seconds" or "2 minutes", for the messages. */
export const SUSTAIN_TEXT = SUSTAIN_MS < 60_000 ? `${SUSTAIN_MS / 1000} seconds` : `${SUSTAIN_MS / 60_000} minutes`;
const COOLDOWN_MS = 30 * 60_000;
/** After an alert that reached nobody, try again this soon. */
const RETRY_MS = 60_000;
const KEY = 'heartRateAlert.v2';

let state: AlertState = { enabled: false, thresholdBpm: 115, contact: null, whatsappKey: null, last: null };
const listeners = new Set<() => void>();
let sending = false;

function set(patch: Partial<AlertState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

// Settings live on the phone; load them once at start-up.
localStore
  .getItem(KEY)
  .then((raw) => {
    if (raw) set(JSON.parse(raw) as AlertState);
  })
  .catch(() => {});

function persist() {
  localStore.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export function useHeartRateAlert(): AlertState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Whether this build has the SMS module (the build from Oct 7 or later). */
export function isAlertSupported(): boolean {
  return !!SmsSender;
}

/**
 * Phone numbers from contacts come in many shapes ("098765 43210", "+91 98765-43210"); CallMeBot
 * needs +<country><number>. A bare 10-digit or 0-prefixed number is taken as Indian.
 */
export function internationalNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

async function canSendSms(): Promise<boolean> {
  if (Platform.OS !== 'android' || !SmsSender) return false;
  const p = PermissionsAndroid.PERMISSIONS.SEND_SMS;
  if (await PermissionsAndroid.check(p)) return true;
  return (await PermissionsAndroid.request(p)) === PermissionsAndroid.RESULTS.GRANTED;
}

/** Turns the alert on (asking for SMS access first) or off. Returns an error message, if any. */
export async function setAlertEnabled(enabled: boolean): Promise<string | null> {
  if (enabled) {
    if (!state.contact) return 'Pick a contact first.';
    const sms = await canSendSms();
    if (!sms && !state.whatsappKey) return 'SMS access was not allowed and WhatsApp isn’t set up, so the alert couldn’t reach anyone.';
  }
  set({ enabled });
  persist();
  return null;
}

export function setAlertThreshold(thresholdBpm: number) {
  set({ thresholdBpm });
  persist();
}

export function setWhatsappKey(key: string) {
  set({ whatsappKey: key.trim() || null });
  persist();
}

/** Opens the phone's contact list. Returns an error message, if any. */
export async function pickAlertContact(): Promise<string | null> {
  try {
    const Contacts = require('expo-contacts') as typeof import('expo-contacts');
    const { granted } = await Contacts.requestPermissionsAsync();
    if (!granted) return 'Contacts access was not allowed.';
    const contact = await Contacts.Contact.presentPicker();
    if (!contact) return null; // cancelled
    const phones = await contact.getPhones();
    const phone = phones.find((p) => /mobile/i.test(p.label ?? ''))?.number ?? phones[0]?.number;
    if (!phone) return 'That contact has no phone number.';
    const name = (await contact.getFullName()) || phone;
    // A new person needs their own CallMeBot key.
    const changed = state.contact?.phone !== internationalNumber(phone);
    set({ contact: { name, phone: internationalNumber(phone) }, ...(changed ? { whatsappKey: null } : {}) });
    persist();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function sendSms(phone: string, message: string): Promise<string | null> {
  try {
    if (!(await canSendSms())) return 'SMS access not allowed';
    await SmsSender!.sendText(phone, message);
    return null;
  } catch (e) {
    return errorText(e);
  }
}

async function sendWhatsapp(phone: string, key: string, message: string): Promise<string | null> {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const body = await res.text();
    // CallMeBot answers with a short HTML page; failures say so in words, sometimes with status 200.
    if (!res.ok || /error|invalid|not (allowed|registered)/i.test(body)) {
      return body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || `HTTP ${res.status}`;
    }
    return null;
  } catch (e) {
    return `No internet? ${errorText(e)}`;
  }
}

/** Sends on every channel that's set up, at the same time. */
async function send(bpm: number, message: string, test: boolean): Promise<SendResult> {
  const { contact, whatsappKey } = state;
  if (!contact) throw new Error('No contact');
  const [sms, whatsapp] = await Promise.all([
    SmsSender ? sendSms(contact.phone, message) : Promise.resolve(undefined),
    whatsappKey ? sendWhatsapp(contact.phone, whatsappKey, message) : Promise.resolve(undefined),
  ]);
  const result: SendResult = { time: Date.now(), bpm, test, sms, whatsapp };
  set({ last: result });
  persist();
  return result;
}

/** Whether at least one channel got the message out. */
export function reached(result: SendResult): boolean {
  return result.sms === null || result.whatsapp === null;
}

/** Sends a test message, so you and your contact know what an alert looks like. */
export function sendTestAlert(): Promise<SendResult> {
  return send(
    0,
    `Test from My Fitness: if my heart rate stays above ${state.thresholdBpm} bpm for ${SUSTAIN_TEXT}, you'll get a message like this. No action needed now.`,
    true,
  );
}

/**
 * Called with every live reading. Messages the contact when the rule is met and the last real alert
 * was over 30 minutes ago. Returns true when an alert went out.
 */
export async function checkHeartRateAlert(samples: HeartRateSample[]): Promise<boolean> {
  if (!state.enabled || !state.contact || sending) return false;
  const last = state.last;
  if (last && !last.test && Date.now() - last.time < (reached(last) ? COOLDOWN_MS : RETRY_MS)) return false;
  const bpm = sustainedAbove(samples, state.thresholdBpm, SUSTAIN_MS);
  if (bpm == null) return false;
  sending = true;
  try {
    const result = await send(
      bpm,
      `Heart-rate alert from My Fitness: my heart rate has been above ${state.thresholdBpm} bpm for over ${SUSTAIN_TEXT} (${bpm} bpm at ${formatTime(Date.now())}). Please check on me.`,
      false,
    );
    return reached(result);
  } finally {
    sending = false;
  }
}
