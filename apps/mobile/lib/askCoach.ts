import { useState } from 'react';

import { continueInClaude, openInClaude } from './claudeHandoff';
import { useCoachChat } from './coachChat';
import { useScores } from './ScoresProvider';

/** Longest wait for the upload before Claude opens anyway. */
const SYNC_WAIT_MS = 4000;

/**
 * Sends a ready-made question to the coach from any screen (e.g. "Write my weekly report"), the
 * same way the Coach tab does: upload the latest scores first, then the saved chat (copied, to
 * paste) or a new one.
 */
export function useAskCoach() {
  const { syncNow } = useScores();
  const chat = useCoachChat();
  const [busy, setBusy] = useState(false);
  const ask = async (question: string) => {
    setBusy(true);
    try {
      await Promise.race([syncNow(), new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
      if (chat) await continueInClaude(chat, question);
      else await openInClaude(question);
    } finally {
      setBusy(false);
    }
  };
  return { ask, busy };
}
