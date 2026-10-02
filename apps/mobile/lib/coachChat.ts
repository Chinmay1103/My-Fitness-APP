import { useSyncExternalStore } from 'react';

import { localStore } from './storage';

/**
 * The one ongoing Claude chat the Coach tab sends questions to, so the conversation keeps its
 * context. The app can't see which chat Claude opened, so the user pastes its link once.
 */
const KEY = 'coachChatUrl';
let current: string | null = null;
const listeners = new Set<() => void>();

localStore
  .getItem(KEY)
  .then((saved) => {
    if (saved) setCoachChat(saved, false);
  })
  .catch(() => {});

/**
 * The chat's address from whatever was pasted, or null if it isn't a claude.ai chat link.
 * `claude.ai/share/...` links are read-only snapshots, so they don't count.
 */
export function parseChatLink(text: string): string | null {
  const id = text.match(/claude\.ai\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
  return id ? `https://claude.ai/chat/${id.toLowerCase()}` : null;
}

export function setCoachChat(url: string | null, save = true) {
  current = url;
  listeners.forEach((l) => l());
  if (save) (url ? localStore.setItem(KEY, url) : localStore.removeItem(KEY)).catch(() => {});
}

/** The saved chat's address, or null when questions should start a new chat. */
export function useCoachChat(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
