import { activeZoneMinutes, estimateMaxHr, MOCK_PROFILE } from '@fitness/scoring';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { HeartRateChart } from '@/components/charts/HeartRateChart';
import { Button, Card, Muted, Row, Screen, Stat } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { formatDate, formatMinutes, formatTime } from '@/lib/format';
import { useScores } from '@/lib/ScoresProvider';
import { makeStyles, useColors } from '@/lib/theme';
import { KINDS, effortLabel, type WorkoutKind } from '@/lib/workouts';

const PAD = 5 * 60_000;

/**
 * One stretch of effort from the strain breakdown: its heart rate minute by minute, the zones it
 * spent time in, how much strain it added, and the logged workout it matches (or a nudge to tell
 * the coach what it was, so a calm gym session gets its full strain).
 */
export default function ActivityScreen() {
  const { date, start } = useLocalSearchParams<{ date: string; start: string }>();
  const colors = useColors();
  const styles = useStyles();
  const { scores, days } = useScores();
  const score = scores.find((s) => s.date === date);
  const day = days.find((d) => d.date === date);
  const activity = score?.strain.activities.find((a) => String(a.start) === start);
  if (!score || !day || !activity) {
    return (
      <Screen back title="Activity">
        <Muted>This activity isn’t in the loaded days anymore.</Muted>
      </Screen>
    );
  }

  const workout = activity.workout ? day.workouts?.find((w) => w.id === activity.workout!.id) : undefined;
  const kind = (activity.workout?.kind ?? 'other') as WorkoutKind;
  const title = activity.workout ? activity.workout.title || KINDS[kind]?.label || 'Workout' : 'Activity';
  const restingHr = day.restingHr ?? 60;
  const maxHr = estimateMaxHr(MOCK_PROFILE);
  const inside = day.heartRate.filter((s) => s.time >= activity.start && s.time <= activity.end);
  const zones = activeZoneMinutes(inside, restingHr, MOCK_PROFILE);
  const share = score.strain.strain > 0 ? Math.round((activity.strain / score.strain.strain) * 100) : 0;

  return (
    <Screen back overline={`${formatTime(activity.start)} – ${formatTime(activity.end)}`} title={title} glow={colors.strain}>
      <Card>
        <View style={styles.hero}>
          <Text style={[styles.strain, { color: colors.strain }]}>{activity.strain.toFixed(1)}</Text>
          <Text style={styles.heroLabel}>STRAIN ADDED</Text>
          <Muted>{`${share}% of ${formatDate(score.date).split(',')[0]}'s ${score.strain.strain.toFixed(1)}.`}</Muted>
        </View>
        <Row>
          <Stat label="Effort time" value={formatMinutes(activity.minutes)} />
          <Stat label="Average" value={activity.avgBpm ? `${activity.avgBpm}` : '--'} hint="bpm" />
          <Stat label="Peak" value={activity.maxBpm ? `${activity.maxBpm}` : '--'} hint="bpm" />
        </Row>
      </Card>

      <Card title="HEART RATE">
        <HeartRateChart
          samples={day.heartRate}
          date={day.date}
          restingHr={restingHr}
          maxHr={maxHr}
          window={{ start: activity.start - PAD, end: activity.end + PAD }}
        />
        <Row>
          <Stat label="Fat burn" value={`${zones.fatBurn}`} hint="min" color={colors.hrZones[1]} />
          <Stat label="Cardio" value={`${zones.cardio}`} hint="min" color={colors.hrZones[3]} />
          <Stat label="Peak" value={`${zones.peak}`} hint="min" color={colors.hrZones[4]} />
        </Row>
      </Card>

      {activity.workout ? (
        <Card title="WHAT YOU LOGGED">
          <Text style={styles.body}>
            {`${KINDS[kind]?.label ?? activity.workout.kind}${workout?.effort ? ` · effort ${workout.effort}/10 (${effortLabel(workout.effort)})` : ''}`}
          </Text>
          {activity.effortStrain ? (
            <Muted>{`Heart rate alone missed some of this one, so your effort rating added ${activity.effortStrain.toFixed(1)} of its strain. Lifting is like that: hard on muscles, easy on the heart.`}</Muted>
          ) : workout?.effort ? (
            <Muted>Heart rate already showed at least as much effort as you rated, so the score is all heart rate.</Muted>
          ) : (
            <Muted>No effort rating, so strain is from heart rate only. Tell the coach how hard it felt (1–10) to count lifting properly.</Muted>
          )}
        </Card>
      ) : (
        <Card title="WHAT WAS THIS?">
          <Muted>
            The band picked up effort but nothing’s logged. Tell the coach what it was and how hard it felt, e.g. “that was 45
            min of football, effort 7”. A gym session counts more once it has an effort rating.
          </Muted>
          <Button label="Tell the coach" onPress={() => router.navigate('/coach')} variant="secondary" />
        </Card>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  strain: { fontFamily: fonts.number, fontSize: 64, fontVariant: ['tabular-nums'] },
  heroLabel: { ...type.overline, color: colors.muted },
  body: { ...type.bodyStrong, color: colors.text },
}));
