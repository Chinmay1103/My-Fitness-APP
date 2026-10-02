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
Record workouts and meals the user tells you about with log_workout / log_meal (estimate meal macros yourself; Indian home food is common).
Confirm what you logged in one short line. Times are in the user's time zone (see get_daily_scores). Give wellness guidance, not medical advice.`;

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

function buildServer(supabase: Db) {
  const server = new McpServer({ name: 'my-fitness', version: '0.1.0' }, { instructions: INSTRUCTIONS });

  server.registerTool(
    'get_daily_scores',
    {
      title: 'Daily scores',
      description:
        "Recovery, strain and sleep for the last N days (newest first), with resting HR, HRV and hours slept. Days appear once the phone has synced real band data; demo data is never uploaded.",
      inputSchema: z.object({ days: z.number().int().min(1).max(90).default(7).describe('How many days back, 1-90') }),
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const timeZone = await timezoneOf(supabase);
      const since = localDate(new Date(Date.now() - (days - 1) * 86_400_000), timeZone);
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('date, recovery_score, recovery_zone, strain, sleep_score, asleep_minutes, resting_hr, hrv_rmssd, sleep_start, sleep_end')
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
        })),
      });
    },
  );

  server.registerTool(
    'get_day_breakdown',
    {
      title: 'Why a day scored what it did',
      description:
        "The full score breakdown for one day, as the app shows it in its 'Why' cards: recovery = typical night + points per factor (HRV, resting HR, sleep) vs. the personal baseline; sleep = hours ceiling minus quality penalties, and sleep need = base + strain + debt; strain = activities + everyday movement.",
      inputSchema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD') }),
      annotations: { readOnlyHint: true },
    },
    async ({ date }) => {
      const { data, error } = await supabase.from('daily_summaries').select('scores').eq('date', date).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return text(`No synced data for ${date}.`);
      return text(data.scores);
    },
  );

  server.registerTool(
    'log_workout',
    {
      title: 'Log a workout',
      description:
        "Record a workout the user describes, e.g. 'push day, 45 min this morning: bench 3x8 at 60kg'. Ask only if the type or rough time is unclear.",
      inputSchema: z.object({
        kind: z.enum(WORKOUT_KINDS).describe('strength = gym/weights; cycle = ride; class = yoga, HIIT, etc.'),
        started_at: z.string().describe("ISO 8601 with the user's UTC offset, e.g. 2026-10-02T07:30:00+05:30"),
        minutes: z.number().int().min(1).max(600),
        title: z.string().max(80).optional().describe("Short name, e.g. 'Push day' or 'Easy 5k'"),
        effort: z.number().int().min(1).max(10).optional().describe('How hard it felt, 1-10, if the user said'),
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
          ended_at: new Date(start.getTime() + w.minutes * 60_000).toISOString(),
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
      description: 'Workouts the user logged in the last N days, newest first.',
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
      return text(
        data.map((w) => ({
          ...w,
          started_at: localTime(w.started_at, timeZone),
          ended_at: localTime(w.ended_at, timeZone),
        })),
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
    'delete_entry',
    {
      title: 'Delete a logged workout or meal',
      description: 'Remove a workout or meal, e.g. one logged by mistake. Get the id from list_workouts or list_meals.',
      inputSchema: z.object({ type: z.enum(['workout', 'meal']), id: z.string().uuid() }),
      annotations: { destructiveHint: true },
    },
    async ({ type, id }) => {
      const { data, error } = await supabase
        .from(type === 'workout' ? 'workouts' : 'meals')
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
  pipeline([withOAuthProtectedResource(), withSupabase<Database>({ auth: 'user' })], async (req, { supabase }) => {
    const handler = createMcpHandler(() => buildServer(supabase), {
      onerror: (error) => console.error('MCP request failed', error),
    });
    return handler.fetch(req);
  }),
);
