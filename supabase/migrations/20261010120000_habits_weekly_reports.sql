-- Habits the user tells the coach about ("had 2 drinks", "coffee at 5 pm", "late dinner"), so the
-- app can show what each one does to the next morning's recovery and that night's sleep. Logged
-- through the coach connector (log_habit); the app only reads them.

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Short lowercase name the coach keeps consistent: 'alcohol', 'late caffeine', 'late dinner'...
  kind text not null check (char_length(kind) between 1 and 40),
  -- When it happened (the local day it belongs to is worked out in the user's time zone).
  occurred_at timestamptz not null default now(),
  -- How much, when it matters: number of drinks, cups...
  amount numeric(6, 1) check (amount is null or amount >= 0),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index habits_user_occurred on public.habits (user_id, occurred_at desc);

alter table public.habits enable row level security;

create policy "Own rows" on public.habits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.habits to authenticated;
revoke all on public.habits from anon;

-- The weekly report Claude writes through the connector (save_weekly_report) from the week's
-- numbers. The app shows its own numbers next to it; the text only explains.

create table public.weekly_reports (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Last day of the week the report covers.
  week_end date not null,
  headline text not null check (char_length(headline) <= 140),
  summary text not null check (char_length(summary) <= 1500),
  -- The one thing to focus on next week.
  focus text not null check (char_length(focus) <= 300),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_end)
);

alter table public.weekly_reports enable row level security;

create policy "Own rows" on public.weekly_reports
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.weekly_reports to authenticated;
revoke all on public.weekly_reports from anon;
