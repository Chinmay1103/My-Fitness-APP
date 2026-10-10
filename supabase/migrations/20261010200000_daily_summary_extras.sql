-- The rest of a day's numbers, so the website can show them over months, not just the phone's
-- last 30 days: steps, Active Zone Minutes, blood oxygen, breathing rate, skin temperature,
-- energy burned and last night's sleep stages. Display only; none of them changes a score.
-- Shape: { steps, zone_minutes, spo2, breathing, skin_temp_delta, calories_burned,
--          sleep_stages: { awake, light, deep, rem } } (minutes for stages; any field may be null).

alter table public.daily_summaries add column extras jsonb;
