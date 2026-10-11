-- Goals the user tells the coach ("I want to get to 65 kg, eating 2,400 kcal and 110 g protein a
-- day"). The website's Progress page measures against them. Display only; no score uses them.
alter table public.profiles
  add column goal_weight_kg numeric(5, 2) check (goal_weight_kg between 30 and 250),
  add column calorie_target smallint check (calorie_target between 800 and 6000),
  add column protein_target_g smallint check (protein_target_g between 20 and 400);
