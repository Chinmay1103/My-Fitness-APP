-- Claude's note for the day, written through the coach connector (save_daily_note) and shown on the
-- app's Today screen. It joins the band's scores with what the user logged in the chat (workouts,
-- meals) into "why" and "what to do". The scores themselves stay the app's deterministic math.

create table public.daily_notes (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  -- One line, e.g. "Low recovery: a late heavy dinner after leg day".
  headline text not null check (char_length(headline) <= 140),
  -- Why the day scored as it did, sensor data and logged activities/meals together.
  why text not null check (char_length(why) <= 800),
  -- One to three concrete things to do today.
  tips text[] not null default '{}' check (cardinality(tips) <= 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_notes enable row level security;

create policy "Own rows" on public.daily_notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.daily_notes to authenticated;
revoke all on public.daily_notes from anon;
