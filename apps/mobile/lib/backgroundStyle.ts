import { useSyncExternalStore } from 'react';

import { localStore } from './storage';

/**
 * What's behind every screen: photos that follow the time of day, moving lights, or a still, plain
 * page with a soft wash of the screen's color. Light mode shows Plain in place of Scenes (see Screen).
 */
export type BackgroundStyle = 'scenes' | 'aurora' | 'plain';

const KEY = 'backgroundStyle';
let current: BackgroundStyle = 'scenes';
const listeners = new Set<() => void>();

localStore
  .getItem(KEY)
  .then((saved) => {
    if (saved === 'scenes' || saved === 'aurora' || saved === 'plain') setBackgroundStyle(saved, false);
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
