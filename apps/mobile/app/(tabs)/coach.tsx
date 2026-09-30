import { StyleSheet, View } from 'react-native';

import { Card, Muted, Pill, Screen } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

const EXAMPLES = [
  'Should I train legs today?',
  'Why was my sleep score low?',
  'How much protein did I eat this week?',
  'Is my HRV trending down?',
];

export default function CoachScreen() {
  return (
    <Screen overline="COACH" title="Ask about your day" glow={colors.muted}>
      <Card title="COMING IN MILESTONE 4">
        <Muted>
          Chat with a coach that sees your recovery, sleep, strain, workout plan and meals, and answers from your own
          numbers.
        </Muted>
      </Card>
      <Card title="THINGS YOU'LL BE ABLE TO ASK">
        <View style={styles.examples}>
          {EXAMPLES.map((q) => (
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
