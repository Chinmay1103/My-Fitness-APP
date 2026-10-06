import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { ScoreRing } from '@/components/ScoreRing';
import { ComboChart } from '@/components/charts/ComboChart';
import { Button, Card, Muted, Screen, Stat } from '@/components/ui';
import { colors, motion } from '@/constants/theme';
import { useAnimatedTarget } from '@/lib/animation';
import { formatMinutes, formatTime } from '@/lib/format';
import { useScores } from '@/lib/ScoresProvider';

function strainLabel(strain: number): string {
  if (strain < 10) return 'Light';
  if (strain < 14) return 'Moderate';
  if (strain < 18) return 'Strenuous';
  return 'All out';
}

export default function StrainScreen() {
  const { scores } = useScores();
  const today = scores.at(-1);
  if (!today) return <Screen overline="STRAIN" title="Today so far"><Muted>No data yet.</Muted></Screen>;

  const { strain, zoneMinutes, activities, everydayStrain } = today.strain;
  const strainScale = Math.max(...activities.map((a) => a.strain), everydayStrain, 0.1);
  const maxZone = Math.max(...zoneMinutes, 1);

  return (
    <Screen overline="STRAIN" title="Today so far" glow={colors.strain}>
      <Card>
        <View style={styles.hero}>
          <ScoreRing label="DAY STRAIN" value={strain} decimals={1} progress={strain / 21} color={colors.strain} size={140} />
          <Muted>
            {strainLabel(strain)} day. Strain runs from 0 to 21 and gets harder to raise the higher it goes.
          </Muted>
        </View>
      </Card>

      <Card title={`WHY ${strain.toFixed(1)}`}>
        <Breakdown>
          {activities.map((a) => (
            <BreakdownFactor
              key={a.start}
              label={`${formatTime(a.start)} – ${formatTime(a.end)}`}
              detail={`${formatMinutes(a.minutes)} of effort · avg ${a.avgBpm} bpm · peak ${a.maxBpm} bpm`}
              delta={a.strain}
              scale={strainScale}
              decimals={1}
              color={colors.strain}
            />
          ))}
          <BreakdownFactor
            label="Everyday movement"
            detail="Short bursts under 10 minutes: stairs, errands, chores"
            delta={everydayStrain}
            scale={strainScale}
            decimals={1}
            color={colors.strain}
          />
          <BreakdownTotal label="Day strain" value={strain.toFixed(1)} color={colors.strain} />
        </Breakdown>
        <Muted>
          Only time above 30% of your heart-rate reserve counts, and a hard minute counts several times more than an
          easy one. Each activity gets its share of the day's total.
        </Muted>
      </Card>

      <Card title="LIVE HEART RATE">
        <Muted>Watch your heart rate and zone second by second during a workout, straight from the band.</Muted>
        <Button label="Open live heart rate" variant="secondary" onPress={() => router.push('/live')} />
      </Card>

      <Card title="TIME IN HEART RATE ZONES">
        {zoneMinutes.map((minutes, i) => (
          <View key={i} style={styles.zoneRow}>
            <Stat label={`Zone ${i + 1}`} value={formatMinutes(minutes)} color={colors.hrZones[i]} />
            <ZoneBar index={i} fraction={minutes / maxZone} color={colors.hrZones[i]} />
          </View>
        ))}
      </Card>

      <Card title="STRAIN VS RECOVERY">
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

/** One heart-rate zone's bar, growing in from the left after the one above it. */
function ZoneBar({ index, fraction, color }: { index: number; fraction: number; color: string }) {
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

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneTrack: { flex: 2, height: 10, backgroundColor: colors.track, borderRadius: 5, overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
});
