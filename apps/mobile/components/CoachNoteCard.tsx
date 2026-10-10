import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { fonts, spacing, type } from '@/constants/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { formatTime } from '@/lib/format';
import type { CoachNote } from '@/lib/coachNote';

/** Claude's note for today, under the score rings: headline, why, and up to three things to do. */
export function CoachNoteCard({ note, accent }: { note: CoachNote; accent: string }) {
  const styles = useStyles();
  return (
    <Card title="COACH NOTE" href="/coach" linkLabel="Ask about it" wholeCard>
      <Text style={[styles.headline, { color: accent }]}>{note.headline}</Text>
      <Text style={styles.body}>{note.why}</Text>
      {note.tips.length ? (
        <View style={styles.tips}>
          {note.tips.map((tip, i) => (
            <View key={i} style={styles.tip}>
              <Text style={[styles.bullet, { color: accent }]}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.footer}>From Claude · {formatTime(new Date(note.updatedAt).getTime())}</Text>
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  headline: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  body: { ...type.body, color: colors.text },
  tips: { gap: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.sm },
  bullet: { ...type.body, fontFamily: fonts.bodySemi },
  tipText: { ...type.body, color: colors.text, flex: 1 },
  footer: { ...type.body, fontSize: 12, color: colors.muted },
}));
