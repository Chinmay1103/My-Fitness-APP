import { useSyncExternalStore } from 'react';

import { localStore } from './storage';

/** What's behind every screen: painted landscapes that follow the time of day, or moving lights. */
export type BackgroundStyle = 'scenes' | 'aurora';

const KEY = 'backgroundStyle';
let current: BackgroundStyle = 'scenes';
const listeners = new Set<() => void>();

localStore
  .getItem(KEY)
  .then((saved) => {
    if (saved === 'scenes' || saved === 'aurora') setBackgroundStyle(saved, false);
  })
  .catch(() => {});

export function setBackgroundStyle(style: BackgroundStyle, save = true) {
  current = style;
  listeners.forEach((l) => l());
  if (save) localStore.setItem(KEY, style).catch(() => {});
}

/** The chosen background; every screen switches together when it changes. */
export function useBackgroundStyle(): BackgroundStyle {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
