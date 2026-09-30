-- First pass of the My Fitness schema (see docs/ROADMAP.md, section 5).
--
-- Every table has Row Level Security: a signed-in user can only see and change their own rows,
-- and signed-out requests see nothing. Deleting the auth user deletes all of their data.
--
-- Raw heart-rate samples stay on the phone. The cloud gets one summary row per day, which is all
-- the coach needs and much less sensitive.

-- Profiles --------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Used for max heart rate when none is measured.
  birth_date date,
  max_hr smallint check (max_hr between 120 and 230),
  base_sleep_need_minutes smallint not null default 480 check (base_sleep_need_minutes between 300 and 660),
  created_at timestamptz not null default now()
);

-- Give every new account a profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Daily summaries (synced from the phone) -------------------------------------------------------

create table public.daily_summaries (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  source text not null check (source in ('health-connect', 'healthkit')),
  resting_hr smallint,
  hrv_rmssd smallint,
  sleep_start timestamptz,
  sleep_end timestamptz,
  asleep_minutes smallint,
  recovery_score smallint check (recovery_score between 0 and 100),
  recovery_zone text check (recovery_zone in ('green', 'yellow', 'red')),
  strain numeric(3, 1) check (strain between 0 and 21),
  sleep_score smallint check (sleep_score between 0 and 100),
  -- The phone's full DailyScores for the day, breakdowns included, so the coach can explain them.
  scores jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Workouts and plans (milestone 3) --------------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  started_at timestamptz not null,
  ended_at timestamptz,
  kind text not null, -- e.g. 'strength', 'run', 'cycling'
  title text,
  notes text,
  -- Exercises, sets and reps for strength sessions.
  details jsonb,
  source text not null default 'manual' check (source in ('manual', 'health-connect', 'healthkit')),
  created_at timestamptz not null default now()
);
create index workouts_user_started on public.workouts (user_id, started_at desc);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  -- The weekly schedule: which session on which day.
  plan jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Meals (milestone 3) ---------------------------------------------------------------------------

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  eaten_at timestamptz not null default now(),
  -- What the user typed, e.g. "2 rotis and dal".
  description text,
  -- Path in the meal-photos bucket: <user id>/<file>.
  photo_path text,
  -- Per-item estimate: [{ name, quantity, calories, protein_g, carbs_g, fat_g }].
  items jsonb,
  calories integer,
  protein_g numeric(6, 1),
  carbs_g numeric(6, 1),
  fat_g numeric(6, 1),
  ai_estimated boolean not null default false,
  created_at timestamptz not null default now()
);
create index meals_user_eaten on public.meals (user_id, eaten_at desc);

-- Coach chat (milestone 4) ----------------------------------------------------------------------

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index coach_messages_user_created on public.coach_messages (user_id, created_at);

-- Row Level Security ----------------------------------------------------------------------------
-- `(select auth.uid())` instead of `auth.uid()` so Postgres evaluates it once per query.

alter table public.profiles enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_plans enable row level security;
alter table public.meals enable row level security;
alter table public.coach_messages enable row level security;

create policy "Own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Own rows" on public.daily_summaries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Own rows" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Own rows" on public.workout_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Own rows" on public.meals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Own rows" on public.coach_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Signed-in users can use these tables through the API (RLS above still limits them to their rows).
-- Signed-out (anon) requests get nothing.
grant select, insert, update, delete on
  public.profiles, public.daily_summaries, public.workouts, public.workout_plans, public.meals, public.coach_messages
  to authenticated;
revoke all on
  public.profiles, public.daily_summaries, public.workouts, public.workout_plans, public.meals, public.coach_messages
  from anon;

-- Meal photos -----------------------------------------------------------------------------------
-- A private bucket; each user's files live under a folder named after their user id.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false);

create policy "Own meal photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
