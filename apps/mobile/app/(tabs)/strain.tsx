import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { ScoreRing } from '@/components/ScoreRing';
import { DayPager } from '@/components/Swipe';
import { ComboChart } from '@/components/charts/ComboChart';
import { Button, Card, Muted, Screen, Stat } from '@/components/ui';
import { fonts, motion, spacing, withAlpha } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { formatDate, formatMinutes, formatTime } from '@/lib/format';
import { STRAIN_TARGETS } from '@/lib/nextSteps';
import { useScores, useSelectedDay } from '@/lib/ScoresProvider';
import { KINDS, type WorkoutKind } from '@/lib/workouts';

function strainLabel(strain: number): string {
  if (strain < 10) return 'Light';
  if (strain < 14) return 'Moderate';
  if (strain < 18) return 'Strenuous';
  return 'All out';
}

export default function StrainScreen() {
  const colors = useColors();
  const styles = useStyles();
  const { scores } = useScores();
  const { score: today, isLatest } = useSelectedDay();
  const zone = today?.recovery?.zone ?? null;
  if (!today) return <Screen overline="STRAIN" title="Today so far"><Muted>No data yet.</Muted></Screen>;

  const { strain, zoneMinutes, activities, everydayStrain } = today.strain;
  const strainScale = Math.max(...activities.map((a) => a.strain), everydayStrain, 0.1);
  const maxZone = Math.max(...zoneMinutes, 1);

  return (
    <Screen overline="STRAIN" title={isLatest ? 'Today so far' : formatDate(today.date)} glow={colors.strain}>
      <Card>
        <DayPager>
          <View style={styles.hero}>
            <ScoreRing label="DAY STRAIN" value={strain} decimals={1} progress={strain / 21} color={colors.strain} size={140} />
            <Muted>
              {strainLabel(strain)} day. Strain runs from 0 to 21 and gets harder to raise the higher it goes.
            </Muted>
          </View>
        </DayPager>
      </Card>

      {zone ? <TargetCard strain={strain} zone={zone} isLatest={isLatest} /> : null}

      <Card title={`WHY ${strain.toFixed(1)}`}>
        <Breakdown>
          {activities.map((a) => (
            <BreakdownFactor
              key={a.start}
              label={
                a.workout
                  ? `${a.workout.title || KINDS[a.workout.kind as WorkoutKind]?.label || 'Workout'} · ${formatTime(a.start)}`
                  : `${formatTime(a.start)} – ${formatTime(a.end)}`
              }
              detail={[
                a.minutes > 0 ? `${formatMinutes(a.minutes)} of effort` : 'logged',
                a.avgBpm ? `avg ${a.avgBpm} bpm` : '',
                a.effortStrain ? `+${a.effortStrain.toFixed(1)} from your effort rating` : '',
                a.workout ? '' : 'not logged yet',
              ]
                .filter(Boolean)
                .join(' · ')}
              delta={a.strain}
              scale={strainScale}
              decimals={1}
              color={colors.strain}
              onPress={() => router.push({ pathname: '/activity', params: { date: today.date, start: String(a.start) } })}
            />
          ))}
          <BreakdownFactor
            label="Everyday movement"
            detail="Short bursts under 10 minutes: stairs, errands, chores"
            delta={everydayStrain}
            scale={strainScale}
            decimals={1}
            color={colors.strain}
            onPress={() => router.push({ pathname: '/metric/[key]', params: { key: 'steps' } })}
          />
          <BreakdownTotal label="Day strain" value={strain.toFixed(1)} color={colors.strain} />
        </Breakdown>
        <Muted>
          Only time above 30% of your heart-rate reserve counts, and a hard minute counts several times more than an
          easy one. Each activity gets its share of the day's total. Logged workouts with an effort rating can add
          what heart rate misses (lifting). Tap an activity to see it.
        </Muted>
      </Card>

      <Card title="LIVE HEART RATE" href="/live" linkLabel="Open" wholeCard>
        <Muted>Watch your heart rate and zone second by second during a workout, straight from the band.</Muted>
      </Card>

      <Card title="TIME IN HEART RATE ZONES" href="/heart-rate" linkLabel="Full day">
        {zoneMinutes.map((minutes, i) => (
          <View key={i} style={styles.zoneRow}>
            <Stat label={`Zone ${i + 1}`} value={formatMinutes(minutes)} color={colors.hrZones[i]} onPress={() => router.push('/heart-rate')} />
            <ZoneBar index={i} fraction={minutes / maxZone} color={colors.hrZones[i]} />
          </View>
        ))}
        <Button
          label="Active Zone Minutes this week"
          variant="secondary"
          onPress={() => router.push({ pathname: '/metric/[key]', params: { key: 'zoneMinutes' } })}
        />
      </Card>

      <Card title="STRAIN VS RECOVERY" href="/recovery" linkLabel="Recovery">
        <ComboChart
          points={scores.slice(-30).map((s) => ({
            date: s.date,
            bar: s.strain.strain,
            line: s.recovery?.score ?? null,
            lineColor: s.recovery?.zone ? colors.recovery[s.recovery.zone] : undefined,
          }))}
          bar={{ label: 'Strain', color: colors.strain, max: 21, format: (v) => v.toFixed(1) }}
          line={{ label: 'Recovery', color: colors.text, max: 100, format: (v) => `${Math.round(v)}%` }}
          describe={(p) => `${strainLabel(p.bar ?? 0)} day · woke up ${p.line != null ? `${Math.round(p.line)}% recovered` : 'not scored yet'}`}
        />
        <Muted>Push on green days, go easier on red ones: when strain stays high while recovery keeps dropping, you&apos;re overreaching.</Muted>
      </Card>

    </Screen>
  );
}

