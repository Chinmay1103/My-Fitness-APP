import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Workout } from './workouts';

interface WorkoutsState {
  /** Newest first. */
  workouts: Workout[];
  loaded: boolean;
  save: (workout: Workout) => void;
  remove: (id: string) => void;
  /** Exercise names used before, most recent first, for quick picks. */
  exerciseNames: string[];
}

const WorkoutsContext = createContext<WorkoutsState | null>(null);

interface Store {
  read(): Promise<Workout[]>;
  write(workouts: Workout[]): void;
}

/**
 * Workouts live in a JSON file in the app's documents folder. expo-file-system is loaded lazily
 * (like Health Connect and AsyncStorage) so a missing native module can't crash the app; then the
 * log only lasts until the app closes.
 */
function openStore(): Store {
  try {
    const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const file = new File(Paths.document, 'workouts.json');
    return {
      read: async () => (file.exists ? (JSON.parse(await file.text()) as Workout[]) : []),
      write: (workouts) => {
        if (!file.exists) file.create();
        file.write(JSON.stringify(workouts));
      },
    };
  } catch {
    let memory: Workout[] = [];
    return { read: async () => memory, write: (w) => void (memory = w) };
  }
}

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const store = useMemo(openStore, []);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    store
      .read()
      .then((list) => setWorkouts(list.sort((a, b) => b.start - a.start)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [store]);

  const update = useCallback(
    (change: (list: Workout[]) => Workout[]) => {
      setWorkouts((list) => {
        const next = change(list).sort((a, b) => b.start - a.start);
        store.write(next);
        return next;
      });
    },
    [store],
  );

  const save = useCallback(
    (workout: Workout) => update((list) => [...list.filter((w) => w.id !== workout.id), workout]),
    [update],
  );
  const remove = useCallback((id: string) => update((list) => list.filter((w) => w.id !== id)), [update]);

  const exerciseNames = useMemo(() => {
    const seen = new Map<string, string>();
    for (const w of workouts) {
      for (const e of w.exercises ?? []) {
        const name = e.name.trim();
        if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
      }
    }
    return [...seen.values()];
  }, [workouts]);

  return (
    <WorkoutsContext.Provider value={{ workouts, loaded, save, remove, exerciseNames }}>
      {children}
    </WorkoutsContext.Provider>
  );
}

export function useWorkouts(): WorkoutsState {
  const value = useContext(WorkoutsContext);
  if (!value) throw new Error('useWorkouts must be used inside WorkoutsProvider');
  return value;
}
