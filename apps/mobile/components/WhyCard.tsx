import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Muted } from '@/components/ui';
import { spacing, type } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { makeStyles } from '@/lib/theme';
import type { WhyLine } from '@/lib/why';

/**
 * A card of plain "what led here" sentences (lib/why.ts), each one opening what it talks about.
 * Renders nothing when there's nothing to say.
 */
export function WhyCard({ title = 'WHAT LED HERE', lines, footnote }: { title?: string; lines: WhyLine[]; footnote?: string }) {
  const styles = useStyles();
  if (!lines.length) return null;
  return (
    <Card title={title}>
      <View style={styles.list}>
        {lines.map((l) => (
          <Text
            key={l.text}
            style={styles.line}
            onPress={
              l.href
                ? () => {
                    tapHaptic();
                    router.push(l.href!);
                  }
                : undefined
            }
            accessibilityRole={l.href ? 'link' : undefined}>
            {l.href ? `${l.text}  ›` : l.text}
          </Text>
        ))}
      </View>
      {footnote ? <Muted>{footnote}</Muted> : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  list: { gap: spacing.sm },
  line: { ...type.body, color: colors.text },
}));
