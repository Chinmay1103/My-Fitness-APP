import { estimateMaxHr, strainLevel, ZONE_BOUNDS, type WorkoutAnalysis } from '@fitness/scoring';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { HeartRateChart } from '@/components/charts/HeartRateChart';
import { Button, Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { formatCount, formatMinutes, formatTime, localDate } from '@/lib/format';
import type { LoggedWorkoutDetail } from '@/lib/logged';
import { useScores } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';
import { usualStrain, workoutAnalysis, workoutInputs } from '@/lib/workoutAnalysis';
import { KINDS, effortLabel, paceText, type WorkoutKind } from '@/lib/workouts';
import { HELP_WORKOUT } from '@/lib/help';

const PAD = 5 * 60_000;

/** What each zone feels like, zone 1 to 5 (share of heart-rate reserve). */
const ZONE_FEEL = [
  'warm-up pace, easy walking',
  'steady: you can talk in full sentences',
  'moderate: short sentences only',
  'hard: breathing heavily',
  'max: a few words at most',
];

/**
 * One logged workout, measured against the band's heart rate for exactly the time you gave the
 * coach: how hard you pushed (strain of the workout alone, zone by zone, plus what your effort
 * rating added) and the calories it burned (resting body plus what each zone added). Both cards
 * add up exactly to their number. Display only: the day's strain is on the Strain screen.
 */
export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useStyles();
  const { days, scores, logged, profile } = useScores();

  const all = useMemo(() => {
    const byId = new Map<string, LoggedWorkoutDetail>(logged.workouts.map((w) => [w.id, w]));
    for (const d of days) for (const w of d.workouts ?? []) if (!byId.has(w.id)) byId.set(w.id, w);
    return [...byId.values()].map((workout) => ({ workout, analysis: workoutAnalysis(workout, days, logged, profile) }));
  }, [days, logged, profile]);

  const entry = all.find((x) => x.workout.id === id);
  const input = entry ? workoutInputs(entry.workout, days, logged, profile) : null;
  if (!entry || !entry.analysis || !input) {
    return (
      <Screen back title="Workout">
        <Muted>This workout isn’t in the loaded days (the phone keeps the last 45).</Muted>
      </Screen>
    );
  }

  const w = entry.workout;
  const a = entry.analysis;
  const kind = (KINDS[w.kind as WorkoutKind] ? w.kind : 'other') as WorkoutKind;
  const title = w.title || KINDS[kind].label;
  const maxHr = estimateMaxHr(input.profile);
  const reserve = maxHr - input.restingHr;
  const zoneBpm = (z: number) => Math.round(input.restingHr + ZONE_BOUNDS[z]! * reserve);
  const usual = usualStrain(w, all);
  const date = localDate(w.start);
  const band = scores.find((s) => s.date === date)?.strain.activities.find((x) => x.workout?.id === w.id);
  const pace = w.distanceKm ? paceText(kind, a.minutes, w.distanceKm) : null;

  return (
    <Screen
      help={HELP_WORKOUT}
      back
      overline={`${new Date(w.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${formatTime(w.start)} – ${formatTime(w.end)}`}
      title={title}
      glow={colors.strain}>
      <Card>
        <View style={styles.hero}>
          <Text style={[styles.big, { color: colors.strain }]}>{a.strain.toFixed(1)}</Text>
          <Text style={styles.heroLabel}>{`WORKOUT STRAIN · ${strainLevel(a.strain).toUpperCase()}`}</Text>
          <Muted>{pushSummary(a, usual, KINDS[kind].label.toLowerCase())}</Muted>
        </View>
        <Row>
          <Stat label="Calories" value={formatCount(a.calories.total)} hint="kcal" color={colors.calories} />
          <Stat label="Average" value={a.avgBpm != null ? `${a.avgBpm}` : '--'} hint="bpm" />
          <Stat label="Peak" value={a.peakBpm != null ? `${a.peakBpm}` : '--'} hint="bpm" />
        </Row>
      </Card>

      <Card title={`HOW HARD YOU PUSHED · WHY ${a.strain.toFixed(1)}`}>
        <Breakdown>
          {a.strainParts.zones.map((part, z) =>
            a.zoneMinutes[z + 1]! > 0 ? (
              <BreakdownFactor
                key={z}
                label={`Zone ${z + 1} · ${formatMinutes(a.zoneMinutes[z + 1]!)}`}
                detail={`${zoneBpm(z)}${z < 4 ? `–${zoneBpm(z + 1) - 1}` : '+'} bpm, ${ZONE_FEEL[z]}`}
                delta={part}
                scale={Math.max(...a.strainParts.zones, a.strainParts.effort, 0.1)}
                decimals={1}
                color={colors.hrZones[z]}
              />
            ) : null,
          )}
          {a.strainParts.effort > 0 ? (
            <BreakdownFactor
              label={`Your effort rating · ${w.effort}/10`}
              detail="Felt harder than heart rate showed (normal for lifting), so the rating tops it up"
              delta={a.strainParts.effort}
              scale={Math.max(...a.strainParts.zones, a.strainParts.effort, 0.1)}
              decimals={1}
              color={colors.strain}
            />
          ) : null}
          <BreakdownTotal label="Workout strain" value={a.strain.toFixed(1)} color={colors.strain} />
        </Breakdown>
        <Muted>{effortComparison(a, w.effort)}</Muted>
        {a.zoneMinutes[0] > 0 ? (
          <Muted>{`${formatMinutes(a.zoneMinutes[0])} below zone 1 (under ${zoneBpm(0)} bpm: rests between sets, cool-down) adds nothing.`}</Muted>
        ) : null}
        <Muted>
          {`Zones are shares of your heart-rate reserve: resting ${input.restingHr} bpm to max ${maxHr} bpm${
            input.profile.maxHr ? '' : ' (estimated from age)'
          }. A minute in zone 5 counts about 6 times a minute in zone 1. Strain is on a curve, so this workout alone scores higher than its share of the day.`}
        </Muted>
      </Card>

      <CaloriesCard a={a} weighInAt={input.weighIn?.measuredAt ?? null} />

      <Card title="HEART RATE">
        <HeartRateChart
          samples={input.samples}
          date={input.day.date}
          restingHr={input.restingHr}
          maxHr={maxHr}
          window={{ start: w.start - PAD, end: w.end + PAD }}
        />
        <Muted>
          {a.heartRateMinutes >= a.minutes - 1
            ? 'Drag across the graph to read any moment.'
            : `The band has heart rate for ${formatMinutes(a.heartRateMinutes)} of the ${formatMinutes(a.minutes)}. Wear it snug, a finger above the wrist bone, for steadier readings.`}
        </Muted>
      </Card>

      <Card title="WHAT YOU LOGGED">
        <Text style={styles.body}>
          {[
            KINDS[kind].label,
            formatMinutes(a.minutes),
            w.effort ? `effort ${w.effort}/10 (${effortLabel(w.effort)})` : '',
            w.distanceKm ? `${w.distanceKm} km` : '',
            pace ?? '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {w.exercises?.map((e) => (
          <Text key={e.name} style={styles.exercise}>
            {`${e.name}: ${e.sets.map((s) => `${s.reps ?? '?'}${s.weightKg != null ? `×${s.weightKg} kg` : ''}`).join(', ')}`}
          </Text>
        ))}
        {w.notes ? <Muted>{w.notes}</Muted> : null}
        {band ? (
          <Button
            label={`Band’s view: added ${band.strain.toFixed(1)} to the day`}
            variant="secondary"
            onPress={() => router.push({ pathname: '/activity', params: { date, start: String(band.start) } })}
          />
        ) : null}
      </Card>
    </Screen>
  );
}

