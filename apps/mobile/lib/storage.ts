import { TurboModuleRegistry } from 'react-native';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Small things kept on the phone between launches (the sign-in, display settings): AsyncStorage.
 * Like Health Connect, AsyncStorage throws as soon as it's imported if its native part isn't in the
 * build (an APK built before it was added), so it's only loaded when present. Without it, values
 * last until the app closes.
 */
function load(): KeyValueStore {
  if (TurboModuleRegistry.get('RNCAsyncStorage')) {
    return require('@react-native-async-storage/async-storage').default as KeyValueStore;
  }
  const memory = new Map<string, string>();
  return {
    getItem: async (k) => memory.get(k) ?? null,
    setItem: async (k, v) => void memory.set(k, v),
    removeItem: async (k) => void memory.delete(k),
  };
}

export const localStore = load();
