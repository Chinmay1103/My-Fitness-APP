import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Input, Muted, Pill, Screen } from '@/components/ui';
import { colors, spacing, type } from '@/constants/theme';
import { buildContext, buildMessage, openInClaude, shareToClaude } from '@/lib/claudeHandoff';
import { useScores } from '@/lib/ScoresProvider';

const QUESTIONS = [
  'How should I train today?',
  'Why is my recovery where it is?',
  'How can I sleep better tonight?',
  'How was my week?',
];

/**
 * The coach lives in the Claude app: ask here (type, or use the keyboard's mic) and the app opens
 * Claude with your question and today's numbers attached. Later a connector (MCP server) will let
 * that same Claude chat record workouts and meals back into the app.
 */
export default function CoachScreen() {
  const { scores, days, sourceId } = useScores();
  const [question, setQuestion] = useState('');
  const context = useMemo(() => buildContext(scores, days, sourceId), [scores, days, sourceId]);

  const ask = (q: string) => openInClaude(buildMessage(context, q));

  return (
    <Screen overline="COACH" title="Ask Claude" glow={colors.muted}>
      <Card>
        <Input
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask anything, or tap the mic on your keyboard"
          multiline
          style={styles.question}
          maxLength={500}
        />
        <Button label="Ask Claude" onPress={() => ask(question)} disabled={!question.trim()} />
        <Button
          label="Share to Claude instead"
          variant="secondary"
          onPress={() => shareToClaude(buildMessage(context, question))}
          disabled={!question.trim()}
        />
        <View style={styles.wrap}>
          {QUESTIONS.map((q) => (
            <Pill key={q} onPress={() => ask(q)}>
              {q}
            </Pill>
          ))}
        </View>
      </Card>

      <Card title="CLAUDE WILL SEE">
        <Muted>Sent with your question, so Claude answers from your own numbers:</Muted>
        <Text style={styles.context}>{context || 'No data yet.'}</Text>
      </Card>

      <Card title="COMING: RECORD WHAT YOU DID">
        <Muted>
          Once the My Fitness connector is added to your Claude account, you&apos;ll also be able to tell Claude what you
          trained or ate (&quot;Push day, bench 3×8 at 60&quot;, &quot;2 rotis and dal for lunch&quot;) and it will save it
          here. Needs Supabase set up first.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { minHeight: 80, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  context: { ...type.caption, lineHeight: 18, color: colors.text },
});
