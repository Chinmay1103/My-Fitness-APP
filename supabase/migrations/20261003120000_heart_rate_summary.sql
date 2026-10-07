-- A day's heart rate in a few numbers, so the coach can see it: low / avg / high, the latest
-- reading, an average per local hour and how many minutes had readings. Raw samples still stay on
-- the phone. Shape: { low, avg, high, latest_bpm, latest_at, hourly: (number|null)[24], minutes_covered }.

alter table public.daily_summaries add column heart_rate jsonb;
