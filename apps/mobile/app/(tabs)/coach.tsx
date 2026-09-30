import { StyleSheet, View } from 'react-native';

import { Card, Muted, Pill, Screen } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

const LOG_EXAMPLES = [
  'Push day: bench 3×8 at 60, OHP 3×10 at 30',
  'Ran 5k in 28 minutes this morning',
  'Played football for an hour, pretty hard',
  'Lunch was 2 rotis, dal and a bowl of curd',
];

const ASK_EXAMPLES = ['Should I train legs today?', 'Why was my sleep score low?', 'Is my HRV trending down?'];

export default function CoachScreen() {
  return (
    <Screen overline="COACH" title="Tell me about your day" glow={colors.muted}>
      <Card title="COMING NEXT">
        <Muted>
          One chat for everything: type or use your keyboard&apos;s mic to say what you trained or ate, and the coach
          records it. Ask it anything too; it answers from your own recovery, sleep, strain, workouts and meals.
        </Muted>
      </Card>
      <Card title="SAY WHAT YOU DID OR ATE">
        <View style={styles.examples}>
          {LOG_EXAMPLES.map((q) => (
            <Pill key={q}>{q}</Pill>
          ))}
        </View>
      </Card>
      <Card title="OR ASK">
        <View style={styles.examples}>
          {ASK_EXAMPLES.map((q) => (
            <Pill key={q}>{q}</Pill>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  examples: { gap: spacing.sm },
});
