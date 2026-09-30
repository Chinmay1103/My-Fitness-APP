import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Input, Muted, Screen } from '@/components/ui';
import { colors, fonts, radius, spacing, type } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import {
  effortLabel,
  KIND_ORDER,
  KINDS,
  newId,
  paceText,
  type Exercise,
  type Workout,
  type WorkoutKind,
} from '@/lib/workouts';
import { useWorkouts } from '@/lib/WorkoutsProvider';

const DAY = 86400000;

function startOfDay(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function hhmm(time: number): string {
  const d = new Date(time);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "18:05" or "1805" or "6" → minutes after midnight, or null if it isn't a time. */
function parseTime(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2] ?? 0);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

/** "62.5" or "62,5" → 62.5; empty or invalid → null. */
function parseNumber(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Numbers in text fields: empty for null, no trailing ".0". */
function numText(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

interface ExerciseDraft {
  key: string;
  name: string;
  sets: { key: string; reps: string; kg: string }[];
}

function toDraft(exercises: Exercise[] | undefined): ExerciseDraft[] {
  return (exercises ?? []).map((e) => ({
    key: newId(),
    name: e.name,
    sets: e.sets.map((s) => ({ key: newId(), reps: numText(s.reps), kg: numText(s.weightKg) })),
  }));
}

/**
 * Log a new workout, label one the band detected (`start` + `minutes` params), or edit one (`id`).
 * The form adapts to the type: exercises and sets for the gym, distance and pace for runs, rides
 * and walks, and just duration and effort for everything else.
 */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ id?: string; start?: string; minutes?: string }>();
  const { workouts, save, remove, exerciseNames } = useWorkouts();
  const existing = params.id ? workouts.find((w) => w.id === params.id) : undefined;

  const initialStart = existing?.start ?? (params.start ? Number(params.start) : Date.now() - 60 * 60000);
  const [kind, setKind] = useState<WorkoutKind>(existing?.kind ?? 'strength');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [dayOffset, setDayOffset] = useState(Math.round((startOfDay(Date.now()) - startOfDay(initialStart)) / DAY));
  const [time, setTime] = useState(hhmm(initialStart));
  const [minutes, setMinutes] = useState(String(existing?.minutes ?? params.minutes ?? 60));
  const [effort, setEffort] = useState<number | undefined>(existing?.effort);
  const [distance, setDistance] = useState(numText(existing?.distanceKm));
  const [exercises, setExercises] = useState<ExerciseDraft[]>(toDraft(existing?.exercises));
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const meta = KINDS[kind];
  const parsedMinutes = parseNumber(minutes);
  const parsedTime = parseTime(time);
  const parsedDistance = parseNumber(distance);
  const pace = meta.distance && parsedDistance && parsedMinutes ? paceText(kind, parsedMinutes, parsedDistance) : null;
  const canSave = parsedMinutes !== null && parsedMinutes > 0 && parsedTime !== null;

  // Up to 8 exercises used before that aren't already in this workout.
  const suggestions = useMemo(() => {
    const used = new Set(exercises.map((e) => e.name.trim().toLowerCase()));
    return exerciseNames.filter((n) => !used.has(n.toLowerCase())).slice(0, 8);
  }, [exerciseNames, exercises]);

  const addExercise = (name = '') =>
    setExercises((list) => [...list, { key: newId(), name, sets: [{ key: newId(), reps: '', kg: '' }] }]);
  const updateExercise = (key: string, change: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((list) => list.map((e) => (e.key === key ? change(e) : e)));

  const onSave = () => {
    if (!canSave) return;
    const start = startOfDay(Date.now()) - dayOffset * DAY + parsedTime! * 60000;
    const now = Date.now();
    const workout: Workout = {
      id: existing?.id ?? newId(),
      kind,
      start,
      minutes: Math.round(parsedMinutes!),
      title: title.trim() || undefined,
      effort,
      distanceKm: meta.distance && parsedDistance ? parsedDistance : undefined,
      exercises: meta.exercises
        ? exercises
            .filter((e) => e.name.trim())
            .map((e) => ({
              name: e.name.trim(),
              sets: e.sets
                .map((s) => ({ reps: parseNumber(s.reps), weightKg: parseNumber(s.kg) }))
                .filter((s) => s.reps !== null || s.weightKg !== null),
            }))
        : undefined,
      notes: notes.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    save(workout);
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Delete this workout?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove(existing.id);
          router.back();
        },
      },
    ]);
  };

  const dayChoices = [0, 1, 2, 3, 4, 5, 6].map((offset) => ({
    offset,
    label:
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Yesterday'
          : new Date(Date.now() - offset * DAY).toLocaleDateString(undefined, { weekday: 'short' }),
  }));

  return (
    <Screen back overline={existing ? 'EDIT WORKOUT' : 'LOG WORKOUT'} title={title.trim() || meta.label} glow={colors.strain}>
      <Card title="TYPE">
        <View style={styles.wrap}>
          {KIND_ORDER.map((k) => (
            <Chip key={k} label={KINDS[k].label} selected={k === kind} onPress={() => setKind(k)} />
          ))}
        </View>
        <Input value={title} onChangeText={setTitle} placeholder={meta.placeholder} maxLength={60} />
      </Card>

      <Card title="WHEN">
        <View style={styles.wrap}>
          {dayChoices.map((d) => (
            <Chip key={d.offset} label={d.label} selected={d.offset === dayOffset} onPress={() => setDayOffset(d.offset)} />
          ))}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Start time</Text>
            <Input value={time} onChangeText={setTime} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Minutes</Text>
            <Input value={minutes} onChangeText={setMinutes} placeholder="60" keyboardType="number-pad" maxLength={4} />
          </View>
        </View>
        {parsedTime === null ? <Text style={styles.warning}>Start time should look like 18:00.</Text> : null}
      </Card>

      {meta.distance ? (
        <Card title="DISTANCE">
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Kilometres</Text>
              <Input value={distance} onChangeText={setDistance} placeholder="5.0" keyboardType="decimal-pad" maxLength={6} />
            </View>
            <View style={[styles.field, styles.paceBox]}>
              <Text style={styles.fieldLabel}>{kind === 'cycle' ? 'Speed' : 'Pace'}</Text>
              <Text style={styles.pace}>{pace ?? '–'}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {meta.exercises ? (
        <Card title="EXERCISES">
          {exercises.length === 0 ? <Muted>Add what you did, with sets, reps and weight. All optional.</Muted> : null}
          {exercises.map((e, i) => (
            <View key={e.key} style={styles.exercise}>
              <View style={styles.exerciseHeader}>
                <Input
                  style={styles.exerciseName}
                  value={e.name}
                  onChangeText={(name) => updateExercise(e.key, (x) => ({ ...x, name }))}
                  placeholder={`Exercise ${i + 1}, e.g. Bench press`}
                  maxLength={60}
                />
                <SmallButton
                  label="Remove"
                  onPress={() => setExercises((list) => list.filter((x) => x.key !== e.key))}
                />
              </View>
              {e.sets.map((s, j) => (
                <View key={s.key} style={styles.setRow}>
                  <Text style={styles.setLabel}>Set {j + 1}</Text>
                  <Input
                    style={styles.setInput}
                    value={s.reps}
                    onChangeText={(reps) =>
                      updateExercise(e.key, (x) => ({ ...x, sets: x.sets.map((y) => (y.key === s.key ? { ...y, reps } : y)) }))
                    }
                    placeholder="reps"
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.times}>×</Text>
                  <Input
                    style={styles.setInput}
                    value={s.kg}
                    onChangeText={(kg) =>
                      updateExercise(e.key, (x) => ({ ...x, sets: x.sets.map((y) => (y.key === s.key ? { ...y, kg } : y)) }))
                    }
                    placeholder="kg"
                    keyboardType="decimal-pad"
                    maxLength={6}
                  />
                  <SmallButton
                    label="×"
                    accessibilityLabel={`Remove set ${j + 1}`}
                    onPress={() => updateExercise(e.key, (x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))}
                  />
                </View>
              ))}
              <SmallButton
                label="+ Add set"
                onPress={() =>
                  // A new set copies the last one, since most sets repeat.
                  updateExercise(e.key, (x) => {
                    const last = x.sets.at(-1);
                    return { ...x, sets: [...x.sets, { key: newId(), reps: last?.reps ?? '', kg: last?.kg ?? '' }] };
                  })
                }
              />
            </View>
          ))}
          {suggestions.length ? (
            <>
              <Text style={styles.fieldLabel}>Done before</Text>
              <View style={styles.wrap}>
                {suggestions.map((name) => (
                  <Chip key={name} label={`+ ${name}`} onPress={() => addExercise(name)} />
                ))}
              </View>
            </>
          ) : null}
          <Button label="Add exercise" variant="secondary" onPress={() => addExercise()} />
        </Card>
      ) : null}

      <Card title="HOW HARD WAS IT?">
        <View style={styles.effortRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                tapHaptic();
                setEffort(effort === n ? undefined : n);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Effort ${n} of 10, ${effortLabel(n)}`}
              accessibilityState={{ selected: effort === n }}
              style={[styles.effort, effort !== undefined && n <= effort && styles.effortOn]}>
              <Text style={[styles.effortText, effort !== undefined && n <= effort && styles.effortTextOn]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Muted>{effort ? `${effort}/10 · ${effortLabel(effort)}` : 'Optional. 1 is very easy, 10 is everything you had.'}</Muted>
      </Card>

      <Card title="NOTES">
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering (optional)"
          multiline
          style={styles.notes}
          maxLength={500}
        />
      </Card>

      <Button label={existing ? 'Save changes' : 'Save workout'} onPress={onSave} disabled={!canSave} />
      {existing ? <Button label="Delete workout" variant="secondary" onPress={onDelete} /> : null}
    </Screen>
  );
}

function SmallButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      style={({ pressed }) => [styles.small, pressed && styles.pressed]}>
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fieldRow: { flexDirection: 'row', gap: spacing.sm + 4 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { ...type.caption, color: colors.muted },
  warning: { ...type.caption, color: colors.recovery.yellow },
  paceBox: { justifyContent: 'flex-start' },
  pace: { fontFamily: fonts.number, fontSize: 26, color: colors.text, paddingTop: 6, fontVariant: ['tabular-nums'] },
  exercise: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setLabel: { ...type.caption, color: colors.muted, width: 40 },
  setInput: { flex: 1, textAlign: 'center' },
  times: { ...type.body, color: colors.muted },
  small: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4, minHeight: 32, justifyContent: 'center' },
  smallText: { ...type.caption, fontSize: 13, color: colors.strain },
  effortRow: { flexDirection: 'row', gap: 5 },
  effort: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 40,
    borderRadius: radius.sm + 4,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortOn: { backgroundColor: colors.strain, borderColor: colors.strain },
  effortText: { fontFamily: fonts.number, fontSize: 16, color: colors.muted },
  effortTextOn: { color: colors.background },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  pressed: { opacity: 0.6 },
});
