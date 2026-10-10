import { sustainedAbove, type HeartRateSample } from '@fitness/scoring';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { formatTime } from './format';
import { localStore } from './storage';

/**
 * Heart-rate alert: while live heart rate runs, if it stays at or above your limit for SUSTAIN_MS (normally 2 minutes),
 * the phone messages your chosen contact on WhatsApp, with no tap needed, through CallMeBot
 * (callmebot.com), a free service: the contact opts in once by messaging CallMeBot and gets a key.
 * WhatsApp doesn't let apps send from your own account without a tap, so the message comes from
 * CallMeBot's number. (SMS was tried and removed on Oct 10: Android blocks sending SMS for apps
 * installed outside the Play Store, and the permission made Play Protect flag the app as harmful.)
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
  /** null = sent, a message = failed, undefined = not set up. */
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

export const THRESHOLDS = [110, 115, 120, 130] as const;
export const SUSTAIN_MS = 2 * 60_000;
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
    if (!raw) return;
    const saved = JSON.parse(raw) as AlertState;
    // Limits from older builds (e.g. the 70 bpm test value) fall back to the default.
    if (!(THRESHOLDS as readonly number[]).includes(saved.thresholdBpm)) saved.thresholdBpm = 115;
    set(saved);
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

/** True while the alert is on and has someone to message: live heart rate then keeps running. */
export function isAlertWatching(): boolean {
  return state.enabled && !!state.contact;
}

export function isAlertSupported(): boolean {
  return Platform.OS === 'android';
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

/** Turns the alert on or off. Returns an error message, if any. */
export async function setAlertEnabled(enabled: boolean): Promise<string | null> {
  if (enabled) {
    if (!state.contact) return 'Pick a contact first.';
    if (!state.whatsappKey) return 'Add the contact’s CallMeBot key first, so the alert can reach them on WhatsApp.';
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

/** Sends the WhatsApp message, if it's set up. */
async function send(bpm: number, message: string, test: boolean): Promise<SendResult> {
  const { contact, whatsappKey } = state;
  if (!contact) throw new Error('No contact');
  const whatsapp = whatsappKey ? await sendWhatsapp(contact.phone, whatsappKey, message) : undefined;
  const result: SendResult = { time: Date.now(), bpm, test, whatsapp };
  set({ last: result });
  persist();
  return result;
}

/** Whether the message got out. */
export function reached(result: SendResult): boolean {
  return result.whatsapp === null;
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
