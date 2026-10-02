import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Input, Muted, Pill, Screen } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { continueInClaude, openInClaude, shareToClaude } from '@/lib/claudeHandoff';
import { parseChatLink, setCoachChat, useCoachChat } from '@/lib/coachChat';
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
 * Once the user saves a chat's link, questions go to that one chat (copied, to paste there) so the
 * conversation keeps its context; "New chat instead" still starts a fresh one.
 */
export default function CoachScreen() {
  const { sourceId, syncNow } = useScores();
  const [question, setQuestion] = useState('');
  const [opening, setOpening] = useState(false);
  const chat = useCoachChat();
  const [link, setLink] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const handOff = async (send: (q: string) => Promise<void>, q: string) => {
    setOpening(true);
    try {
      await Promise.race([syncNow(), new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
      await send(q.trim());
    } finally {
      setOpening(false);
    }
  };
  const askNew = (q: string) => handOff(openInClaude, q);
  const ask = (q: string) =>
    chat
      ? handOff(async (text) => {
          const copied = await continueInClaude(chat, text);
          setNote(
            copied
              ? 'Your question is copied: paste it into the chat and send.'
              : "This build can't copy text yet (it needs the next app build), so type your question in the chat.",
          );
        }, q)
      : askNew(q);

  const saveLink = () => {
    const url = parseChatLink(link);
    if (!url) {
      setNote(
        link.includes('/share/')
          ? "That's a share link (a read-only copy). Copy the chat's own address instead: it has /chat/ in it."
          : "That doesn't look like a Claude chat link. It should look like claude.ai/chat/…",
      );
      return;
    }
    setCoachChat(url);
    setLink('');
    setNote(null);
  };

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
        <Button
          label={opening ? 'Opening Claude…' : chat ? 'Ask in my chat' : 'Ask Claude'}
          onPress={() => ask(question)}
          disabled={!question.trim() || opening}
        />
        <Button
          label={chat ? 'New chat instead' : 'Share to Claude instead'}
          variant="secondary"
          onPress={() => (chat ? askNew(question) : handOff(shareToClaude, question))}
          disabled={!question.trim() || opening}
        />
        {note && <Muted>{note}</Muted>}
        <View style={styles.wrap}>
          {QUESTIONS.map((q) => (
            <Pill key={q} onPress={() => ask(q)}>
              {q}
            </Pill>
          ))}
        </View>
      </Card>

      <Card title="ONE ONGOING CHAT">
        {chat ? (
          <>
            <Muted>
              Questions go to your saved chat, so Claude keeps the whole conversation in mind. Claude can&apos;t fill in a
              question for an existing chat, so the app copies it for you to paste.
            </Muted>
            <Button label="Forget this chat" variant="secondary" onPress={() => setCoachChat(null)} />
          </>
        ) : (
          <>
            <Muted>
              To keep talking in one chat: ask once, then copy that chat&apos;s link (easiest in a browser, from the address
              bar; it looks like claude.ai/chat/…) and paste it here.
            </Muted>
            <Input
              value={link}
              onChangeText={setLink}
              placeholder="https://claude.ai/chat/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Button label="Save chat" variant="secondary" onPress={saveLink} disabled={!link.trim()} />
          </>
        )}
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
