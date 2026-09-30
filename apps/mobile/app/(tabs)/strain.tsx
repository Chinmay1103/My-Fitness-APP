import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Breakdown, BreakdownFactor, BreakdownTotal } from '@/components/Breakdown';
import { ScoreRing } from '@/components/ScoreRing';
import { TrendLine } from '@/components/TrendLine';
import { Card, Muted, Screen, Stat } from '@/components/ui';
import { colors } from '@/constants/theme';
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

      <Card title="TIME IN HEART RATE ZONES">
        {zoneMinutes.map((minutes, i) => (
          <View key={i} style={styles.zoneRow}>
            <Stat label={`Zone ${i + 1}`} value={formatMinutes(minutes)} color={colors.hrZones[i]} />
            <View style={styles.zoneTrack}>
              <LinearGradient
                colors={[`${colors.hrZones[i]}80`, colors.hrZones[i]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: minutes / maxZone, borderRadius: 5 }}
              />
            </View>
          </View>
        ))}
      </Card>

      <Card title="STRAIN, LAST 14 DAYS">
        <TrendLine
          label="Strain"
          max={21}
          color={colors.strain}
          points={scores.slice(-14).map((s) => ({ date: s.date, value: s.strain.strain }))}
        />
      </Card>

    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneTrack: { flex: 2, height: 10, flexDirection: 'row', backgroundColor: colors.track, borderRadius: 5, overflow: 'hidden' },
});
