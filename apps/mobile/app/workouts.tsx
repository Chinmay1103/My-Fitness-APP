import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/charts/Sparkline';
import { Card, Muted, Screen } from '@/components/ui';
import { fonts, spacing, type, withAlpha } from '@/constants/theme';
import { formatMinutes, formatTime, localDate } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import type { LoggedWorkoutDetail } from '@/lib/logged';
import { useScores } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';
import { KINDS, effortLabel, type WorkoutKind } from '@/lib/workouts';

interface Lift {
  name: string;
  /** Heaviest set per session, oldest first. */
  sessions: { date: string; kg: number; reps: number | null }[];
}

/**
 * Every workout you told the coach about, newest first, with what the band measured during it
 * (strain, heart rate) and, for gym work, how your lifts are progressing.
 */
export default function WorkoutsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { scores, days, logged } = useScores();

  const workouts = useMemo(() => {
    const byId = new Map<string, LoggedWorkoutDetail>(logged.workouts.map((w) => [w.id, w]));
    for (const d of days) for (const w of d.workouts ?? []) if (!byId.has(w.id)) byId.set(w.id, w);
    return [...byId.values()].sort((a, b) => b.start - a.start);
  }, [logged.workouts, days]);

  const bandFor = (w: LoggedWorkoutDetail) => {
    const date = localDate(w.start);
    const activity = scores.find((s) => s.date === date)?.strain.activities.find((a) => a.workout?.id === w.id);
    return activity ? { date, activity } : null;
  };

  const lifts = useMemo(() => {
    const map = new Map<string, Lift>();
    for (const w of [...workouts].reverse()) {
      for (const e of w.exercises ?? []) {
        const top = e.sets.reduce<{ kg: number; reps: number | null } | null>(
          (best, s) => (s.weightKg != null && (!best || s.weightKg > best.kg) ? { kg: s.weightKg, reps: s.reps } : best),
          null,
        );
        if (!top) continue;
        const key = e.name.trim().toLowerCase();
        const lift = map.get(key) ?? { name: e.name.trim(), sessions: [] };
        lift.sessions.push({ date: localDate(w.start), ...top });
        map.set(key, lift);
      }
    }
    return [...map.values()].filter((l) => l.sessions.length >= 2).sort((a, b) => b.sessions.length - a.sessions.length).slice(0, 6);
  }, [workouts]);

  const totalStrain = workouts.slice(0, 7).reduce((sum, w) => sum + (bandFor(w)?.activity.strain ?? 0), 0);

  return (
    <Screen back overline="WORKOUTS" title="History" glow={colors.strain}>
      {lifts.length ? (
        <Card title="LIFT PROGRESS">
          {lifts.map((l) => (
            <LiftRow key={l.name} lift={l} />
          ))}
          <Muted>Heaviest set each session, from what you told the coach.</Muted>
        </Card>
      ) : null}

      {workouts.length ? (
        <Card title={`${workouts.length} WORKOUT${workouts.length === 1 ? '' : 'S'}`}>
          {workouts.slice(0, 40).map((w, i) => {
            const band = bandFor(w);
            const kind = (KINDS[w.kind as WorkoutKind] ? w.kind : 'other') as WorkoutKind;
            const minutes = Math.round((w.end - w.start) / 60_000);
            const details = [
              `${formatTime(w.start)} · ${formatMinutes(minutes)}`,
              w.effort ? `effort ${w.effort}/10 (${effortLabel(w.effort)})` : '',
              w.distanceKm ? `${w.distanceKm} km` : '',
              w.exercises?.length ? `${w.exercises.length} exercises` : '',
            ].filter(Boolean);
            return (
              <Pressable
                key={w.id}
                disabled={!band}
                onPress={() => {
                  if (!band) return;
                  tapHaptic();
                  router.push({ pathname: '/activity', params: { date: band.date, start: String(band.activity.start) } });
                }}
                accessibilityRole={band ? 'button' : undefined}
                style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}>
                <View style={[styles.icon, { backgroundColor: withAlpha(colors.strain, 0.16) }]}>
                  <SymbolView name={KINDS[kind].icon} tintColor={colors.strain} size={18} />
                </View>
                <View style={styles.text}>
                  <Text style={styles.title}>{w.title || KINDS[kind].label}</Text>
                  <Text style={styles.date}>{new Date(w.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                  <Text style={styles.detail}>{details.join(' · ')}</Text>
                  <Text style={styles.detail}>
                    {band
                      ? `Band: strain ${band.activity.strain.toFixed(1)}${band.activity.avgBpm ? ` · avg ${band.activity.avgBpm} bpm · peak ${band.activity.maxBpm}` : ''}${band.activity.effortStrain ? ` · +${band.activity.effortStrain.toFixed(1)} from effort` : ''}`
                      : 'Band: not matched (open the app after the workout, or the band saw no effort then)'}
                  </Text>
                </View>
                {band ? <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={colors.muted} size={16} /> : null}
              </Pressable>
            );
          })}
          <Muted>{`Last 7 workouts added ${totalStrain.toFixed(1)} strain in total. Tap one to see its heart rate.`}</Muted>
        </Card>
      ) : (
        <Card>
          <Muted>No workouts logged yet. Tell the coach what you did, with start and end time and how hard it felt: “leg day 6:10–7:05 pm, effort 8, squats 4×8 at 60 kg”.</Muted>
        </Card>
      )}
    </Screen>
  );
}

function LiftRow({ lift }: { lift: Lift }) {
  const colors = useColors();
  const styles = useStyles();
  const [w, setW] = useState(0);
  const first = lift.sessions[0]!;
  const last = lift.sessions.at(-1)!;
  const change = last.kg - first.kg;
  return (
    <View style={styles.lift}>
      <View style={styles.liftText}>
        <Text style={styles.title}>{lift.name}</Text>
        <Text style={styles.detail}>{`${first.kg} → ${last.kg} kg${last.reps ? ` × ${last.reps}` : ''} · ${lift.sessions.length} sessions`}</Text>
      </View>
      <View style={styles.liftChart} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Sparkline values={lift.sessions.map((s) => s.kg)} color={change >= 0 ? colors.recovery.green : colors.recovery.red} width={w} />
      </View>
      <Text style={[styles.change, { color: change > 0 ? colors.recovery.green : change < 0 ? colors.recovery.red : colors.muted }]}>
        {`${change > 0 ? '+' : ''}${change} kg`}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  pressed: { opacity: 0.6 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  date: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12 },
  detail: { ...type.caption, color: colors.muted },
  lift: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liftText: { flex: 2, gap: 2 },
  liftChart: { flex: 1 },
  change: { fontFamily: fonts.numberSemi, fontSize: 16, minWidth: 54, textAlign: 'right' },
}));