/**
 * How hard the day should be for this morning's recovery (Whoop-style), as a 0–21 scale with the
 * target shaded and where you are now marked.
 */
function TargetCard({ strain, zone, isLatest }: { strain: number; zone: keyof typeof STRAIN_TARGETS; isLatest: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const [lo, hi] = STRAIN_TARGETS[zone];
  const zoneColor = colors.recovery[zone];
  const verdict =
    strain < lo ? `${(lo - strain).toFixed(1)} below the target` : strain <= hi ? 'In the target' : `${(strain - hi).toFixed(1)} over the target`;
  return (
    <Card title={isLatest ? 'TODAY’S TARGET' : 'THAT DAY’S TARGET'}>
      <Text style={styles.targetTitle}>
        {`Strain ${lo}–${hi}`}
        <Text style={styles.targetVerdict}>{`  ·  ${verdict}`}</Text>
      </Text>
      <View style={styles.scale}>
        <View style={[styles.targetBand, { left: `${(lo / 21) * 100}%`, width: `${((hi - lo) / 21) * 100}%`, backgroundColor: withAlpha(zoneColor, 0.3), borderColor: zoneColor }]} />
        <View style={[styles.marker, { left: `${(Math.min(strain, 21) / 21) * 100}%`, backgroundColor: colors.strain }]} />
      </View>
      <View style={styles.scaleLabels}>
        {[0, 7, 14, 21].map((v) => (
          <Text key={v} style={styles.scaleLabel}>
            {v}
          </Text>
        ))}
      </View>
      <Muted>
        {zone === 'green'
          ? 'Recovery was green: your body can take a hard day.'
          : zone === 'yellow'
            ? 'Recovery was yellow: train, but keep the hardest efforts short.'
            : 'Recovery was red: keep it light so you bounce back.'}
      </Muted>
      <Button label="See this morning's recovery" variant="secondary" onPress={() => router.push('/recovery')} />
    </Card>
  );
}

/** One heart-rate zone's bar, growing in from the left after the one above it. */
function ZoneBar({ index, fraction, color }: { index: number; fraction: number; color: string }) {
  const styles = useStyles();
  const grow = useAnimatedTarget(fraction, motion.bars, index * motion.barStagger * 2);
  const style = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  return (
    <View style={styles.zoneTrack}>
      <Animated.View style={[styles.zoneFill, style]}>
        <LinearGradient colors={[`${color}80`, color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneTrack: { flex: 2, height: 10, backgroundColor: colors.track, borderRadius: 5, overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
  targetTitle: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.text },
  targetVerdict: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  scale: { height: 14, borderRadius: 7, backgroundColor: colors.track, marginTop: spacing.xs },
  targetBand: { position: 'absolute', top: 0, bottom: 0, borderRadius: 7, borderWidth: 1 },
  marker: { position: 'absolute', top: -4, width: 6, height: 22, borderRadius: 3, marginLeft: -3 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { color: colors.muted, fontFamily: fonts.numberSemi, fontSize: 12 },
}));