/** One or two sentences: how intense it was, and against your usual for this kind of workout. */
function pushSummary(a: WorkoutAnalysis, usual: number | null, kindLabel: string): string {
  const parts: string[] = [];
  if (a.avgReserve != null) {
    const hard = a.zoneMinutes[4] + a.zoneMinutes[5];
    parts.push(
      `You averaged ${a.avgBpm} bpm, ${Math.round(a.avgReserve * 100)}% of your heart-rate reserve${
        hard >= 1 ? `, with ${formatMinutes(hard)} in zones 4–5` : ''
      }.`,
    );
  } else {
    parts.push('No heart rate from the band for this one, so strain is from your effort rating.');
  }
  if (usual != null) {
    const diff = a.strain - usual;
    parts.push(
      Math.abs(diff) < 1
        ? `About your usual ${kindLabel} (${usual.toFixed(1)}).`
        : `${diff > 0 ? 'Harder' : 'Easier'} than your usual ${kindLabel} (${usual.toFixed(1)}).`,
    );
  }
  return parts.join(' ');
}

/** The effort you gave against the one heart rate matches. */
function effortComparison(a: WorkoutAnalysis, effort: number | undefined): string {
  const heart = a.heartRateEffort;
  if (heart == null) return 'Too little heart rate to say how hard your heart worked.';
  if (!effort) return `Heart rate says this was about a ${heart}/10. Tell the coach how hard it felt (1–10) to compare.`;
  if (Math.abs(effort - heart) <= 1) return `You rated it ${effort}/10 and your heart agrees (about ${heart}/10).`;
  return effort > heart
    ? `You rated it ${effort}/10; your heart alone says about ${heart}/10. Common for lifting and intervals: the muscles work harder than the heart shows.`
    : `You rated it ${effort}/10, but your heart worked like a ${heart}/10: you pushed harder than it felt.`;
}

