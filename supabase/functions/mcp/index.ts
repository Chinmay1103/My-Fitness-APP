// The coach connector: an MCP server that the Claude app connects to (claude.ai custom connector).
// Claude signs the user in through Supabase Auth's OAuth server (consent page: docs/oauth/consent.html),
// then every tool runs as that user, so RLS limits it to their own rows.
//
// Deploy: npx supabase functions deploy mcp --no-verify-jwt   (the gate below checks the token)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { pipeline } from 'npm:@supabase/middleware@1';
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1';
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.2.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@^4.2.0';

import type { Database, Json } from '../_shared/database.types.ts';

type Db = SupabaseClient<Database>;

const INSTRUCTIONS = `My Fitness is the user's Whoop-style app for their Fitbit. It computes three daily scores on the phone:
Recovery (0-100%, green >= 67, yellow 34-66, red < 34) from HRV and resting heart rate against their own 30-day normal plus sleep;
Strain (0-21, logarithmic, like Whoop) from heart rate; Sleep (0-100%) from hours slept vs. need and sleep quality.
The scores are deterministic math; your job is to explain them and coach, not to recompute them. Use get_day_breakdown for the "why".
Record workouts, meals and weigh-ins the user tells you about with log_workout / log_meal / log_weight (estimate meal macros
yourself; Indian home food is common), and facts about themselves (name, birth date, sleep need) with update_profile.
The app has no forms: everything is recorded through you, so never tell the user to enter something in the app.
Confirm what you logged in one short line. Times are in the user's time zone (see get_daily_scores). Give wellness guidance, not medical advice.
When you explain a day, combine the score breakdown with the workouts and meals they logged (list_workouts, list_meals): the band can't
see a late dinner or a leg day, you can. Whenever the user asks how their day is going, or for advice, end by saving the gist with
save_daily_note so it shows on the app's Today screen. Do this even when no scores have synced yet: then base it on what they logged.
The app opens a new chat for each question, so at the start of a conversation call get_coach_notes to see what you told
them on recent days and pick up from there (e.g. "yesterday you planned a rest day; recovery agrees").
For workouts, record the exact start and end time ("from 6:10 to 7:05 pm"); ask if they only give a rough time. The app matches
those times to the band's heart rate, and list_workouts then shows what the band measured during each one (avg/peak heart rate,
minutes of effort, strain). Use that to tell them how hard it really was, e.g. a run that stayed in zone 2 or a lifting session
the heart barely noticed.`;

const WORKOUT_KINDS = ['strength', 'run', 'cycle', 'walk', 'sport', 'class', 'other'] as const;

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] };
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

async function timezoneOf(supabase: Db): Promise<string> {
  const { data } = await supabase.from('profiles').select('timezone').maybeSingle();
  return data?.timezone ?? 'Asia/Kolkata';
}

