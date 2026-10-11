import { describe, expect, it } from "vitest";

import { estimatedMax, exerciseKey, liftProgress, muscleFor, muscleProgress, type LiftWorkout } from "../src/lifts";

describe("muscleFor", () => {
  it.each([
    ["Bench press", "chest"],
    ["Incline dumbbell press", "chest"],
    ["Close-grip bench press", "triceps"],
    ["Tricep pushdown", "triceps"],
    ["Dips", "triceps"],
    ["Chest dips", "chest"],
    ["Overhead press", "shoulders"],
    ["Lateral raise", "shoulders"],
    ["Upright row", "shoulders"],
    ["Reverse fly", "shoulders"],
    ["Cable fly", "chest"],
    ["Barbell row", "back"],
    ["Lat pulldown", "back"],
    ["Pull-ups", "back"],
    ["Deadlift", "back"],
    ["Romanian deadlift", "hamstrings"],
    ["Leg curl", "hamstrings"],
    ["Bicep curl", "biceps"],
    ["Hammer curls", "biceps"],
    ["Back squat", "quads"],
    ["Bulgarian split squat", "quads"],
    ["Leg press", "quads"],
    ["Hip thrust", "glutes"],
    ["Glute kickback", "glutes"],
    ["Standing calf raise", "calves"],
    ["Plank", "core"],
    ["Hanging leg raise", "core"],
    ["Surya namaskar", "other"],
  ])("%s -> %s", (name, muscle) => {
    expect(muscleFor(name)).toBe(muscle);
  });
});

describe("exerciseKey", () => {
  it("treats case, spacing and plurals as the same exercise", () => {
    expect(exerciseKey("Bench  Press")).toBe(exerciseKey("bench presses"));
    expect(exerciseKey("Pull-ups")).toBe(exerciseKey("pull up"));
    expect(exerciseKey("Abs")).toBe("abs"); // too short to strip
  });
});

describe("estimatedMax", () => {
  it("puts different rep ranges on one scale", () => {
    expect(estimatedMax(100, 1)).toBe(100);
    expect(estimatedMax(60, 8)).toBeCloseTo(76);
    expect(estimatedMax(65, 5)).toBeCloseTo(75.83, 1);
    expect(estimatedMax(20, 30)).toBe(estimatedMax(20, 12)); // capped
  });
});

const w = (date: string, ...exercises: LiftWorkout["exercises"]): LiftWorkout => ({ date, exercises });
const sets = (n: number, reps: number | null, weightKg: number | null) => Array.from({ length: n }, () => ({ reps, weightKg }));

describe("liftProgress", () => {
  const workouts = [
    w("2026-10-08", { name: "Bench press", sets: sets(3, 8, 62.5) }, { name: "Pull-ups", sets: sets(3, 9, null) }),
    w("2026-10-01", { name: "bench press", sets: sets(3, 8, 60) }, { name: "Pull-ups", sets: sets(3, 7, null) }, { name: "Overhead press", sets: sets(3, 6, 40) }),
    w("2026-10-04", { name: "Bench Press", sets: sets(3, 8, 60) }, { name: "Overhead press", sets: sets(3, 5, 35) }),
    w("2026-10-05", { name: "Squat", sets: sets(3, 5, 80) }),
  ];
  const progress = liftProgress(workouts);
  const get = (name: string) => progress.find((p) => p.name.toLowerCase() === name.toLowerCase())!;

  it("sorts sessions by date and merges spellings", () => {
    const bench = get("bench press");
    expect(bench.sessions.map((s) => s.date)).toEqual(["2026-10-01", "2026-10-04", "2026-10-08"]);
  });
  it("more weight at the same reps is an overload", () => {
    const bench = get("bench press");
    expect(bench.status).toBe("progressing");
    expect(bench.newBests).toBe(1); // the repeat at 60 kg isn't a new best
    expect(bench.lastNewBest).toBe("2026-10-08");
    expect(bench.change).toBeCloseTo(4.2, 1);
  });
  it("bodyweight work compares reps", () => {
    const pullups = get("pull-ups");
    expect(pullups.bodyweight).toBe(true);
    expect(pullups.status).toBe("progressing");
    expect(pullups.sessions.at(-1)!.measure).toBe(9);
  });
  it("less weight and fewer reps is dropping", () => {
    expect(get("overhead press").status).toBe("dropping");
  });
  it("one session is new, with no change yet", () => {
    expect(get("squat").status).toBe("new");
    expect(get("squat").change).toBeNull();
  });
  it("groups by muscle", () => {
    const muscles = muscleProgress(progress);
    const chest = muscles.find((m) => m.muscle === "chest")!;
    expect(chest.status).toBe("progressing");
    expect(chest.sets).toBe(9);
    expect(chest.days).toBe(3);
    expect(muscles.find((m) => m.muscle === "shoulders")!.status).toBe("dropping");
    expect(muscles.find((m) => m.muscle === "quads")!.status).toBe("new");
  });
  it("skips empty sets and unnamed exercises", () => {
    expect(liftProgress([w("2026-10-01", { name: "", sets: sets(3, 8, 60) }, { name: "Curl", sets: sets(2, null, null) })])).toEqual([]);
  });
});
