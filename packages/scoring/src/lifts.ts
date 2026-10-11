import { round } from "./stats";

/**
 * Progressive overload: for every exercise the user told the coach about, did the best set get
 * better over time (more weight, or more reps at the same weight)? And per muscle, which ones are
 * moving up. Shown, never scored.
 *
 * Sets are compared by estimated one-rep max (Epley: kg × (1 + reps / 30)), so 60 kg × 8 and
 * 65 kg × 5 land on one scale. Bodyweight exercises (no weight given) compare the most reps in a set.
 */

export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "other";

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  other: "Other",
};

/** First match wins, so specific names come before the general words they contain ("leg curl" before "curl"). */
const MUSCLE_RULES: [RegExp, Muscle][] = [
  [/glute|hip thrust|bridge|abduct/, "glutes"],
  [/upright row|face pull|rear delt|reverse fly|reverse flye/, "shoulders"],
  [/close.?grip bench|skull|tricep|push.?down|kickback|french press|overhead extension|jm press/, "triceps"],
  [/chest dip/, "chest"],
  [/\bdips?\b/, "triceps"],
  [/romanian|\brdl\b|stiff.?leg|good.?morning|leg curl|hamstring|nordic/, "hamstrings"],
  [/calf|calves/, "calves"],
  [/leg extension|squat|leg press|lunge|step.?up|hack|sissy/, "quads"],
  [/back extension|hyperextension|deadlift|pull.?up|chin.?up|pulldown|pull.?down|\brows?\b|rowing|\blats?\b|pullover|shrug/, "back"],
  [/bench|chest|incline|decline|push.?up|press.?up|\bpec|fly|flye|crossover/, "chest"],
  [/overhead press|shoulder|military|\bohp\b|lateral raise|side raise|front raise|delt|arnold|landmine press/, "shoulders"],
  [/curl|hammer|bicep/, "biceps"],
  [/plank|crunch|sit.?up|\babs?\b|leg raise|knee raise|russian twist|core|hollow|ab wheel|rollout|woodchop|dead bug|pallof/, "core"],
];

/** The main muscle an exercise works, from its name. "other" when the name isn't recognised. */
export function muscleFor(name: string): Muscle {
  const n = name.toLowerCase();
  for (const [pattern, muscle] of MUSCLE_RULES) if (pattern.test(n)) return muscle;
  return "other";
}

/** "Bench Press", "bench  press" and "bench presses" are the same exercise. */
export function exerciseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map(singular)
    .join(" ");
}

function singular(word: string): string {
  if (word === "ups") return "up";
  if (word.length <= 3) return word; // abs, dbs
  if (/(ss|ch|sh|x)es$/.test(word)) return word.slice(0, -2); // presses, crunches
  if (/(ss|us|is)$/.test(word)) return word; // press, biceps-like words stay
  return word.endsWith("s") ? word.slice(0, -1) : word; // curls, rows, raises -> raise
}

export interface LiftSet {
  reps: number | null;
  weightKg: number | null;
}

/** One logged workout's exercises, on its local date. */
export interface LiftWorkout {
  date: string;
  exercises: { name: string; sets: LiftSet[] }[];
}

/** Reps beyond this barely say more about strength, so the estimate stops counting them. */
const MAX_REPS_FOR_ESTIMATE = 12;

/** Estimated one-rep max (Epley). A set with no reps counts as a single. */
export function estimatedMax(kg: number, reps: number | null): number {
  const r = Math.min(Math.max(reps ?? 1, 1), MAX_REPS_FOR_ESTIMATE);
  return r === 1 ? kg : kg * (1 + r / 30);
}

export interface ExerciseSession {
  date: string;
  sets: number;
  /** The best set by estimated max (weighted) or by reps (bodyweight). */
  best: { kg: number | null; reps: number | null };
  /** What's compared: estimated max in kg, or reps for bodyweight work. */
  measure: number;
  /** Reps × kg over all sets (0 for bodyweight). */
  volume: number;
  /** Beat every earlier session of this exercise. The first session sets the baseline and isn't one. */
  newBest: boolean;
}

export type OverloadStatus = "progressing" | "holding" | "dropping" | "new";

export interface ExerciseProgress {
  key: string;
  name: string;
  muscle: Muscle;
  bodyweight: boolean;
  sessions: ExerciseSession[];
  /** Latest session's measure against the first one, in % (null with one session). */
  change: number | null;
  status: OverloadStatus;
  /** Sessions that beat every one before them: each one is an overload. */
  newBests: number;
  lastNewBest: string | null;
}

