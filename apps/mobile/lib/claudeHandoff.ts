import type { DailyScores, DayData } from '@fitness/scoring';
import { Linking, Share } from 'react-native';

import type { HealthSource } from './health';
import { formatDate, formatMinutes, formatTime } from './format';
import { FACTOR_LABELS } from './insights';

function signed(n: number, unit = ''): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}${unit}`;
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Today's numbers as plain text for Claude: recovery with what drove it, last night's sleep, today's
 * strain and activities, and the last 7 days. Kept short so it fits in a link. The same wording as
 * the app's "Why" cards, so Claude and the app never disagree.
 */
export function buildContext(scores: DailyScores[], days: DayData[], sourceId: HealthSource['id']): string {
  const today = scores.at(-1);
  if (!today) return '';
  const lines: string[] = [
    'Data from my fitness app (Whoop-style scores computed from my Fitbit). Please give wellness guidance, not medical advice.',
  ];
  if (sourceId === 'mock') lines.push('Note: this is demo data, not real measurements.');
  lines.push('', `Today, ${formatDate(today.date)}:`);

  const r = today.recovery;
  if (r?.score != null && r.breakdown) {
    const factors = r.breakdown.factors
      .map((f) => {
        const unit = f.key === 'hrv' ? ' ms' : f.key === 'restingHr' ? ' bpm' : '%';
        // Sleep is compared with a fixed benchmark, the others with my own 30-day normal.
        const vs = f.key === 'sleep' ? 'benchmark' : 'my usual';
        return `${FACTOR_LABELS[f.key]} ${f.today}${unit} vs ${vs} ${f.baseline}${unit} (${signed(f.points)} pts)`;
      })
      .join('; ');
    lines.push(
      `- Recovery ${r.score}% (${r.zone}${r.calibrating ? ', still calibrating' : ''}). A typical night for me scores ${r.breakdown.typical}%. ${factors}.`,
    );
  } else if (r) {
    lines.push(`- Recovery: not enough history yet (${r.daysOfHistory} nights).`);
  }

  const s = today.sleep;
  if (s) {
    lines.push(
      `- Sleep: ${formatMinutes(s.asleepMinutes)} of ${formatMinutes(s.needMinutes)} needed, score ${s.score}%. Efficiency ${Math.round(s.efficiency * 100)}%, deep+REM ${Math.round(s.restorativeRatio * 100)}%, bedtime consistency ${Math.round(s.consistency * 100)}%.`,
    );
  }

  const st = today.strain;
  const activities = st.activities
    .map((a) => `${formatTime(a.start)}–${formatTime(a.end)} (${formatMinutes(a.minutes)}, avg ${a.avgBpm} bpm, strain ${a.strain.toFixed(1)})`)
    .join('; ');
  lines.push(`- Strain so far: ${st.strain.toFixed(1)} of 21.${activities ? ` Activities: ${activities}.` : ''}`);

  const day = days.at(-1);
  if (day?.hrvRmssd || day?.restingHr) {
    lines.push(`- Overnight: HRV ${day.hrvRmssd ?? '–'} ms, resting HR ${day.restingHr ?? '–'} bpm.`);
  }

  lines.push('', 'Last 7 days (recovery / strain / sleep):');
  for (const d of scores.slice(-8, -1)) {
    lines.push(
      `${shortDate(d.date)}: ${d.recovery?.score != null ? `${d.recovery.score}%` : '–'} / ${d.strain.strain.toFixed(1)} / ${d.sleep ? `${d.sleep.score}%` : '–'}`,
    );
  }
  return lines.join('\n');
}

export function buildMessage(context: string, question: string): string {
  return `${context}\n\nMy question: ${question.trim()}`;
}

/**
 * Opens a new Claude chat with `message` filled in. Uses claude.ai's `?q=` link, which the Claude
 * app or the browser opens. If that fails, falls back to the share sheet (pick Claude there).
 */
export async function openInClaude(message: string): Promise<void> {
  const url = `https://claude.ai/new?q=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    await shareToClaude(message);
  }
}

/** The Android share sheet with the message; choosing the Claude app starts a chat with it. */
export async function shareToClaude(message: string): Promise<void> {
  await Share.share({ message });
}
