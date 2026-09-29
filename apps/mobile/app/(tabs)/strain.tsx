import { StyleSheet, View } from 'react-native';

import { ScoreRing } from '@/components/ScoreRing';
import { TrendBars } from '@/components/TrendBars';
import { Card, Muted, Screen, Stat } from '@/components/ui';
import { colors } from '@/constants/theme';
import { formatMinutes } from '@/lib/format';
import { useScores } from '@/lib/ScoresProvider';

const ZONE_COLORS = ['#5B6573', '#2E86DE', '#2ED573', '#F5A623', '#FF4757'];

function strainLabel(strain: number): string {
  if (strain < 10) return 'Light';
  if (strain < 14) return 'Moderate';
  if (strain < 18) return 'Strenuous';
  return 'All out';
}

export default function StrainScreen() {
  const { scores } = useScores();
  const today = scores.at(-1);
  if (!today) return <Screen><Muted>No data yet.</Muted></Screen>;

  const { strain, zoneMinutes } = today.strain;
  const maxZone = Math.max(...zoneMinutes, 1);

  return (
    <Screen>
      <Card>
        <View style={styles.hero}>
          <ScoreRing label="DAY STRAIN" display={strain.toFixed(1)} progress={strain / 21} color={colors.strain} size={140} />
          <Muted>
            {strainLabel(strain)} day. Strain runs from 0 to 21 and gets harder to raise the higher it goes.
          </Muted>
        </View>
      </Card>

      <Card title="TIME IN HEART RATE ZONES">
        {zoneMinutes.map((minutes, i) => (
          <View key={i} style={styles.zoneRow}>
            <Stat label={`Zone ${i + 1}`} value={formatMinutes(minutes)} />
            <View style={styles.zoneTrack}>
              <View style={{ flex: minutes / maxZone, backgroundColor: ZONE_COLORS[i], borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </Card>

      <Card title="STRAIN, LAST 14 DAYS">
        <TrendBars max={21} color={colors.strain} points={scores.slice(-14).map((s) => ({ date: s.date, value: s.strain.strain }))} />
      </Card>

      <Card title="COMING NEXT">
        <Muted>Individual workouts from the Fitbit Air will show up here in milestone 1.</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneTrack: { flex: 2, height: 10, flexDirection: 'row' },
});
