import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { gradientsFor, palettes, type Gradients, type Palette } from '@/constants/theme';
import { localStore } from './storage';

/** Follow the phone's setting, or always light / always dark. Picked on the Account screen. */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'themePreference';

interface ThemeState {
  colors: Palette;
  gradients: Gradients;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceRaw] = useState<ThemePreference>('system');

  useEffect(() => {
    localStore
      .getItem(KEY)
      .then((saved) => {
        if (saved === 'system' || saved === 'light' || saved === 'dark') setPreferenceRaw(saved);
      })
      .catch(() => {});
  }, []);

  const scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo<ThemeState>(() => {
    const colors = palettes[scheme];
    return {
      colors,
      gradients: gradientsFor(colors),
      preference,
      setPreference: (p) => {
        setPreferenceRaw(p);
        localStore.setItem(KEY, p).catch(() => {});
      },
    };
  }, [scheme, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

/** The current palette (light or dark). */
export function useColors(): Palette {
  return useTheme().colors;
}

/**
 * Styles that depend on the palette: `const useStyles = makeStyles((c) => ({ ... }))` at module
 * level, then `const styles = useStyles()` in the component. Built once per palette.
 */
export function makeStyles<T>(factory: (c: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const colors = useColors();
    let styles = cache.get(colors);
    if (!styles) {
      styles = factory(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}
