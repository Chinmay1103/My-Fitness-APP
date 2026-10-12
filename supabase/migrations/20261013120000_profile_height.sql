-- Height, for body mass index in body age. Set on the Account screen or by telling the coach.
-- Display only: no score uses it.
alter table public.profiles
  add column height_cm smallint check (height_cm between 120 and 230);
