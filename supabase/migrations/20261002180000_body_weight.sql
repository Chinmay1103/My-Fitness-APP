-- Body weight, told to the coach in the chat ("61.1 kg this morning"); later also read from Health
-- Connect if a scale writes there. One row per weigh-in.

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  source text not null default 'manual' check (source in ('manual', 'health-connect', 'healthkit')),
  created_at timestamptz not null default now()
);
create index body_weights_user_measured on public.body_weights (user_id, measured_at desc);

alter table public.body_weights enable row level security;

create policy "Own rows" on public.body_weights
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.body_weights to authenticated;
revoke all on public.body_weights from anon;
