import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Input, Muted, Pill, Screen } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { openInClaude, shareToClaude } from '@/lib/claudeHandoff';
import { useScores } from '@/lib/ScoresProvider';

const QUESTIONS = [
  'How should I train today?',
  'Why is my recovery where it is?',
  'How can I sleep better tonight?',
  'How was my week?',
];

/** Only bounds the wait before opening Claude; a slow upload still finishes in the background. */
const SYNC_WAIT_MS = 4000;

/**
 * The coach lives in the Claude app: ask here (type, or use the keyboard's mic) and the app opens
 * Claude with just your question. Claude reads your scores, workouts and meals itself through the
 * My Fitness connector, so no numbers clutter the chat. The latest scores are uploaded first.
 */
export default function CoachScreen() {
  const { sourceId, syncNow } = useScores();
  const [question, setQuestion] = useState('');
  const [opening, setOpening] = useState(false);

  const handOff = async (send: (q: string) => Promise<void>, q: string) => {
    setOpening(true);
    try {
      await Promise.race([syncNow(), new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
      await send(q.trim());
    } finally {
      setOpening(false);
    }
  };
  const ask = (q: string) => handOff(openInClaude, q);

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
        <Button label={opening ? 'Opening Claude…' : 'Ask Claude'} onPress={() => ask(question)} disabled={!question.trim() || opening} />
        <Button
          label="Share to Claude instead"
          variant="secondary"
          onPress={() => handOff(shareToClaude, question)}
          disabled={!question.trim() || opening}
        />
        <View style={styles.wrap}>
          {QUESTIONS.map((q) => (
            <Pill key={q} onPress={() => ask(q)}>
              {q}
            </Pill>
          ))}
        </View>
      </Card>

      <Card title="HOW CLAUDE KNOWS YOUR DAY">
        <Muted>
          Only your question goes into the chat. Claude reads your recovery, strain, sleep, workouts and meals itself
          through the My Fitness connector, and you can tell it what you trained or ate (&quot;Push day, bench 3×8 at
          60&quot;, &quot;2 rotis and dal for lunch&quot;) to have it saved.
        </Muted>
        {sourceId === 'mock' && (
          <Muted>You&apos;re on demo data, which is never uploaded, so Claude won&apos;t see these scores yet.</Muted>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  question: { minHeight: 80, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