/** "2026-10-02 07:30" in the user's zone. */
function localTime(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

/** The date (YYYY-MM-DD) in the user's zone. */
function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** What the phone uploads in `daily_summaries.heart_rate` (see apps/mobile/lib/sync.ts). */
interface HeartRateRow {
  low: number;
  avg: number;
  high: number;
  latest_bpm: number;
  latest_at: string;
  hourly: (number | null)[];
  minutes_covered: number;
}

function heartRateBrief(json: unknown, timeZone: string) {
  const hr = json as HeartRateRow | null;
  if (!hr) return null;
  return {
    low_bpm: hr.low,
    avg_bpm: Math.round(hr.avg),
    high_bpm: hr.high,
    latest_bpm: hr.latest_bpm,
    latest_at: localTime(hr.latest_at, timeZone),
    hours_tracked: Math.round((hr.minutes_covered / 60) * 10) / 10,
  };
}

function buildServer(supabase: Db, userId: string) {
  const server = new McpServer({ name: 'my-fitness', version: '0.1.0' }, { instructions: INSTRUCTIONS });

  server.registerTool(
    'get_daily_scores',
    {
      title: 'Daily scores',
      description:
        "Recovery, strain and sleep for the last N days (newest first), with resting HR, HRV, hours slept and the day's heart rate (low / average / high bpm and the latest reading). Days appear once the phone has synced real band data; demo data is never uploaded.",
      inputSchema: z.object({ days: z.number().int().min(1).max(90).default(7).describe('How many days back, 1-90') }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const timeZone = await timezoneOf(supabase);
      const since = localDate(new Date(Date.now() - (days - 1) * 86_400_000), timeZone);
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('date, recovery_score, recovery_zone, strain, sleep_score, asleep_minutes, resting_hr, hrv_rmssd, sleep_start, sleep_end, heart_rate')
        .gte('date', since)
        .order('date', { ascending: false });
      if (error) return fail(error.message);
      if (!data.length) {
        return text(
          `No synced days since ${since}. The app uploads a summary once it reads real data from Health Connect (the band); until then only the phone has demo data.`,
        );
      }
      return text({
        time_zone: timeZone,
        today: localDate(new Date(), timeZone),
        days: data.map((d) => ({
          date: d.date,
          recovery_pct: d.recovery_score,
          recovery_zone: d.recovery_zone,
          strain: d.strain,
          sleep_pct: d.sleep_score,
          asleep_hours: d.asleep_minutes != null ? Math.round((d.asleep_minutes / 60) * 10) / 10 : null,
          bedtime: localTime(d.sleep_start, timeZone),
          wake: localTime(d.sleep_end, timeZone),
          resting_hr: d.resting_hr,
          hrv_ms: d.hrv_rmssd,
          heart_rate: heartRateBrief(d.heart_rate, timeZone),
        })),
      });
    },
  );

  server.registerTool(
    'get_day_breakdown',
    {
      title: 'Why a day scored what it did',
      description:
        "The full score breakdown for one day, as the app shows it in its 'Why' cards: recovery = typical night + points per factor (HRV, resting HR, sleep) vs. the personal baseline; sleep = hours ceiling minus quality penalties, and sleep need = base + strain + debt; strain = activities + everyday movement. Also the day's average heart rate per hour (local time, null = no readings).",
      inputSchema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD') }),
      annotations: { readOnlyHint: true },
    },
    async ({ date }) => {
      const { data, error } = await supabase.from('daily_summaries').select('scores, heart_rate').eq('date', date).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return text(`No synced data for ${date}.`);
      const hourly = (data.heart_rate as HeartRateRow | null)?.hourly;
      return text({
        scores: data.scores,
        heart_rate_by_hour: hourly ? Object.fromEntries(hourly.map((bpm, h) => [`${String(h).padStart(2, '0')}:00`, bpm])) : null,
      });
    },
  );

  server.registerTool(
    'log_workout',
    {
      title: 'Log a workout',
      description:
        "Record a workout the user describes, e.g. 'push day 6:10-7:05 pm: bench 3x8 at 60kg'. Ask if the type, the start and end time, or how hard it felt (1-10) is missing: the app matches the times to the band's heart rate and uses the rating to count strain heart rate misses, e.g. in lifting.",
      inputSchema: z.object({
        kind: z.enum(WORKOUT_KINDS).describe('strength = gym/weights; cycle = ride; class = yoga, HIIT, etc.'),
        started_at: z.string().describe("ISO 8601 with the user's UTC offset, e.g. 2026-10-02T07:30:00+05:30"),
        ended_at: z.string().optional().describe('When it ended, ISO 8601 with the UTC offset. Prefer this over minutes'),
        minutes: z.number().int().min(1).max(600).optional().describe('Length, if the user gave a duration instead of an end time'),
        title: z.string().max(80).optional().describe("Short name, e.g. 'Push day' or 'Easy 5k'"),
        effort: z.number().int().min(1).max(10).optional().describe('How hard it felt, 1 (very easy) to 10 (all out). Ask if the user did not say'),
        distance_km: z.number().min(0).max(500).optional(),
        exercises: z
          .array(
            z.object({
              name: z.string(),
              sets: z.array(z.object({ reps: z.number().int().nullable(), weight_kg: z.number().nullable() })),
            }),
          )
          .optional(),
        notes: z.string().max(1000).optional(),
      }),
    },
    async (w) => {
      const start = new Date(w.started_at);
      if (Number.isNaN(start.getTime())) return fail(`Couldn't read started_at "${w.started_at}".`);
      const end = w.ended_at ? new Date(w.ended_at) : w.minutes ? new Date(start.getTime() + w.minutes * 60_000) : null;
      if (!end || Number.isNaN(end.getTime())) return fail('Need ended_at or minutes: ask the user when they finished.');
      if (end <= start || end.getTime() - start.getTime() > 10 * 3_600_000) return fail('ended_at must be after started_at and within 10 hours.');
      const details = {
        effort: w.effort ?? null,
        distanceKm: w.distance_km ?? null,
        exercises: w.exercises?.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weight_kg })) })) ?? null,
      };
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          kind: w.kind,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          title: w.title ?? null,
          notes: w.notes ?? null,
          details: details as Json,
          source: 'manual',
        })
        .select('id')
        .single();
      if (error) return fail(error.message);
      return text({ logged: 'workout', id: data.id });
    },
  );

  server.registerTool(
    'log_meal',
    {
      title: 'Log a meal',
      description:
        "Record what the user ate, with your estimate of calories and macros per item, e.g. '2 rotis and dal'. Totals are added up from the items.",
      inputSchema: z.object({
        description: z.string().max(500).describe("What the user said, e.g. '2 rotis, dal, salad'"),
        eaten_at: z.string().optional().describe("ISO 8601 with the user's UTC offset; omit for now"),
        items: z
          .array(
            z.object({
              name: z.string(),
              quantity: z.string().describe("e.g. '2 rotis', '1 katori (150 g)'"),
              calories: z.number().min(0),
              protein_g: z.number().min(0),
              carbs_g: z.number().min(0),
              fat_g: z.number().min(0),
            }),
          )
          .min(1),
      }),
    },
    async (m) => {
      const eatenAt = m.eaten_at ? new Date(m.eaten_at) : new Date();
      if (Number.isNaN(eatenAt.getTime())) return fail(`Couldn't read eaten_at "${m.eaten_at}".`);
      const sum = (key: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g') =>
        Math.round(m.items.reduce((total, item) => total + item[key], 0) * 10) / 10;
      const totals = { calories: Math.round(sum('calories')), protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') };
      const { data, error } = await supabase
        .from('meals')
        .insert({ description: m.description, eaten_at: eatenAt.toISOString(), items: m.items as Json, ...totals, ai_estimated: true })
        .select('id')
        .single();
      if (error) return fail(error.message);
      return text({ logged: 'meal', id: data.id, ...totals });
    },
  );

  server.registerTool(
    'list_workouts',
    {
      title: 'Recent workouts',
      description:
        "Workouts the user logged in the last N days, newest first. `band` is what the band measured during it (after the phone app has synced that day): heart rate, minutes of effort, strain, and how much of the strain came from the effort rating.",
      inputSchema: z.object({ days: z.number().int().min(1).max(90).default(7) }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const timeZone = await timezoneOf(supabase);
      const { data, error } = await supabase
        .from('workouts')
        .select('id, kind, title, started_at, ended_at, notes, details')
        .gte('started_at', daysAgo(days))
        .order('started_at', { ascending: false });
      if (error) return fail(error.message);
      // The phone matches workouts to the band's stretches of effort and uploads them in the day's scores.
      const dates = [...new Set(data.map((w) => localDate(new Date(w.started_at), timeZone)))];
      const { data: summaries } = dates.length
        ? await supabase.from('daily_summaries').select('date, scores').in('date', dates)
        : { data: [] };
      type Activity = { start: number; end: number; minutes: number; avgBpm: number; maxBpm: number; strain: number; effortStrain?: number; workout?: { id: string } };
      const activities = (summaries ?? []).flatMap(
        (row) => ((row.scores as { strain?: { activities?: Activity[] } } | null)?.strain?.activities ?? []),
      );
      return text(
        data.map((w) => {
          const a = activities.find((x) => x.workout?.id === w.id);
          return {
            ...w,
            started_at: localTime(w.started_at, timeZone),
            ended_at: localTime(w.ended_at, timeZone),
            band: a
              ? {
                  effort_from: localTime(new Date(a.start).toISOString(), timeZone),
                  effort_to: localTime(new Date(a.end).toISOString(), timeZone),
                  minutes_of_effort: a.minutes,
                  avg_bpm: a.avgBpm || null,
                  peak_bpm: a.maxBpm || null,
                  strain: a.strain,
                  strain_from_effort_rating: a.effortStrain ?? 0,
                }
              : 'not matched yet: the phone app syncs it the next time it is opened, or the band saw no effort then',
          };
        }),
      );
    },
  );

  server.registerTool(
    'list_meals',
    {
      title: 'Recent meals',
      description: 'Meals logged in the last N days, newest first, with calorie and macro totals per day.',
      inputSchema: z.object({ days: z.number().int().min(1).max(30).default(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const timeZone = await timezoneOf(supabase);
      const { data, error } = await supabase
        .from('meals')
        .select('id, eaten_at, description, items, calories, protein_g, carbs_g, fat_g')
        .gte('eaten_at', daysAgo(days))
        .order('eaten_at', { ascending: false });
      if (error) return fail(error.message);
      const perDay: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {};
      for (const meal of data) {
        const day = (perDay[localDate(new Date(meal.eaten_at), timeZone)] ??= { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
        day.calories += meal.calories ?? 0;
        day.protein_g += Number(meal.protein_g ?? 0);
        day.carbs_g += Number(meal.carbs_g ?? 0);
        day.fat_g += Number(meal.fat_g ?? 0);
      }
      return text({ totals_per_day: perDay, meals: data.map((meal) => ({ ...meal, eaten_at: localTime(meal.eaten_at, timeZone) })) });
    },
  );

  server.registerTool(
    'save_daily_note',
    {
      title: "Save today's coach note",
      description:
        "Save your take on a day to the app's Today screen, under the score rings. Call it whenever you've told the user how their day is going or given advice, after looking at the scores, their breakdown and what they logged (if no scores have synced, base it on the logs alone). Saving again for the same date replaces the note.",
      inputSchema: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD in the user's time zone, usually today"),
        headline: z.string().min(1).max(140).describe("One line, e.g. 'Low recovery: late heavy dinner after leg day'"),
        why: z
          .string()
          .min(1)
          .max(800)
          .describe('2-4 plain sentences: what drove the scores, citing the numbers and the logged workouts/meals'),
        tips: z.array(z.string().min(1).max(160)).max(3).describe('Up to 3 concrete things to do today'),
      }),
      annotations: { idempotentHint: true },
    },
    async (note) => {
      const { error } = await supabase
        .from('daily_notes')
        .upsert({ ...note, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
      if (error) return fail(error.message);
      return text(`Saved. It shows on the Today screen for ${note.date}.`);
    },
  );

  server.registerTool(
    'get_coach_notes',
    {
      title: 'Earlier coach notes',
      description:
        'The notes you saved with save_daily_note over the last N days, newest first: your headline, why, and tips for each day. Read them at the start of a conversation, since each question may arrive in a new chat.',
      inputSchema: z.object({ days: z.number().int().min(1).max(30).default(7) }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const timeZone = await timezoneOf(supabase);
      const { data, error } = await supabase
        .from('daily_notes')
        .select('date, headline, why, tips, updated_at')
        .gte('date', localDate(new Date(Date.now() - days * 86_400_000), timeZone))
        .order('date', { ascending: false });
      if (error) return fail(error.message);
      if (data.length === 0) return text(`No coach notes in the last ${days} days.`);
      return text(data.map((note) => ({ ...note, updated_at: localTime(note.updated_at, timeZone) })));
    },
  );

  server.registerTool(
    'log_weight',
    {
      title: 'Log body weight',
      description: "Record a weigh-in the user tells you, e.g. '61.1 kg this morning'. Convert pounds to kg.",
      inputSchema: z.object({
        weight_kg: z.number().min(20).max(400),
        measured_at: z.string().optional().describe("ISO 8601 with the user's UTC offset; omit for now"),
      }),
    },
    async ({ weight_kg, measured_at }) => {
      const measuredAt = measured_at ? new Date(measured_at) : new Date();
      if (Number.isNaN(measuredAt.getTime())) return fail(`Couldn't read measured_at "${measured_at}".`);
      const { data, error } = await supabase
        .from('body_weights')
        .insert({ weight_kg, measured_at: measuredAt.toISOString() })
        .select('id')
        .single();
      if (error) return fail(error.message);
      return text({ logged: 'weight', id: data.id, weight_kg });
    },
  );

  server.registerTool(
    'list_weights',
    {
      title: 'Weight history',
      description: 'Weigh-ins from the last N days, newest first.',
      inputSchema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const timeZone = await timezoneOf(supabase);
      const { data, error } = await supabase
        .from('body_weights')
        .select('id, measured_at, weight_kg')
        .gte('measured_at', daysAgo(days))
        .order('measured_at', { ascending: false });
      if (error) return fail(error.message);
      return text(data.map((w) => ({ ...w, measured_at: localTime(w.measured_at, timeZone) })));
    },
  );

  server.registerTool(
    'get_profile',
    {
      title: 'Profile',
      description: "The user's name, birth date, time zone and base sleep need.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, birth_date, timezone, base_sleep_need_minutes, max_hr')
        .maybeSingle();
      if (error) return fail(error.message);
      return text(data ?? 'No profile yet.');
    },
  );

  server.registerTool(
    'update_profile',
    {
      title: 'Update profile',
      description:
        "Save facts the user states about themselves: their name, birth date, time zone, or how much sleep they need. Only what they said; don't guess.",
      inputSchema: z.object({
        display_name: z.string().min(1).max(60).optional(),
        birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD'),
        timezone: z.string().optional().describe("IANA name, e.g. 'Asia/Kolkata'"),
        base_sleep_need_minutes: z.number().int().min(300).max(660).optional(),
      }),
      annotations: { idempotentHint: true },
    },
    async (fields) => {
      if (fields.timezone) {
        try {
          new Intl.DateTimeFormat('en', { timeZone: fields.timezone });
        } catch {
          return fail(`"${fields.timezone}" isn't a time zone name like Asia/Kolkata.`);
        }
      }
      const { error } = await supabase.from('profiles').upsert({ id: userId, ...fields });
      if (error) return fail(error.message);
      return text('Profile updated.');
    },
  );

  server.registerTool(
    'delete_entry',
    {
      title: 'Delete a logged workout, meal or weigh-in',
      description:
        'Remove a workout, meal or weigh-in, e.g. one logged by mistake. Get the id from list_workouts, list_meals or list_weights.',
      inputSchema: z.object({ type: z.enum(['workout', 'meal', 'weight']), id: z.string().uuid() }),
      annotations: { destructiveHint: true },
    },
    async ({ type, id }) => {
      const table = ({ workout: 'workouts', meal: 'meals', weight: 'body_weights' } as const)[type];
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .select('id');
      if (error) return fail(error.message);
      return text(data.length ? `Deleted the ${type}.` : `No ${type} with that id.`);
    },
  );

  return server;
}

Deno.serve(
  pipeline([withOAuthProtectedResource(), withSupabase<Database>({ auth: 'user' })], async (req, { supabase, userClaims }) => {
    const handler = createMcpHandler(() => buildServer(supabase, userClaims!.id), {
      onerror: (error) => console.error('MCP request failed', error),
    });
    return handler.fetch(req);
  }),
);