/** Calories, built up from what you'd burn at rest plus what each zone added. */
function CaloriesCard({ a, weighInAt }: { a: WorkoutAnalysis; weighInAt: number | null }) {
  const colors = useColors();
  const c = a.calories;
  const parts = [...c.extra.zones, c.extra.noHeartRate];
  const scale = Math.max(...parts, 1);
  const basis = c.basis;
  const zoneLabel = (i: number) => (i === 0 ? 'Light movement (below zone 1)' : `Zone ${i}`);
  const missing = [
    basis.weightKnown ? '' : `weight (assumed ${basis.weightKg} kg)`,
    basis.ageKnown ? '' : `birth date (assumed age ${basis.age})`,
    basis.sex ? '' : 'sex (men’s and women’s formulas averaged)',
  ].filter(Boolean);
  return (
    <Card title={`CALORIES · WHY ${formatCount(c.total)} KCAL`}>
      <Breakdown>
        <BreakdownTotal
          label="Your body at rest"
          detail={`What ${basis.weightKg} kg burns sitting still for ${formatMinutes(a.minutes)} (1 kcal per kg per hour)`}
          value={formatCount(c.resting)}
        />
        {c.extra.zones.map((kcal, i) =>
          a.zoneMinutes[i]! > 0 && kcal > 0 ? (
            <BreakdownFactor
              key={i}
              label={`${zoneLabel(i)} · ${formatMinutes(a.zoneMinutes[i]!)}`}
              detail={`${Math.round((kcal + (c.resting * a.zoneMinutes[i]!) / Math.max(a.minutes, 1)) / Math.max(a.zoneMinutes[i]!, 1))} kcal a minute here, from your heart rate`}
              delta={kcal}
              scale={scale}
              color={i === 0 ? colors.muted : colors.hrZones[i - 1]}
            />
          ) : null,
        )}
        {c.extra.noHeartRate > 0 ? (
          <BreakdownFactor
            label={`No heart rate · ${formatMinutes(Math.max(a.minutes - a.heartRateMinutes, 0))}`}
            detail={`Estimated from the kind of workout (${basis.met} × resting, a typical pace)`}
            delta={c.extra.noHeartRate}
            scale={scale}
            color={colors.muted}
          />
        ) : null}
        <BreakdownTotal label="Burned" value={`${formatCount(c.total)} kcal`} color={colors.calories} />
      </Breakdown>
      <Muted>{`${formatCount(c.active)} kcal of it is active: what the workout cost on top of resting. That's the part to weigh against extra food.`}</Muted>
      <Muted>
        {`From heart rate with the Keytel formula (the one most watches start from), using ${basis.weightKg} kg${
          weighInAt ? ` (weigh-in ${new Date(weighInAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})` : ''
        }, age ${basis.age}${basis.sex ? `, ${basis.sex}` : ''}. Expect ±15–20%.${
          missing.length ? ` Tell the coach your ${missing.join(', ')} to sharpen it.` : ''
        }`}
      </Muted>
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  big: { fontFamily: fonts.number, fontSize: 64, fontVariant: ['tabular-nums'] },
  heroLabel: { ...type.overline, color: colors.muted },
  body: { ...type.bodyStrong, color: colors.text },
  exercise: { ...type.body, color: colors.text },
}));