/** Within ±this % of the first session counts as holding. */
const HOLD_BAND = 2;

function statusFor(change: number | null): OverloadStatus {
  if (change == null) return "new";
  if (change > HOLD_BAND) return "progressing";
  if (change < -HOLD_BAND) return "dropping";
  return "holding";
}

/** Progress per exercise, from workouts in any order. Most-trained exercises first. */
export function liftProgress(workouts: LiftWorkout[]): ExerciseProgress[] {
  const byKey = new Map<string, { name: string; sessions: { date: string; sets: LiftSet[] }[] }>();
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of w.exercises) {
      const sets = e.sets.filter((s) => (s.reps ?? 0) > 0 || (s.weightKg ?? 0) > 0);
      if (!sets.length || !e.name.trim()) continue;
      const key = exerciseKey(e.name);
      const entry = byKey.get(key) ?? { name: e.name.trim(), sessions: [] };
      const sameDay = entry.sessions.find((s) => s.date === w.date);
      // Two workouts with the same exercise on one day count as one session.
      if (sameDay) sameDay.sets.push(...sets);
      else entry.sessions.push({ date: w.date, sets: [...sets] });
      byKey.set(key, entry);
    }
  }

  return [...byKey.entries()]
    .map(([key, { name, sessions: raw }]) => {
      const bodyweight = raw.every((s) => s.sets.every((set) => !set.weightKg));
      let bestSoFar = -Infinity;
      const sessions = raw.map((s, i): ExerciseSession => {
        let best: ExerciseSession["best"] = { kg: null, reps: null };
        let measure = 0;
        for (const set of s.sets) {
          const m = bodyweight ? (set.reps ?? 0) : set.weightKg ? estimatedMax(set.weightKg, set.reps) : 0;
          if (m > measure) {
            measure = m;
            best = { kg: set.weightKg ?? null, reps: set.reps ?? null };
          }
        }
        const newBest = i > 0 && measure > bestSoFar;
        bestSoFar = Math.max(bestSoFar, measure);
        return {
          date: s.date,
          sets: s.sets.length,
          best,
          measure: round(measure, 1),
          volume: Math.round(s.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightKg ?? 0), 0)),
          newBest,
        };
      });
      const first = sessions[0]!;
      const latest = sessions.at(-1)!;
      const change = sessions.length > 1 && first.measure > 0 ? round(((latest.measure - first.measure) / first.measure) * 100, 1) : null;
      const bests = sessions.filter((s) => s.newBest);
      return {
        key,
        name,
        muscle: muscleFor(name),
        bodyweight,
        sessions,
        change,
        status: statusFor(change),
        newBests: bests.length,
        lastNewBest: bests.at(-1)?.date ?? null,
      };
    })
    .sort((a, b) => b.sessions.length - a.sessions.length || a.name.localeCompare(b.name));
}

export type MuscleStatus = OverloadStatus | "mixed";

export interface MuscleProgress {
  muscle: Muscle;
  exercises: ExerciseProgress[];
  /** All sets over the period. */
  sets: number;
  /** Days this muscle was trained. */
  days: number;
  status: MuscleStatus;
  /** Exercises with 2+ sessions that moved up / are being tracked. */
  progressing: number;
  tracked: number;
}

/** Exercises grouped by muscle, most-trained muscle first. */
export function muscleProgress(exercises: ExerciseProgress[]): MuscleProgress[] {
  const groups = new Map<Muscle, ExerciseProgress[]>();
  for (const e of exercises) groups.set(e.muscle, [...(groups.get(e.muscle) ?? []), e]);
  return [...groups.entries()]
    .map(([muscle, list]) => {
      const tracked = list.filter((e) => e.status !== "new");
      const up = tracked.filter((e) => e.status === "progressing").length;
      const down = tracked.filter((e) => e.status === "dropping").length;
      const status: MuscleStatus = !tracked.length ? "new" : up && down ? "mixed" : up ? "progressing" : down ? "dropping" : "holding";
      return {
        muscle,
        exercises: list,
        sets: list.reduce((sum, e) => sum + e.sessions.reduce((a, s) => a + s.sets, 0), 0),
        days: new Set(list.flatMap((e) => e.sessions.map((s) => s.date))).size,
        status,
        progressing: up,
        tracked: tracked.length,
      };
    })
    .sort((a, b) => b.sets - a.sets);
}
