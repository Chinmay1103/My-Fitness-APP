-- Workout calories come from heart rate with a formula that differs for men and women (Keytel
-- 2005). The user tells the coach; until then the app averages the two. Display only: no score uses it.
alter table public.profiles
  add column sex text check (sex in ('male', 'female'));
