import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, Screen } from '@/components/ui';
import { colors, fonts, spacing, type } from '@/constants/theme';
import { formatMinutes } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { useScores } from '@/lib/ScoresProvider';
import {
  dayLabel,
  detectedActivities,
  KINDS,
  timeRange,
  unlabeledActivities,
  workoutStrain,
  workoutSummary,
  workoutTitle,
} from '@/lib/workouts';
import { useWorkouts } from '@/lib/WorkoutsProvider';

const RECENT_DAYS = 14;

export default function LogScreen() {
  const { scores } = useScores();
  const { workouts } = useWorkouts();
  // A week of detected activities for strain on recent workouts; the last 3 days for "label it".
  const activities = detectedActivities(scores, 7);
  const unlabeled = unlabeledActivities(detectedActivities(scores, 3), workouts);
  const recent = workouts.filter((w) => w.start > Date.now() - RECENT_DAYS * 86400000);

  return (
    <Screen overline="LOG" title="Workouts" glow={colors.strain}>
      <Button label="Log a workout" onPress={() => router.push('/workout')} />

      {unlabeled.length ? (
        <Card title="DETECTED BY YOUR BAND">
          <Muted>Stretches of effort from your heart rate. Say what they were so the coach knows.</Muted>
          {unlabeled.map((a) => {
            const minutes = Math.max(1, Math.round((a.end - a.start) / 60000));
            return (
              <View key={a.start} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    {dayLabel(a.start)}, {timeRange(a.start, minutes)}
                  </Text>
                  <Text style={styles.rowDetail}>
                    {formatMinutes(a.minutes)} of effort · avg {a.avgBpm} bpm · strain {a.strain.toFixed(1)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    tapHaptic();
                    router.push({ pathname: '/workout', params: { start: String(a.start), minutes: String(minutes) } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Label the activity at ${timeRange(a.start, minutes)}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.labelButton, pressed && styles.pressed]}>
                  <Text style={styles.labelButtonText}>Label it</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Card title={`LAST ${RECENT_DAYS} DAYS`}>
        {recent.length === 0 ? (
          <Muted>Nothing logged yet. Log a session, or label one your band picked up.</Muted>
        ) : (
          recent.map((w) => {
            const strain = workoutStrain(w, activities);
            return (
              <Pressable
                key={w.id}
                onPress={() => {
                  tapHaptic();
                  router.push({ pathname: '/workout', params: { id: w.id } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.icon}>
                  <SymbolView name={KINDS[w.kind].icon} tintColor={colors.strain} size={22} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {workoutTitle(w)}
                  </Text>
                  <Text style={styles.rowDetail} numberOfLines={2}>
                    {dayLabel(w.start)} · {workoutSummary(w)}
                  </Text>
                </View>
                {strain !== null ? (
                  <View style={styles.strain}>
                    <Text style={styles.strainValue}>{strain.toFixed(1)}</Text>
                    <Text style={styles.strainLabel}>strain</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
      </Card>

      <Card title="MEALS">
        <Muted>
          Coming next: type what you ate (e.g. &quot;2 rotis and dal&quot;) or snap a photo, and the AI estimates calories and
          macros. Needs Supabase set up first.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  rowDetail: { ...type.caption, color: colors.muted },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.track,
  },
  strain: { alignItems: 'flex-end' },
  strainValue: { fontFamily: fonts.number, fontSize: 22, color: colors.strain, fontVariant: ['tabular-nums'] },
  strainLabel: { ...type.caption, fontSize: 11, color: colors.muted },
  labelButton: {
    borderColor: colors.strain,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  labelButtonText: { ...type.caption, fontSize: 13, color: colors.strain },
  pressed: { opacity: 0.6 },
});
